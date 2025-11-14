'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Round, Player, Room } from '@/types/game'
import { DrawingDisplay } from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [drawings, setDrawings] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  
  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    
    loadVotingData()
    setupRealtimeSubscription()
  }, [playerId])
  
  const loadVotingData = async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()
      
      if (roomError) throw roomError
      setRoom(roomData)
      
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
      
      setPlayers(playersData || [])
      
      // Load all drawings (type = 'draw')
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('type', 'draw')
        .order('created_at', { ascending: true })
      
      setDrawings(roundsData || [])
      
      // Check if already voted
      const { data: myVote } = await supabase
        .from('votes')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('voter_id', playerId)
        .single()
      
      if (myVote) {
        setHasVoted(true)
        setSelectedRoundId(myVote.round_id)
      }
      
      // Load vote counts
      loadVoteCounts(roomData.id)
      
    } catch (error) {
      console.error('Error loading voting data:', error)
    }
  }
  
  const loadVoteCounts = async (roomId: string) => {
    const { data: votes } = await supabase
      .from('votes')
      .select('round_id')
      .eq('room_id', roomId)
    
    const counts = new Map<string, number>()
    votes?.forEach(vote => {
      counts.set(vote.round_id, (counts.get(vote.round_id) || 0) + 1)
    })
    
    setVoteCounts(counts)
  }
  
  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`vote-${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes'
        },
        () => {
          if (room) {
            loadVoteCounts(room.id)
            checkIfVotingComplete()
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }
  
  const checkIfVotingComplete = async () => {
    if (!room) return
    
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
    
    if (count === players.length) {
      // Everyone voted, go to results
      setTimeout(() => {
        router.push(`/room/${roomCode}/results`)
      }, 2000)
    }
  }
  
  const submitVote = async () => {
    if (!selectedRoundId || !room || !playerId) return
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('votes')
        .insert({
          room_id: room.id,
          voter_id: playerId,
          round_id: selectedRoundId
        })
      
      if (error) throw error
      
      setHasVoted(true)
      toast.success('Vote submitted!')
      
      // Check if everyone voted
      checkIfVotingComplete()
      
    } catch (error) {
      console.error('Error voting:', error)
      toast.error('Failed to vote')
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
            <p className="text-gray-600 text-xl">
              {voteCounts.size} / {players.length} players have voted
            </p>
            
            <div className="mt-8 flex justify-center gap-2">
              {players.map(player => {
                const voted = Array.from(voteCounts.values()).reduce((a, b) => a + b, 0) >= players.indexOf(player) + 1
                return (
                  <div
                    key={player.id}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      voted ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    style={{ backgroundColor: voted ? player.color : undefined }}
                  >
                    {player.name.charAt(0)}
                  </div>
                )
              })}
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
          {drawings.map((drawing) => (
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