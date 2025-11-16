'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Player, Room, GameMode, GAME_MODE_CONFIGS } from '@/types/game'
import { PlayerList } from '@/components/PlayerList'
import { Chat } from '@/components/Chat'
import { ModeSelector } from '@/components/ModeSelector'
import toast, { Toaster } from 'react-hot-toast'

// Helper safe pour récupérer la config d’un mode
function getModeConfig(mode?: string) {
  const key = (mode as GameMode) || 'classic'
  return GAME_MODE_CONFIGS[key] ?? GAME_MODE_CONFIGS['classic']
}

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!playerId) {
      router.replace('/')
      return
    }
    if (!roomCode) {
      toast.error('Invalid room code')
      router.replace('/')
      return
    }

    loadRoomData()

    // Polling sauvegarde si le realtime est capricieux
    pollingRef.current = setInterval(() => {
      loadRoomData(true)
    }, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, roomCode])

  useEffect(() => {
    if (!room) return
    const cleanup = setupRealtimeSubscription()
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id])

  const loadRoomData = async (silent = false) => {
    const code = (roomCode || '').trim().toUpperCase()
    try {
      if (!silent) console.log('📡 Loading room data for code:', code)

      // Room par code
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (roomError || !roomData) {
        if (!silent) toast.error('Room not found')
        setIsLoading(false)
        return
      }

      setLocalRoom(roomData)

      // Players par room_code (pas room_id)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', code)
        .order('joined_at', { ascending: true })

      if (playersError) {
        if (!silent) toast.error('Failed to load players')
        setIsLoading(false)
        return
      }

      setPlayers(playersData || [])

      const id = sessionStorage.getItem('playerId')
      if (!id) {
        if (!silent) toast.error('You are not in this room')
        setIsLoading(false)
        return
      }

      const me = (playersData || []).find(p => p.id === id)
      if (!me) {
        if (!silent) toast.error('Player not found in this room')
        setIsLoading(false)
        return
      }

      setLocalCurrentPlayer(me)
      setIsReady(!!me.is_ready)
      setIsLoading(false)
    } catch (error: any) {
      console.error('💥 loadRoomData exception:', error)
      if (!silent) toast.error(`Failed to load room: ${error.message || 'Unknown error'}`)
      setIsLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    console.log('🔌 Setting up realtime for room:', room?.id)

    const channel = supabase
      .channel(`room-${room?.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` },
        () => {
          // Recharge
          loadRoomData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
          const updatedRoom = payload.new as Room
          setLocalRoom(updatedRoom)

          if (updatedRoom.status === 'playing') {
            handleGameStart(updatedRoom.game_mode as GameMode)
          } else {
            loadRoomData(true)
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

  const handleGameStart = (mode: GameMode) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    switch (mode) {
      case 'cadavre-exquis':
        router.replace(`/room/${roomCode}/cadavre-exquis`)
        break
      case 'combo-chain':
        router.replace(`/room/${roomCode}/combo-chain`)
        break
      case 'pixel-perfect':
        router.replace(`/room/${roomCode}/pixel-perfect`)
        break
      case 'morph-mode':
        router.replace(`/room/${roomCode}/morph-mode`)
        break
      case 'battle-royale':
        router.replace(`/room/${roomCode}/battle-royale`)
        break
      default:
        router.replace(`/room/${roomCode}/game`)
        break
    }
  }

  const toggleReady = async () => {
    if (!currentPlayer || !room) return

    const newReady = !isReady
    try {
      const { error } = await supabase
        .from('players')
        .update({ is_ready: newReady })
        .eq('id', currentPlayer.id)

      if (error) throw error

      setIsReady(newReady)
      toast.success(newReady ? '✅ Prêt !' : '⏸️ Pas prêt')

      setTimeout(() => loadRoomData(true), 400)
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

      const cfg = getModeConfig(mode)
      toast.success(`Mode: ${cfg.name}`)

      setTimeout(() => loadRoomData(true), 400)
    } catch (error) {
      console.error('Error updating mode:', error)
      toast.error('Failed to change mode')
    }
  }

  const startGame = async () => {
    if (!currentPlayer?.is_host || !room) return

    const cfg = getModeConfig(room.game_mode)

    if (players.length < cfg.minPlayers) {
      toast.error(`Minimum ${cfg.minPlayers} joueurs requis !`)
      return
    }

    const allReady = players.every(p => (p.is_ready ?? false) || p.is_host)
    if (!allReady) {
      toast.error('Tous les joueurs doivent être prêts !')
      return
    }

    setIsStarting(true)
    try {
      // 1) Reset des rounds pour cette room (évite conflits de parties précédentes)
      await supabase.from('rounds').delete().eq('room_id', room.id)

      // 2) Démarrer à round 0 (Classic: prompts au round 0)
      const maxRounds = cfg.calculateRounds(players.length)

      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'playing',
          max_rounds: maxRounds,
          current_round: 0
        })
        .eq('id', room.id)

      if (error) throw error

      // Realtime redirigera selon le mode
    } catch (error) {
      console.error('Error starting game:', error)
      toast.error('Failed to start game')
      setIsStarting(false)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    toast.success('Code copié !')
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Toaster />
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <div className="text-white text-2xl">Chargement...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Toaster />
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Failed to load room
          </h1>
          <button
            onClick={() => router.replace('/')}
            className="px-6 py-3 bg-white text-purple-600 rounded-full font-bold hover:scale-110 transition-transform"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  const modeConfig = getModeConfig(room.game_mode)
  const allReady = players.every(p => (p.is_ready ?? false) || p.is_host)
  const canStart = currentPlayer.is_host && players.length >= modeConfig.minPlayers && allReady

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-4">Game Lobby</h1>

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

        {/* Mode Selector */}
        {currentPlayer.is_host ? (
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
        ) : (
          <div className="mb-8 p-6 bg-white rounded-xl shadow-lg text-center">
            <p className="text-gray-600 mb-2">Mode sélectionné par l'hôte :</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl">{modeConfig.emoji}</span>
              <div>
                <p className="text-2xl font-bold text-gray-800">{modeConfig.name}</p>
                <p className="text-sm text-gray-600">{modeConfig.description}</p>
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
                    {(modeConfig.difficulty?.toUpperCase() ?? 'MOYEN')}
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