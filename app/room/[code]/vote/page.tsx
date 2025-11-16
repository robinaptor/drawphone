'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Round, Player, Room } from '@/types/game'
import DrawingDisplay from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'

// Type local: les champs nécessaires pour l'écran vote
type DrawingRound = Pick<
  Round,
  'id' | 'room_id' | 'player_id' | 'round_number' | 'content' | 'created_at' | 'type' | 'book_id'
>

export default function VotePage() {
  const params = useParams()
  const router = useRouter()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [drawings, setDrawings] = useState<DrawingRound[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  // Map rapide id -> nom pour éviter "Unknown"
  const playersNameMap = useMemo(() => {
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

  // Poll status + count
  useEffect(() => {
    if (!room) return
    const interval = setInterval(() => {
      checkRoomStatus()
      checkVoteCount()
    }, 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, currentRoundNumber, players.length, currentPlayer?.is_host])

  const checkRoomStatus = async () => {
    if (!room) return
    const { data: roomData } = await supabase
      .from('rooms')
      .select('status')
      .eq('id', room.id)
      .single()

    if (roomData && (roomData.status === 'results' || roomData.status === 'finished')) {
      router.push(`/room/${roomCode}/results`)
    }
  }

  const checkVoteCount = async () => {
    if (!room) return

    const q = supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('room_code', room.code)

    if (typeof currentRoundNumber === 'number') {
      q.eq('round_number', currentRoundNumber)
    }

    const { count } = await q
    const votesCount = count ?? 0
    setTotalVotes(votesCount)

    if (votesCount === players.length && currentPlayer?.is_host) {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'results' })
        .eq('id', room.id)
      if (!error) {
        setTimeout(() => router.push(`/room/${roomCode}/results`), 800)
      }
    }
  }

  const loadVotingData = async () => {
    try {
      // Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
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
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      setPlayers(playersData || [])

      const me = playersData?.find(p => String(p.id) === String(playerId)) || null
      setCurrentPlayer(me)

      // Drawings (sélectionne explicitement les champs nécessaires)
      const { data: roundsData, error: rErr } = await supabase
        .from('rounds')
        .select('id, room_id, player_id, round_number, content, created_at, type, book_id')
        .eq('room_id', roomData.id)
        .eq('type', 'draw')
        .order('created_at', { ascending: true })
      if (rErr) throw rErr

      setDrawings((roundsData as DrawingRound[]) || [])

      // Détermine le round courant (max des round_number)
      const numbers = ((roundsData as DrawingRound[]) || [])
        .map(r => r?.round_number)
        .filter((n): n is number => typeof n === 'number')
      const roundNumber = numbers.length ? Math.max(...numbers) : null
      setCurrentRoundNumber(roundNumber)

      // Mon vote (room_code + round_number)
      if (playerId) {
        const mvq = supabase
          .from('votes')
          .select('*')
          .eq('room_code', roomData.code)
          .eq('voter_id', playerId)

        if (typeof roundNumber === 'number') {
          mvq.eq('round_number', roundNumber)
        }

        const { data: myVote } = await mvq.maybeSingle()

        if (myVote) {
          setHasVoted(true)
          // si round_id existe, sélectionne-le, sinon retrouve via voted_for_id + round_number
          if ((myVote as any).round_id) {
            setSelectedRoundId((myVote as any).round_id)
          } else {
            const match = ((roundsData as DrawingRound[]) || []).find(
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

      // Count initial
      const cq = supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomData.code)
      if (typeof roundNumber === 'number') {
        cq.eq('round_number', roundNumber)
      }
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
      // Dessin sélectionné (depuis l'état)
      let selected = drawings.find(d => d.id === selectedRoundId)

      // Si champs manquants → refetch ciblé
      if (!selected || typeof selected.player_id !== 'string' || typeof selected.round_number !== 'number') {
        const { data: roundRow, error: rrErr } = await supabase
          .from('rounds')
          .select('id, room_id, player_id, round_number')
          .eq('id', selectedRoundId)
          .single()
        if (rrErr) throw rrErr
        selected = roundRow as DrawingRound
      }

      const votedForId = selected?.player_id
      const roundNumberFinal = selected?.round_number

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

      // Empêcher de voter pour soi (optionnel)
      if (String(votedForId) === String(playerId)) {
        toast.error("You can't vote for yourself")
        setIsSubmitting(false)
        return
      }

      // Déjà voté pour CE round ?
      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('room_code', room.code)
        .eq('round_number', roundNumberFinal)
        .eq('voter_id', playerId)
        .maybeSingle()

      if (existingVote) {
        toast.error('You already voted!')
        setHasVoted(true)
        setIsSubmitting(false)
        return
      }

      // Payload complet (aucun champ NULL)
      const payload = {
        room_code: room.code,
        round_number: roundNumberFinal,
        voter_id: playerId,
        voted_for_id: votedForId,
        round_id: selectedRoundId, // si cette colonne existe dans votes
      }
      console.log('🔎 Vote payload:', payload)

      const { error } = await supabase.from('votes').insert(payload)
      if (error) {
        console.error('Vote error details:', error)
        throw error
      }

      setHasVoted(true)
      setCurrentRoundNumber(prev => (typeof prev === 'number' ? prev : roundNumberFinal))
      toast.success('Vote submitted!')

      setTimeout(() => {
        checkVoteCount()
      }, 500)
    } catch (error: any) {
      console.error('Error voting:', error)
      toast.error(error?.message || 'Failed to vote')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPlayerName = (pid: string) => {
    const name = playersNameMap.get(String(pid))
    if (!name) {
      // aide debug si "Unknown"
      // console.debug('Unknown player id in drawings:', pid, 'players:', players.map(p => p.id))
    }
    return name || 'Unknown'
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }

  if (hasVoted) {
    const progressPct = players.length ? Math.min(100, (totalVotes / players.length) * 100) : 0

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
        <Toaster position="top-center" />

        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-black text-white mb-8">✅ Vote Submitted!</h1>

          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <div className="text-6xl mb-6">🎨</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Waiting for other players...</h2>
            <p className="text-gray-600 text-xl mb-8">
              {totalVotes} / {players.length} players have voted
            </p>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-8">
              <div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {players.map(player => (
                <div
                  key={String(player.id)}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg opacity-40"
                  style={{ backgroundColor: (player as any).color }}
                >
                  {player.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              ))}
            </div>

            {totalVotes === players.length && (
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
          {drawings.map(drawing => (
            <button
              key={drawing.id}
              onClick={() => setSelectedRoundId(drawing.id)}
              className={`bg-white rounded-2xl shadow-xl p-6 transition transform hover:scale-105 ${
                selectedRoundId === drawing.id ? 'ring-4 ring-yellow-400 scale-105' : ''
              }`}
            >
              <div className="mb-4">
                <div className="border-4 border-gray-800 rounded-xl overflow-hidden">
                  <DrawingDisplay data={drawing.content as any} />
                </div>
              </div>

              <div className="text-center">
                <div className="font-bold text-gray-800 mb-2">By {getPlayerName(drawing.player_id as any)}</div>

                {selectedRoundId === drawing.id && <div className="text-yellow-500 text-4xl">⭐</div>}
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