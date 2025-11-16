'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Round, Player, Room } from '@/types/game'
import DrawingDisplay from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [drawings, setDrawings] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  
  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadVotingData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])
  
  useEffect(() => {
    if (!room) return
    
    const interval = setInterval(() => {
      checkRoomStatus()
      checkVoteCount()
    }, 2000)
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, currentRoundNumber])
  
  const checkRoomStatus = async () => {
    if (!room) return
    
    const { data: roomData } = await supabase
      .from('rooms')
      .select('status')
      .eq('id', room.id)
      .single()
    
    if (roomData && (roomData.status === 'results' || roomData.status === 'finished')) {
      console.log('🏆 Room status changed to results, redirecting...')
      router.push(`/room/${roomCode}/results`)
    }
  }
  
  const checkVoteCount = async () => {
    if (!room) return
    
    const query = supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('room_code', room.code)
    if (typeof currentRoundNumber === 'number') {
      query.eq('round_number', currentRoundNumber)
    }
    const { count } = await query
    
    const votesCount = count ?? 0
    setTotalVotes(votesCount)
    
    console.log(`📊 Votes: ${votesCount} / ${players.length}`)
    
    if (votesCount === players.length && currentPlayer?.is_host) {
      console.log('✅ Everyone voted! Host changing status...')
      
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'results' })
        .eq('id', room.id)
      
      if (error) {
        console.error('Error updating room status:', error)
      } else {
        console.log('✅ Status changed to results')
        setTimeout(() => {
          router.push(`/room/${roomCode}/results`)
        }, 1000)
      }
    }
  }
  
  const loadVotingData = async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()
      
      if (roomError) throw roomError
      
      console.log('📊 Room loaded:', roomData)
      
      if (roomData.status === 'results' || roomData.status === 'finished') {
        console.log('🏆 Already on results, redirecting...')
        router.push(`/room/${roomCode}/results`)
        return
      }
      
      setRoom(roomData)
      
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      
      setPlayers(playersData || [])
      
      const current = playersData?.find(p => p.id === playerId)
      if (current) {
        setCurrentPlayer(current)
      }
      
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('id, player_id, round_number, content, created_at, type') // IMPORTANT
        .eq('room_id', roomData.id)
        .eq('type', 'draw')
        .order('created_at', { ascending: true })

      setDrawings(roundsData || [])
      
      // Déterminer le numéro de round courant (max des dessins)
      const numbers = (roundsData || [])
        .map((r: any) => r?.round_number)
        .filter((n: any) => typeof n === 'number')
      const roundNumber = numbers.length ? Math.max(...numbers) : null
      setCurrentRoundNumber(roundNumber)
      
      // Mon vote (room_code + round_number si connu)
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
          // Si round_id est présent, sélectionne ce dessin. Sinon, retrouve-le via voted_for_id
          if ((myVote as any).round_id) {
            setSelectedRoundId((myVote as any).round_id)
          } else {
            const match = (roundsData || []).find((d: any) =>
              d.player_id === (myVote as any).voted_for_id &&
              (typeof (myVote as any).round_number === 'number'
                ? d.round_number === (myVote as any).round_number
                : true)
            )
            if (match) setSelectedRoundId(match.id)
          }
        }
      }
      
      // Compter les votes initiaux
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
      // Récupère le dessin sélectionné
      let selected: any = (drawings as any[]).find(d => d.id === selectedRoundId)
  
      // Si on ne l’a pas en mémoire ou champs manquants → refetch précis
      if (!selected || typeof selected.player_id !== 'string' || typeof selected.round_number !== 'number') {
        const { data: roundRow, error: rrErr } = await supabase
          .from('rounds')
          .select('id, player_id, round_number')
          .eq('id', selectedRoundId)
          .single()
        if (rrErr) throw rrErr
        selected = roundRow
      }
  
      const votedForId: string | undefined = selected?.player_id
      const roundNumberFinal: number | undefined = selected?.round_number
  
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
  
      // Optionnel: empêcher de voter pour soi
      if (votedForId === playerId) {
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
  
      // Log pour vérifier qu’il n’y a aucun null
      const payload = {
        room_code: room.code,
        round_number: roundNumberFinal,
        voter_id: playerId,
        voted_for_id: votedForId,
        round_id: selectedRoundId, // si la colonne existe
      }
      console.log('🔎 Vote payload:', payload)
  
      // Insert du vote
      const { error } = await supabase
        .from('votes')
        .insert(payload)
  
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
  
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown'
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
          <h1 className="text-5xl font-black text-white mb-8">
            ✅ Vote Submitted!
          </h1>
          
          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <div className="text-6xl mb-6">🎨</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Waiting for other players...
            </h2>
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
              {players.map((player) => (
                <div
                  key={player.id}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg opacity-40"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            
            {totalVotes === players.length && (
              <div className="mt-8 text-green-600 font-bold text-2xl animate-bounce">
                🎉 Everyone voted! Loading results...
              </div>
            )}
            
            <div className="mt-6 text-sm text-gray-400">
              Checking every 2 seconds...
            </div>
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
          <h1 className="text-5xl font-black text-white mb-4">
            🎨 Vote for the Best Drawing!
          </h1>
          <p className="text-white text-xl">
            Choose your favorite masterpiece
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {drawings.map((drawing: any) => (
            <button
              key={drawing.id}
              onClick={() => setSelectedRoundId(drawing.id)}
              className={`bg-white rounded-2xl shadow-xl p-6 transition transform hover:scale-105 ${
                selectedRoundId === drawing.id
                  ? 'ring-4 ring-yellow-400 scale-105'
                  : ''
              }`}
            >
              <div className="mb-4">
                <div className="border-4 border-gray-800 rounded-xl overflow-hidden">
                  <DrawingDisplay data={drawing.content as any} />
                </div>
              </div>
              
              <div className="text-center">
                <div className="font-bold text-gray-800 mb-2">
                  By {getPlayerName(drawing.player_id)}
                </div>
                
                {selectedRoundId === drawing.id && (
                  <div className="text-yellow-500 text-4xl">
                    ⭐
                  </div>
                )}
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