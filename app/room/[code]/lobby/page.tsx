// app/room/[code]/lobby/page.tsx - VERSION FINALE COMPLÈTE

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Player, Room, GameMode, GAME_MODE_CONFIGS } from '@/types/game'
import { PlayerList } from '@/components/PlayerList'
import { Chat } from '@/components/Chat'
import { ModeSelector } from '@/components/ModeSelector'
import toast, { Toaster } from 'react-hot-toast'

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()
  
  const [room, setLocalRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setLocalCurrentPlayer] = useState<Player | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Helper pour éviter les erreurs undefined
  const getModeConfig = (mode: string | undefined) => {
    if (!mode) return GAME_MODE_CONFIGS['classic']
    const gameMode = mode as GameMode
    return GAME_MODE_CONFIGS[gameMode] || GAME_MODE_CONFIGS['classic']
  }

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }

    if (!roomCode) {
      toast.error('Invalid room code')
      router.push('/')
      return
    }
    
    loadRoomData()

    // Polling toutes les 2 secondes pour actualiser
    pollingIntervalRef.current = setInterval(() => {
      loadRoomData(true)
    }, 2000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [playerId, roomCode])
  
  useEffect(() => {
    if (!room) return
    
    const cleanup = setupRealtimeSubscription()
    return cleanup
  }, [room?.id])
  
  const loadRoomData = async (silent = false) => {
    if (!silent) {
      console.log('📡 Loading room data for code:', roomCode)
    }
    
    try {
      // 1. Charger la room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()
      
      if (roomError || !roomData) {
        if (!silent) {
          console.error('❌ Room error:', roomError)
          toast.error('Room not found')
          setTimeout(() => router.push('/'), 2000)
        }
        return
      }
      
      setLocalRoom(roomData)
      
      // Vérifier si le jeu a démarré
      if (roomData.status === 'playing') {
        console.log('🎮 Game is starting! Redirecting...')
        handleGameStart(roomData.game_mode)
        return
      }
      
      // 2. Charger les joueurs
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('joined_at', { ascending: true })
      
      if (playersError) {
        console.error('❌ Players error:', playersError)
      }
      
      setPlayers(playersData || [])
      
      // 3. Trouver le joueur actuel
      const current = playersData?.find(p => p.id === playerId)
      
      if (current) {
        setLocalCurrentPlayer(current)
        setIsReady(current.is_ready || false)
      } else if (!silent) {
        console.error('❌ Current player not found in room')
        toast.error('Player not found in room')
      }

      if (!silent) {
        setIsLoading(false)
      }
      
    } catch (error) {
      if (!silent) {
        console.error('💥 Error loading room:', error)
        toast.error('Failed to load room')
        setIsLoading(false)
        setTimeout(() => router.push('/'), 2000)
      }
    }
  }
  
  const setupRealtimeSubscription = () => {
    console.log('🔌 Setting up realtime for room:', room?.id)
    
    const channel = supabase
      .channel(`room-${room?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('🔄 Players change:', payload)
          loadRoomData(true)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`
        },
        (payload) => {
          console.log('🔄 Room change:', payload)
          const updatedRoom = payload.new as Room
          
          if (updatedRoom && updatedRoom.status === 'playing') {
            console.log('🚀 Game starting via realtime!')
            handleGameStart(updatedRoom.game_mode)
          } else {
            loadRoomData(true)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime connected!')
        }
      })
    
    return () => {
      console.log('🔌 Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }

  const handleGameStart = (mode: GameMode) => {
    console.log('🎮 Redirecting to game mode:', mode)
    
    // Arrêter le polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    // Rediriger selon le mode
    switch (mode) {
      case 'cadavre-exquis':
        router.push(`/room/${roomCode}/cadavre-exquis`)
        break
      case 'combo-chain':
        router.push(`/room/${roomCode}/combo-chain`)
        break
      case 'pixel-perfect':
        router.push(`/room/${roomCode}/pixel-perfect`)
        break
      case 'morph-mode':
        router.push(`/room/${roomCode}/morph-mode`)
        break
      case 'battle-royale':
        router.push(`/room/${roomCode}/battle-royale`)
        break
      default:
        router.push(`/room/${roomCode}/game`)
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
      toast.success(newReadyState ? '✅ Prêt !' : '⏸️ Pas prêt')
      
      setTimeout(() => loadRoomData(true), 500)
      
    } catch (error) {
      console.error('Error updating ready state:', error)
      toast.error('Failed to update ready state')
    }
  }
  
  const handleModeChange = async (mode: GameMode) => {
    if (!currentPlayer?.is_host || !room) return
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ game_mode: mode })
        .eq('id', room.id)
      
      if (error) throw error
      
      toast.success(`Mode: ${getModeConfig(mode).name}`)
      
      setTimeout(() => loadRoomData(true), 500)
      
    } catch (error) {
      console.error('Error updating mode:', error)
      toast.error('Failed to change mode')
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
    console.log('🎮 Starting game...')
    
    try {
      const maxRounds = modeConfig.calculateRounds(players.length)
      
      console.log('📝 Updating room status to playing...')
      const { data, error } = await supabase
        .from('rooms')
        .update({ 
          status: 'playing',
          max_rounds: maxRounds,
          current_round: 1
        })
        .eq('id', room.id)
        .select()
      
      console.log('Update result:', { data, error })
      
      if (error) {
        console.error('❌ Error updating room:', error)
        throw error
      }
      
      console.log('✅ Game started successfully!')
      
      // Attendre un peu puis rediriger
      setTimeout(() => {
        console.log('🚀 Redirecting now...')
        handleGameStart(room.game_mode)
      }, 1000)
      
    } catch (error) {
      console.error('💥 Error starting game:', error)
      toast.error('Failed to start game')
      setIsStarting(false)
    }
  }
  
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    toast.success('Code copié !')
  }

  // LOADING STATE
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <div className="text-white text-2xl">Chargement...</div>
        </div>
      </div>
    )
  }

  // ERROR STATE
  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Erreur de chargement
          </h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white text-purple-600 rounded-full font-bold hover:scale-110 transition-transform"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }
  
  const modeConfig = getModeConfig(room.game_mode)
  const allReady = players.every(p => (p.is_ready || p.is_host))
  const canStart = currentPlayer.is_host && players.length >= modeConfig.minPlayers && allReady
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
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

        {/* Mode Selector - Seulement pour l'hôte */}
        {currentPlayer.is_host && (
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-xl mb-4 text-gray-800">
                🎮 Choisis le mode de jeu
              </h3>
              <ModeSelector 
                selectedMode={room.game_mode as GameMode}
                onSelectMode={handleModeChange}
              />
            </div>
          </div>
        )}

        {/* Affichage du mode pour les non-hôtes */}
        {!currentPlayer.is_host && (
          <div className="mb-8 p-6 bg-white rounded-xl shadow-lg text-center">
            <p className="text-gray-600 mb-2">Mode sélectionné par l'hôte :</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl">{modeConfig.emoji}</span>
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {modeConfig.name}
                </p>
                <p className="text-sm text-gray-600">
                  {modeConfig.description}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Liste des joueurs */}
          <div>
            <PlayerList players={players} currentPlayerId={currentPlayer.id} />
            
            {players.length < modeConfig.minPlayers && (
              <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-xl text-yellow-800 text-center">
                ⚠️ Minimum {modeConfig.minPlayers} joueurs requis !
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="space-y-4">
            
            {/* Ready button pour non-hôtes */}
            {!currentPlayer.is_host && (
              <button
                onClick={toggleReady}
                className={`w-full py-6 rounded-xl font-bold text-xl transition transform hover:scale-105 ${
                  isReady
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {isReady ? '✓ Prêt !' : 'Clique quand tu es prêt'}
              </button>
            )}
            
            {/* Start button pour l'hôte */}
            {currentPlayer.is_host && (
              <button
                onClick={startGame}
                disabled={!canStart || isStarting}
                className={`w-full py-6 rounded-xl font-bold text-xl transition transform hover:scale-105 ${
                  canStart
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {isStarting ? 'Démarrage...' : '🚀 Lancer la partie !'}
              </button>
            )}
            
            {/* Game info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Paramètres</h3>
              
              <div className="space-y-3 text-gray-700">
                <div className="flex justify-between">
                  <span>Joueurs:</span>
                  <span className="font-bold">{players.length} / {room.max_players}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temps/round:</span>
                  <span className="font-bold">{room.round_time}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Difficulté:</span>
                  <span className="font-bold">
                  {modeConfig.difficulty?.toUpperCase() || 'MOYEN'}
                  </span>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Chat */}
      {currentPlayer && room && (
        <Chat roomId={room.id} currentPlayer={currentPlayer} />
      )}
    </div>
  )
}