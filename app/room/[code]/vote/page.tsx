'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DrawingDisplay from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'

// Types locaux minimum pour cette page
type RoomRow = { id: string; code: string; status: string }
type PlayerRow = { id: string; room_id: string; name: string; color?: string | null; is_host?: boolean | null }
type DrawingRoundRow = {
  id: string
  room_id: string
  player_id: string
  round_number: number
  content: any
  created_at: string
  type: string
  book_id: string | null
}

export default function VotePage() {
  const params = useParams()
  const router = useRouter()

  const [room, setRoom] = useState<RoomRow | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PlayerRow | null>(null)
  const [drawings, setDrawings] = useState<DrawingRoundRow[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  // Map id -> nom pour éviter "Unknown"
  const nameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(String(p.id), p.name)
    return m
  }, [players])

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadVotingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  // Poll status + count toutes les 2s
  useEffect(() => {
    if (!room) return
    const interval = setInterval(() => {
      checkRoomStatus()
      checkVoteCount()
    }, 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, currentRoundNumber, currentPlayer?.is_host])

  const checkRoomStatus = async () => {
    if (!room) return
    const { data } = await supabase.from('rooms').select('status').eq('id', room.id).single()
    if (data && (data.status === 'results' || data.status === 'finished')) {
      router.push(`/room/${roomCode}/results`)
    }
  }

  const checkVoteCount = async () => {
    if (!room) return

    // Votes du round courant (si connu), sinon tous les votes de la room
    const vq = supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
    if (typeof currentRoundNumber === 'number') vq.eq('round_number', currentRoundNumber)
    const { count: votesRaw } = await vq
    const votesCount = votesRaw ?? 0
    setTotalVotes(votesCount)

    // Nombre de joueurs (count DB, plus fiable que players.length)
    const { count: playersRaw } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
    const playersCount = playersRaw ?? 0
    setTotalPlayers(playersCount)

    if (playersCount > 0 && votesCount >= playersCount && currentPlayer?.is_host) {
      const { error } = await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
      if (!error) setTimeout(() => router.push(`/room/${roomCode}/results`), 800)
    }
  }

  const loadVotingData = async () => {
    try {
      // Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, code, status')
        .eq('code', roomCode.toUpperCase())
        .single()
      if (roomError) throw roomError

      if (roomData.status === 'results' || roomData.status === 'finished') {
        router.push(`/room/${roomCode}/results`)
        return
      }
      setRoom(roomData)

      // Players
      const { data: playersData } = await supabase
        .from('players')
        .select('id, room_id, name, color, is_host')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      setPlayers((playersData as PlayerRow[]) || [])

      const me = (playersData as PlayerRow[] | null)?.find(p => String(p.id) === String(playerId)) || null
      setCurrentPlayer(me)

      // Nombre de joueurs (count DB)
      const { count: playersCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id)
      setTotalPlayers(playersCount ?? (playersData?.length ?? 0))

      // Drawings (type = draw)
      const { data: roundsData, error: rErr } = await supabase
        .from('rounds')
        .select('id, room_id, player_id, round_number, content, created_at, type, book_id')
        .eq('room_id', roomData.id)
        .eq('type', 'draw')
        .order('created_at', { ascending: true })
      if (rErr) throw rErr
      const drawingsRows = (roundsData as DrawingRoundRow[]) || []
      setDrawings(drawingsRows)

      // Round courant = max(round_number)
      const nums = drawingsRows.map(r => r.round_number).filter((n): n is number => typeof n === 'number')
      const roundNumber = nums.length ? Math.max(...nums) : null
      setCurrentRoundNumber(roundNumber)

      // Mon vote (room_id + round_number si connu)
      if (playerId) {
        const mvq = supabase.from('votes').select('*').eq('room_id', roomData.id).eq('voter_id', playerId)
        if (typeof roundNumber === 'number') mvq.eq('round_number', roundNumber)
        const { data: myVote } = await mvq.maybeSingle()

        if (myVote) {
          setHasVoted(true)
          if ((myVote as any).round_id) {
            setSelectedRoundId((myVote as any).round_id)
          } else {
            const match = drawingsRows.find(
              d =>
                String(d.player_id) === String((myVote as any).voted_for_id) &&
                (typeof (myVote as any).round_number === 'number'
                  ? d.round_number === (myVote as any).round_number
                  : true)
            )
            if (match) setSelectedRoundId(match.id)
          }
        }
      }

      // Compte initial des votes
      const cq = supabase.from('votes').select('*', { count: 'exact', head: true }).eq('room_id', roomData.id)
      if (typeof roundNumber === 'number') cq.eq('round_number', roundNumber)
      const { count } = await cq
      setTotalVotes(count ?? 0)
    } catch (error) {
      console.error('Error loading voting data:', error)
    }
  }

  const submitVote = async () => {
    if (!selectedRoundId || !room || !playerId) {
      toast.error('Please select a drawing first')
      return
    }
    setIsSubmitting(true)

    try {
      // Dessin sélectionné en mémoire, sinon refetch minimal
      let selected = drawings.find(d => d.id === selectedRoundId)
      if (!selected || typeof selected.player_id !== 'string' || typeof selected.round_number !== 'number') {
        const { data: row, error: rrErr } = await supabase
          .from('rounds')
          .select('id, room_id, player_id, round_number')
          .eq('id', selectedRoundId)
          .single()
        if (rrErr) throw rrErr
        selected = row as DrawingRoundRow
      }

      const roundNumberFinal = selected.round_number
      const votedForId = selected.player_id

      if (!votedForId) {
        toast.error('Missing author for the selected drawing')
        setIsSubmitting(false)
        return
      }
      if (typeof roundNumberFinal !== 'number') {
        toast.error('Missing round number for the selected drawing')
        setIsSubmitting(false)
        return
      }
      if (String(votedForId) === String(playerId)) {
        toast.error("You can't vote for yourself")
        setIsSubmitting(false)
        return
      }

      // Déjà voté pour ce round ?
      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('room_id', room.id)
        .eq('round_number', roundNumberFinal)
        .eq('voter_id', playerId)
        .maybeSingle()
      if (existingVote) {
        toast.error('You already voted!')
        setHasVoted(true)
        setIsSubmitting(false)
        return
      }

      // Insert complet (aucun champ null)
      const payload = {
        room_id: room.id,
        round_number: roundNumberFinal,
        voter_id: playerId,
        voted_for_id: votedForId,
        round_id: selectedRoundId,
      }
      console.log('🔎 Vote payload:', payload)

      const { error } = await supabase.from('votes').insert(payload)
      if (error) throw error

      setHasVoted(true)
      setCurrentRoundNumber(prev => (prev ?? roundNumberFinal))
      toast.success('Vote submitted!')

      setTimeout(() => checkVoteCount(), 500)
    } catch (error: any) {
      console.error('Error voting:', error)
      toast.error(error?.message || 'Failed to vote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPlayerName = (pid: string) => nameMap.get(String(pid)) || 'Unknown'

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }

  if (hasVoted) {
    const pct = totalPlayers ? Math.min(100, (totalVotes / totalPlayers) * 100) : 0
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
        <Toaster position="top-center" />
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-black text-white mb-8">✅ Vote Submitted!</h1>
          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <div className="text-6xl mb-6">🎨</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Waiting for other players...</h2>
            <p className="text-gray-600 text-xl mb-8">
              {totalVotes} / {totalPlayers} players have voted
            </p>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-8">
              <div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              {players.map(p => (
                <div
                  key={String(p.id)}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg opacity-40"
                  style={{ backgroundColor: p.color || '#666' }}
                >
                  {p.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              ))}
            </div>
            {totalVotes === totalPlayers && totalPlayers > 0 && (
              <div className="mt-8 text-green-600 font-bold text-2xl animate-bounce">
                🎉 Everyone voted! Loading results...
              </div>
            )}
            <div className="mt-6 text-sm text-gray-400">Checking every 2 seconds...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-4">🎨 Vote for the Best Drawing!</h1>
          <p className="text-white text-xl">Choose your favorite masterpiece</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {drawings.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedRoundId(d.id)}
              className={`bg-white rounded-2xl shadow-xl p-6 transition transform hover:scale-105 ${
                selectedRoundId === d.id ? 'ring-4 ring-yellow-400 scale-105' : ''
              }`}
            >
              <div className="mb-4">
                <div className="border-4 border-gray-800 rounded-xl overflow-hidden">
                  <DrawingDisplay data={d.content as any} />
                </div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-800 mb-2">By {getPlayerName(d.player_id)}</div>
                {selectedRoundId === d.id && <div className="text-yellow-500 text-4xl">⭐</div>}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={submitVote}
            disabled={!selectedRoundId || isSubmitting}
            className="px-12 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-2xl font-black rounded-2xl hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl transition transform hover:scale-105"
          >
            {isSubmitting ? 'Submitting...' : '🏆 Submit Vote'}
          </button>
        </div>
      </div>
    </div>
  )
}