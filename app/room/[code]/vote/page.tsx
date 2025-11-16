'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DrawingDisplay from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'

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
  const [loadingDrawings, setLoadingDrawings] = useState(true)

  // garde une copie stable du total attendu (ne doit jamais redescendre à 0)
  const expectedVotersRef = useRef(0)

  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

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

  // Polling: statut + votes
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

    // 1) Compte des votes (filtré par round si on le connaît)
    const vq = supabase.from('votes').select('id', { count: 'exact', head: false }).eq('room_id', room.id)
    if (typeof currentRoundNumber === 'number') vq.eq('round_number', currentRoundNumber)
    const { count: votesRaw, error: votesErr } = await vq
    if (votesErr) console.error('Count votes error:', votesErr)
    const votesCount = votesRaw ?? 0
    setTotalVotes(votesCount)

    // 2) Ne JAMAIS redescendre totalPlayers à 0
    //    Si totalPlayers est 0 mais on a déjà la liste des players => fixe-le une bonne fois
    if (totalPlayers === 0 && players.length > 0) {
      setTotalPlayers(players.length)
      expectedVotersRef.current = players.length
    }

    // 3) Si toujours 0 (cas extrême), fallback via "distinct player_id" sur les dessins du round courant
    if (totalPlayers === 0 && drawings.length > 0) {
      const roundFilter = typeof currentRoundNumber === 'number'
        ? drawings.filter(d => d.round_number === currentRoundNumber)
        : drawings
      const distinctAuthors = new Set(roundFilter.map(d => String(d.player_id))).size
      if (distinctAuthors > 0) {
        setTotalPlayers(distinctAuthors)
        expectedVotersRef.current = distinctAuthors
      }
    }

    const expected = expectedVotersRef.current || totalPlayers || players.length || 0

    if (expected > 0 && votesCount >= expected) {
      // Le host tente de mettre la room en "results" (si RLS OK), mais on redirige tout le monde de toute façon
      if (currentPlayer?.is_host) {
        await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
      }
      setTimeout(() => router.push(`/room/${roomCode}/results`), 600)
    }

    if (expected > 0 && votesCount >= expected) {
      if (currentPlayer?.is_host) {
        const { error } = await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
        if (!error) setTimeout(() => router.push(`/room/${roomCode}/results`), 600)
      } else {
        // Non-host: laisse le host changer le statut; on continuera de poller et on se redirigera via checkRoomStatus
      }
    }
  }

  const fetchDrawings = async (roomId: string) => {
    setLoadingDrawings(true)
    try {
      let { data: roundsData, error: rErr } = await supabase
        .from('rounds')
        .select('id, room_id, player_id, round_number, content, created_at, type, book_id')
        .eq('room_id', roomId)
        .eq('type', 'draw')
        .order('created_at', { ascending: true })

      if (rErr) console.error('Rounds query error (draw):', rErr)

      if (!roundsData || roundsData.length === 0) {
        const fb = await supabase
          .from('rounds')
          .select('id, room_id, player_id, round_number, content, created_at, type, book_id')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
        if (fb.error) console.error('Rounds fallback error (no type):', fb.error)
        else roundsData = fb.data || []
      }

      const list = (roundsData as DrawingRoundRow[]) || []
      setDrawings(list)

      const nums = list.map(r => r.round_number).filter((n): n is number => typeof n === 'number')
      const roundNumber = nums.length ? Math.max(...nums) : null
      setCurrentRoundNumber(roundNumber)
    } finally {
      setLoadingDrawings(false)
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

      // Players (liste complète)
      const { data: playersData, error: pErr } = await supabase
        .from('players')
        .select('id, room_id, name, color, is_host')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      if (pErr) console.error('Players query error:', pErr)

      const list = (playersData as PlayerRow[]) || []
      setPlayers(list)

      // Figer le nombre de votants maintenant
      const expected = list.length
      setTotalPlayers(expected)
      expectedVotersRef.current = expected

      const me = list.find(p => String(p.id) === String(playerId)) || null
      setCurrentPlayer(me)

      // Drawings
      await fetchDrawings(roomData.id)

      // Mon vote éventuel
      if (playerId) {
        const mvq = supabase.from('votes').select('*').eq('room_id', roomData.id).eq('voter_id', playerId)
        const rr = await mvq.maybeSingle()
        if (rr.data) {
          setHasVoted(true)
          if ((rr.data as any).round_id) {
            setSelectedRoundId((rr.data as any).round_id)
          } else if ((rr.data as any).voted_for_id) {
            const match = drawings.find(d => String(d.player_id) === String((rr.data as any).voted_for_id))
            if (match) setSelectedRoundId(match.id)
          }
        }
      }

      // Compte initial des votes
      await checkVoteCount()
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
        .select('id')
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
    const expected = expectedVotersRef.current || totalPlayers || players.length || 0
    const pct = expected ? Math.min(100, (totalVotes / expected) * 100) : 0
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
        <Toaster position="top-center" />
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-black text-white mb-8">✅ Vote Submitted!</h1>
          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <div className="text-6xl mb-6">🎨</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Waiting for other players...</h2>
            <p className="text-gray-600 text-xl mb-8">
              {totalVotes} / {expected} players have voted
            </p>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-8">
              <div className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              {players.map(p => (
                <div key={String(p.id)} className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg opacity-40" style={{ backgroundColor: p.color || '#666' }}>
                  {p.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              ))}
            </div>
            {expected > 0 && totalVotes >= expected && (
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

        {loadingDrawings ? (
          <div className="text-center text-white/80 py-10">Loading drawings…</div>
        ) : drawings.length === 0 ? (
          <div className="text-center text-white/90 py-10">
            No drawings yet for this room. Please ensure the drawing round has completed.
          </div>
        ) : (
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
                    {d?.content ? <DrawingDisplay data={d.content as any} /> : <div className="p-8 text-center text-gray-500">No content</div>}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-gray-800 mb-2">By {getPlayerName(d.player_id)}</div>
                  {selectedRoundId === d.id && <div className="text-yellow-500 text-4xl">⭐</div>}
                </div>
              </button>
            ))}
          </div>
        )}

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