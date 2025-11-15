// app/room/[code]/combo-results/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import toast from 'react-hot-toast'

interface ComboResult {
  playerId: string
  playerName: string
  playerAvatar: string
  zone: any
  imageData: string
  prompt: string
}

export default function ComboResultsPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [finalCanvas, setFinalCanvas] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [individualResults, setIndividualResults] = useState<ComboResult[]>([])

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      console.log('📊 Loading combo chain results...')

      // Charger la room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError) throw roomError
      setRoom(roomData)

      // Charger les joueurs
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('joined_at', { ascending: true })

      if (playersError) throw playersError
      setPlayers(playersData || [])

      // Charger tous les dessins
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('round_number', 1)
        .eq('type', 'draw')

      console.log('Rounds loaded:', rounds)

      if (roundsError) throw roundsError

      // Récupérer le prompt et les résultats individuels
      if (rounds && rounds.length > 0) {
        const firstRound = rounds[0]
        setPrompt(firstRound.content?.prompt || 'Dessin collaboratif')

        // Combiner tous les dessins
        await combineDrawings(rounds)

        // Préparer les résultats individuels
        const results: ComboResult[] = rounds.map(round => {
          const player = playersData?.find(p => p.id === round.player_id)
          return {
            playerId: round.player_id,
            playerName: player?.name || 'Joueur',
            playerAvatar: player?.avatar || '👤',
            zone: round.content?.zone,
            imageData: round.content?.imageData,
            prompt: round.content?.prompt
          }
        })

        setIndividualResults(results)
      }

      setIsLoading(false)

    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
      setIsLoading(false)
    }
  }

  const combineDrawings = async (rounds: any[]) => {
    // Pour l'instant, on prend juste le premier dessin complet
    // Idéalement, on devrait combiner tous les dessins en un seul
    if (rounds.length > 0) {
      const firstDrawing = rounds[0].content?.imageData
      if (firstDrawing) {
        setFinalCanvas(firstDrawing)
      }
    }
  }

  const handleBackToLobby = async () => {
    if (!room) return

    try {
      // Réinitialiser la room
      await supabase
        .from('rooms')
        .update({ 
          status: 'lobby',
          current_round: 0
        })
        .eq('id', room.id)

      // Supprimer tous les rounds
      await supabase
        .from('rounds')
        .delete()
        .eq('room_id', room.id)

      // Réinitialiser les joueurs
      await supabase
        .from('players')
        .update({ is_ready: false })
        .eq('room_code', roomCode)

      router.push(`/room/${roomCode}/lobby`)
    } catch (error) {
      console.error('Error resetting room:', error)
      toast.error('Failed to reset room')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <div className="text-white text-2xl">Chargement des résultats...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            🤝 Résultats Combo Chain
          </h1>
          <p className="text-3xl text-yellow-300 font-bold mb-2">
            "{prompt}"
          </p>
          <p className="text-xl text-gray-300">
            Voici ce que vous avez créé ensemble !
          </p>
        </div>

        {/* Canvas final (tous les dessins) */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            🎨 Œuvre Collective
          </h2>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20">
            {/* Affichage de tous les dessins individuels en grille */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {individualResults.map((result) => (
                <div key={result.playerId} className="space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <span className="text-2xl">{result.playerAvatar}</span>
                    <span>{result.playerName}</span>
                    {result.zone && (
                      <span 
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: result.zone.color + '40', color: result.zone.color }}
                      >
                        Zone {result.zone.playerId === result.playerId ? 'assignée' : ''}
                      </span>
                    )}
                  </div>
                  
                  {result.imageData && (
                    <img 
                      src={result.imageData} 
                      alt={`Dessin de ${result.playerName}`}
                      className="w-full rounded-xl border-4 border-white shadow-2xl"
                      style={{ borderColor: result.zone?.color || '#FFFFFF' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-3xl font-bold text-white">{players.length}</div>
            <div className="text-gray-300">Artistes</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🎨</div>
            <div className="text-3xl font-bold text-white">{individualResults.length}</div>
            <div className="text-gray-300">Zones dessinées</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">⏱️</div>
            <div className="text-3xl font-bold text-white">{room?.round_time || 90}s</div>
            <div className="text-gray-300">Temps utilisé</div>
          </div>
        </div>

        {/* Actions */}
        <div className="text-center space-x-4">
          <button
            onClick={handleBackToLobby}
            className="px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold text-2xl text-white hover:scale-110 transition-transform shadow-2xl"
          >
            🔄 Rejouer
          </button>

          <button
            onClick={() => router.push('/')}
            className="px-12 py-4 bg-white/20 backdrop-blur-sm rounded-full font-bold text-2xl text-white hover:scale-110 transition-transform"
          >
            🏠 Accueil
          </button>
        </div>

      </div>
    </div>
  )
}