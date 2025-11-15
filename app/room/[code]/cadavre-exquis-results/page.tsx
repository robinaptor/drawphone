// app/room/[code]/cadavre-exquis-results/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import toast from 'react-hot-toast'

interface CadavreResult {
  playerId: string
  playerName: string
  playerAvatar: string
  head: string | null
  body: string | null
  legs: string | null
}

export default function CadavreExquisResultsPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [results, setResults] = useState<CadavreResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      console.log('📊 Loading cadavre exquis results...')

      // Charger la room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()

      if (roomError) throw roomError
      setRoom(roomData)

      // Charger les joueurs
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .order('joined_at', { ascending: true })

      if (playersError) throw playersError
      setPlayers(playersData || [])

      // Charger tous les dessins
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('type', 'draw')

      console.log('Rounds loaded:', rounds)

      if (roundsError) throw roundsError

      // Organiser par joueur
      const playerResults: CadavreResult[] = (playersData || []).map(player => {
        const playerRounds = rounds?.filter(r => r.player_id === player.id) || []
        
        const head = playerRounds.find(r => r.round_number === 1)?.content?.imageData || null
        const body = playerRounds.find(r => r.round_number === 2)?.content?.imageData || null
        const legs = playerRounds.find(r => r.round_number === 3)?.content?.imageData || null

        return {
          playerId: player.id,
          playerName: player.name,
          playerAvatar: player.avatar,
          head,
          body,
          legs
        }
      })

      console.log('Player results:', playerResults)
      setResults(playerResults)
      setIsLoading(false)

    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
      setIsLoading(false)
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
            🎭 Résultats du Cadavre Exquis
          </h1>
          <p className="text-2xl text-gray-300">
            Découvrez les créatures folles créées par l'équipe !
          </p>
        </div>

        {/* Galerie des créatures */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {results.map((result) => (
            <div
              key={result.playerId}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20"
            >
              {/* Nom du joueur */}
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-white">
                  {result.playerAvatar} {result.playerName}
                </h3>
              </div>

              {/* Créature complète */}
              <div className="bg-white rounded-xl p-4 mb-4">
                <div className="space-y-2">
                  {/* Tête */}
                  {result.head && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">👤 Tête</p>
                      <img 
                        src={result.head} 
                        alt="Tête"
                        className="w-full border-2 border-purple-300 rounded"
                      />
                    </div>
                  )}
                  
                  {/* Corps */}
                  {result.body && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">👔 Corps</p>
                      <img 
                        src={result.body} 
                        alt="Corps"
                        className="w-full border-2 border-blue-300 rounded"
                      />
                    </div>
                  )}
                  
                  {/* Jambes */}
                  {result.legs && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">👢 Jambes</p>
                      <img 
                        src={result.legs} 
                        alt="Jambes"
                        className="w-full border-2 border-green-300 rounded"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="text-center text-sm text-gray-400">
                {[result.head, result.body, result.legs].filter(Boolean).length}/3 parties
              </div>
            </div>
          ))}
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