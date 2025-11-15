'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useGameStore } from '@/lib/store'
import { Round, DrawingContent, PromptContent, Room, Player } from '@/types/game'
import { calculateRoundAssignments } from '@/lib/game-logic'
import { Canvas } from '@/components/Canvas'
import { PromptInput } from '@/components/PromptInput'
import { Timer } from '@/components/Timer'
import { WaitingScreen } from '@/components/WaitingScreen'
import toast, { Toaster } from 'react-hot-toast'
import { GameModeInfo } from '@/components/GameModeInfo'
import { calculateModeSpecificAssignments } from '@/lib/game-logic-modes'
import { GameMode } from '@/types/game'

type Assignment = {
  bookId: string
  type: 'prompt' | 'draw' | 'describe'
  previousRound?: Round
}

export default function GamePage() {
  const params = useParams()
  const router = useRouter()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [waitingForPlayers, setWaitingForPlayers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  
  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    
    loadGameData()
  }, [playerId])
  
  useEffect(() => {
    if (!room) return
    
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [room?.id])
  
  useEffect(() => {
    if (rounds.length >= 0 && room && players.length > 0 && currentPlayer) {
      calculateCurrentAssignment()
      checkIfRoundComplete()
    }
  }, [rounds, room, players, currentPlayer])
  
  const loadGameData = async () => {
    console.log('📥 Loading game data...')
    
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()
      
      if (roomError) throw roomError
      
      console.log('🏠 Room loaded:', roomData)
      
      if (roomData.status !== 'playing') {
        console.log('⚠️ Room not playing, redirecting')
        router.push(`/room/${roomCode}/lobby`)
        return
      }
      
      setRoom(roomData)
      
      // ✅ APRÈS
      const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .order('joined_at', { ascending: true })
      
      if (playersError) throw playersError
      
      console.log('👥 Players loaded:', playersData)
      setPlayers(playersData)
      
      const current = playersData.find(p => p.id === playerId)
      if (current) {
        console.log('👤 Current player:', current)
        setCurrentPlayer(current)
      } else {
        console.error('❌ Current player not found!')
        router.push('/')
        return
      }
      
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      
      if (roundsError) throw roundsError
      
      console.log('📝 Rounds loaded:', roundsData)
      setRounds(roundsData || [])
      
      setIsLoading(false)
      
    } catch (error) {
      console.error('Error loading game:', error)
      toast.error('Failed to load game')
      setIsLoading(false) // Laisse l'écran d'erreur s’afficher
    }
  }
  
  const setupRealtimeSubscription = () => {
    console.log('🔌 Setting up game realtime')
    
    const channel = supabase
      .channel(`game-${room?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rounds',
          filter: `room_id=eq.${room?.id}`
        },
        (payload) => {
          console.log('➕ Round added:', payload.new)
          setRounds(prev => [...prev, payload.new as Round])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room?.id}`
        },
        (payload) => {
          console.log('🔄 Room updated:', payload.new)
          const updatedRoom = payload.new as Room
          setRoom(updatedRoom)
          
          if (updatedRoom.status === 'voting') {
            console.log('🗳️ Voting time!')
            router.push(`/room/${roomCode}/vote`)
          } else if (updatedRoom.status === 'results') {
            console.log('🎉 Game finished, going to results')
            router.push(`/room/${roomCode}/results`)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Game subscription status:', status)
      })
    
    return () => {
      console.log('🔌 Cleaning up game subscription')
      supabase.removeChannel(channel)
    }
  }
  
  const calculateCurrentAssignment = () => {
    if (!room || !currentPlayer) return
    
    // Si c'est un mode spécial, utiliser la logique spécifique
    if (room.game_mode !== 'classic') {
      const modeAssignments = calculateModeSpecificAssignments(
        room.game_mode as GameMode,
        players,
        room.current_round,
        rounds
      )
      
      const myAssignment = modeAssignments.get(currentPlayer.id)
      if (myAssignment) {
        console.log('🎯 My mode-specific assignment:', myAssignment)
        setCurrentAssignment(myAssignment)
        
        const myRound = rounds.find(
          r => r.player_id === currentPlayer.id && 
               r.round_number === room.current_round
        )
        
        setHasSubmitted(!!myRound)
      }
      return
    }
    
    // Logique classic mode (existante)
    const assignments = calculateRoundAssignments(
      players,
      room.current_round,
      rounds
    )
    
    const myAssignment = assignments.get(currentPlayer.id)
    if (myAssignment) {
      console.log('🎯 My assignment:', myAssignment)
      setCurrentAssignment(myAssignment)
      
      const myRoundForThisBook = rounds.find(
        r => r.book_id === myAssignment.bookId && 
             r.round_number === room.current_round &&
             r.player_id === currentPlayer.id
      )
      
      setHasSubmitted(!!myRoundForThisBook)
    }
  }
  
  const checkIfRoundComplete = () => {
    if (!room) return
    
    const currentRoundSubmissions = rounds.filter(
      r => r.round_number === room.current_round
    )
    
    const submittedPlayerIds = currentRoundSubmissions.map(r => r.player_id)
    const waiting = players
      .filter(p => !submittedPlayerIds.includes(p.id))
      .map(p => p.id)
    
    setWaitingForPlayers(waiting)
    
    if (waiting.length === 0 && currentRoundSubmissions.length === players.length && currentPlayer?.is_host) {
      console.log('✅ Round complete! Advancing...')
      advanceRound()
    }
  }
  
  const advanceRound = async () => {
    if (!room || !currentPlayer?.is_host) return
    
    const nextRound = room.current_round + 1
    
    try {
      if (nextRound >= room.max_rounds) {
        console.log('🎊 Game finished! Going to vote...')
        await supabase
          .from('rooms')
          .update({ status: 'voting' })
          .eq('id', room.id)
      } else {
        console.log(`⏭️ Advancing to round ${nextRound}`)
        await supabase
          .from('rooms')
          .update({ current_round: nextRound })
          .eq('id', room.id)
        
        setHasSubmitted(false)
      }
    } catch (error) {
      console.error('Error advancing round:', error)
    }
  }
  
  const handleSubmitPrompt = async (content: PromptContent) => {
    if (!currentAssignment || !room || !currentPlayer) return
    
    console.log('📤 Submitting prompt:', content)
    
    try {
      const { error } = await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: currentAssignment.bookId,
          round_number: room.current_round,
          player_id: currentPlayer.id,
          type: currentAssignment.type,
          content: content
        })
      
      if (error) throw error
      
      setHasSubmitted(true)
      toast.success('Submitted!')
    } catch (error) {
      console.error('Error submitting:', error)
      toast.error('Failed to submit')
    }
  }
  
  const handleSubmitDrawing = async (content: DrawingContent) => {
    if (!currentAssignment || !room || !currentPlayer) return
    
    console.log('📤 Submitting drawing')
    
    try {
      const { error } = await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: currentAssignment.bookId,
          round_number: room.current_round,
          player_id: currentPlayer.id,
          type: currentAssignment.type,
          content: content
        })
      
      if (error) throw error
      
      setHasSubmitted(true)
      toast.success('Drawing submitted!')
    } catch (error) {
      console.error('Error submitting:', error)
      toast.error('Failed to submit drawing')
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading game...</div>
      </div>
    )
  }
  
  if (!room || !currentPlayer || !currentAssignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Initializing...</div>
      </div>
    )
  }
  
  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
        <Toaster position="top-center" />
        
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-white mb-2">
              Round {room.current_round + 1} / {room.max_rounds}
            </h1>
            <p className="text-white text-xl">Great job! ✨</p>
          </div>
          
          <WaitingScreen 
            players={players} 
            waitingFor={waitingForPlayers}
          />
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            Round {room.current_round + 1} / {room.max_rounds}
          </h1>
          <GameModeInfo 
            gameMode={room.game_mode as GameMode} 
            currentRound={room.current_round} 
          />
          
          <Timer 
            duration={room.round_time}
            onComplete={() => {
              if (!hasSubmitted) {
                toast.error("Time's up!")
                if (currentAssignment.type === 'prompt' || currentAssignment.type === 'describe') {
                  handleSubmitPrompt({ text: '...' })
                } else {
                  handleSubmitDrawing({ strokes: [], width: 800, height: 600 })
                }
              }
            }}
          />
        </div>
        
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {currentAssignment.type === 'prompt' && (
            <PromptInput
              type="prompt"
              onComplete={handleSubmitPrompt}
            />
          )}
          
          {currentAssignment.type === 'draw' && currentAssignment.previousRound && (
            <div>
              <div className="text-center mb-6">
                <div className="inline-block bg-yellow-100 border-2 border-yellow-400 rounded-xl px-6 py-3">
                  <div className="text-sm text-yellow-700 mb-1">Draw this:</div>
                  <div className="text-2xl font-bold text-yellow-900">
                    &quot;{(currentAssignment.previousRound.content as PromptContent).text}&quot;
                  </div>
                </div>
              </div>
              
              <Canvas onComplete={handleSubmitDrawing} />
            </div>
          )}
          
          {currentAssignment.type === 'describe' && currentAssignment.previousRound && (
            <PromptInput
              type="describe"
              onComplete={handleSubmitPrompt}
              reference={currentAssignment.previousRound.content}
            />
          )}
        </div>
      </div>
    </div>
  )
}