'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Player, Room } from '@/types/game'
import { PlayerList } from '@/components/PlayerList'
import { GameSettings } from '@/components/GameSettings'
import { Chat } from '@/components/Chat'
import toast, { Toaster } from 'react-hot-toast'

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  
  const [room, setLocalRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setLocalCurrentPlayer] = useState<Player | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  
  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    
    loadRoomData()
  }, [playerId])
  
  useEffect(() => {
    if (!room) return
    
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [room?.id])
  
  const loadRoomData = async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()
      
      if (roomError) throw roomError
      setLocalRoom(roomData)
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      
      if (playersError) throw playersError
      setPlayers(playersData)
      
      const current = playersData.find(p => p.id === playerId)
      if (current) {
        setLocalCurrentPlayer(current)
        setIsReady(current.is_ready)
      }
    } catch (error) {
      console.error('Error loading room:', error)
      toast.error('Failed to load room')
      router.push('/')
    }
  }
  
  const setupRealtimeSubscription = () => {
    console.log('🔌 Setting up realtime for room:', room?.id)
    
    const channel = supabase
      .channel(`room-${room?.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room?.id}`
        },
        (payload) => {
          console.log('➕ Player joined:', payload.new)
          const newPlayer = payload.new as Player
          
          setPlayers(prev => {
            if (prev.find(p => p.id === newPlayer.id)) {
              return prev
            }
            return [...prev, newPlayer]
          })
          
          toast.success(`${newPlayer.name} joined!`)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room?.id}`
        },
        (payload) => {
          console.log('➖ Player left:', payload.old)
          const oldPlayer = payload.old as Player
          
          setPlayers(prev => prev.filter(p => p.id !== oldPlayer.id))
          toast(`${oldPlayer.name} left`)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room?.id}`
        },
        (payload) => {
          console.log('🔄 Player updated:', payload.new)
          const updatedPlayer = payload.new as Player
          
          setPlayers(prev => prev.map(p => 
            p.id === updatedPlayer.id ? updatedPlayer : p
          ))
          
          if (updatedPlayer.id === playerId) {
            setLocalCurrentPlayer(updatedPlayer)
            setIsReady(updatedPlayer.is_ready)
          }
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
          console.log('🎮 Room updated:', payload.new)
          const updatedRoom = payload.new as Room
          
          setLocalRoom(updatedRoom)
          
          if (updatedRoom.status === 'playing') {
            console.log('🚀 Redirecting to game...')
            router.push(`/room/${roomCode}/game`)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
      })
    
    return () => {
      console.log('🔌 Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }
  
  const toggleReady = async () => {
    if (!currentPlayer || !room) return
    
    const newReadyState = !isReady
    
    try {
      const { error } = await supabase
        .from('players')
        .update({ is_ready: newReadyState })
        .eq('id', currentPlayer.id)
      
      if (error) throw error
      
      setIsReady(newReadyState)
    } catch (error) {
      console.error('Error updating ready state:', error)
      toast.error('Failed to update ready state')
    }
  }
  
  const startGame = async () => {
    if (!currentPlayer?.is_host || !room) return
  
    const modeConfig = getModeConfig(room.game_mode)
  
    if (players.length < modeConfig.minPlayers) {
      toast.error(`Minimum ${modeConfig.minPlayers} joueurs requis !`)
      return
    }
  
    const allReady = players.every(p => p.is_ready || p.is_host)
    if (!allReady) {
      toast.error('Tous les joueurs doivent être prêts !')
      return
    }
  
    setIsStarting(true)
  
    try {
      // 1) Reset des rounds pour cette room
      await supabase.from('rounds').delete().eq('room_id', room.id)
  
      // 2) Démarrer à round 0 (il faut commencer par PROMPT)
      const maxRounds = modeConfig.calculateRounds(players.length)
  
      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'playing',
          max_rounds: maxRounds,
          current_round: 0 // ← round 0 = prompt
        })
        .eq('id', room.id)
  
      if (error) throw error
      // Realtime s’occupe de rediriger
  
    } catch (error) {
      console.error('Error starting game:', error)
      toast.error('Failed to start game')
      setIsStarting(false)
    }
  }
  
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    toast.success('Room code copied!')
  }
  
  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }
  
  const allReady = players.every(p => p.is_ready || p.is_host)
  const canStart = currentPlayer.is_host && players.length >= 3 && allReady
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-4">
            Game Lobby
          </h1>
          
          <div className="inline-block bg-white rounded-2xl shadow-xl p-6">
            <div className="text-sm text-gray-600 mb-2">Room Code</div>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-black tracking-wider text-gray-800">
                {roomCode}
              </div>
              <button
                onClick={copyRoomCode}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <PlayerList players={players} currentPlayerId={currentPlayer.id} />
            
            {players.length < 3 && (
              <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl text-yellow-800 text-center">
                ⚠️ Need at least 3 players to start!
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            {/* Settings Button */}
            <GameSettings room={room} isHost={currentPlayer.is_host} />
            
            {!currentPlayer.is_host && (
              <button
                onClick={toggleReady}
                className={`w-full py-6 rounded-xl font-bold text-xl transition transform hover:scale-105 ${
                  isReady
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {isReady ? '✓ Ready!' : 'Click when Ready'}
              </button>
            )}
            
            {currentPlayer.is_host && (
              <button
                onClick={startGame}
                disabled={!canStart || isStarting}
                className="w-full py-6 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl font-bold text-xl hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105"
              >
                {isStarting ? 'Starting...' : '🚀 Start Game!'}
              </button>
            )}
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Game Settings</h3>
              
              <div className="space-y-3 text-gray-700">
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span className="font-bold">{players.length} / {room.max_players}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time per round:</span>
                  <span className="font-bold">{room.round_time}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Total rounds:</span>
                  <span className="font-bold">{players.length}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-100 rounded-xl p-6">
              <h3 className="font-bold text-purple-900 mb-3">How to Play:</h3>
              <ol className="text-sm text-purple-800 space-y-2 list-decimal list-inside">
                <li>Round 1: Everyone writes a sentence</li>
                <li>Round 2: Draw the sentence you receive</li>
                <li>Round 3: Describe the drawing you see</li>
                <li>Repeat until all rounds done!</li>
                <li>See the hilarious evolution! 😂</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Component */}
      {currentPlayer && <Chat roomId={room.id} currentPlayer={currentPlayer} />}
    </div>
  )
}