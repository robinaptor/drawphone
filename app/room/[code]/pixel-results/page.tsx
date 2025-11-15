// app/room/[code]/pixel-results/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import toast from 'react-hot-toast'

interface PixelResult {
  playerId: string
  playerName: string
  playerAvatar: string
  score: number
  difficulty: string
  playerGrid: any
  originalGrid: any
}

export default function PixelResultsPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [results, setResults] = useState<PixelResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [winner, setWinner] = useState<PixelResult | null>(null)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
     try {
       console.log('📊 Loading pixel perfect results...')
   
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
   
       // Charger tous les scores
       const { data: rounds, error: roundsError } = await supabase
         .from('rounds')
         .select('*')
         .eq('room_id', roomData.id)
         .eq('round_number', 1)
         .eq('type', 'draw')
   
       console.log('Rounds loaded:', rounds?.length)
   
       if (roundsError) throw roundsError
   
       // Organiser les résultats
       const allResults: PixelResult[] = (rounds || []).map(round => {
         const player = playersData?.find(p => p.id === round.player_id)
         return {
           playerId: round.player_id,
           playerName: player?.name || 'Joueur',
           playerAvatar: player?.avatar || '👤',
           score: round.content?.score || 0,
           difficulty: round.content?.difficulty || 'medium',
           playerGrid: round.content?.playerGrid,
           originalGrid: round.content?.originalGrid
         }
       })
   
       console.log('All results:', allResults.length)
   
       // Dédupliquer : Ne garder que le meilleur score par joueur
       const uniqueResults = new Map<string, PixelResult>()
   
       allResults.forEach(result => {
         const existing = uniqueResults.get(result.playerId)
         // Garder le meilleur score
         if (!existing || result.score > existing.score) {
           uniqueResults.set(result.playerId, result)
         }
       })
   
       const playerResults = Array.from(uniqueResults.values())
       console.log('Unique results:', playerResults.length)
   
       // Trier par score (du meilleur au pire)
       playerResults.sort((a, b) => b.score - a.score)
       setResults(playerResults)
   
       // Déterminer le gagnant
       if (playerResults.length > 0) {
         setWinner(playerResults[0])
       }
   
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

  const getMedalEmoji = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}.`
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 70) return 'text-blue-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'PARFAIT'
    if (score >= 70) return 'EXCELLENT'
    if (score >= 50) return 'BIEN'
    return 'À AMÉLIORER'
  }

  const getDifficultyColor = (difficulty: string) => {
    if (difficulty === 'easy') return 'bg-green-500'
    if (difficulty === 'medium') return 'bg-yellow-500'
    if (difficulty === 'hard') return 'bg-red-500'
    return 'bg-gray-500'
  }

  const getDifficultyLabel = (difficulty: string) => {
    if (difficulty === 'easy') return 'FACILE'
    if (difficulty === 'medium') return 'MOYEN'
    if (difficulty === 'hard') return 'DIFFICILE'
    return difficulty.toUpperCase()
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

  const averageScore = results.length > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            🎯 Résultats Pixel Perfect
          </h1>
          <p className="text-2xl text-gray-300">
            Qui a la meilleure mémoire visuelle ?
          </p>
        </div>

        {/* Winner Podium */}
        {winner && (
          <div className="mb-12 text-center">
            <div className="inline-block bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-8 shadow-2xl transform hover:scale-105 transition-transform">
              <div className="text-8xl mb-4 animate-bounce">
                🏆
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">
                CHAMPION !
              </h2>
              <p className="text-5xl font-black text-white mb-4">
                {winner.playerAvatar} {winner.playerName}
              </p>
              <div className="text-6xl font-bold text-white">
                {winner.score}%
              </div>
              <p className="text-xl text-white/80 mt-2">
                {getScoreLabel(winner.score)}
              </p>
            </div>
          </div>
        )}

        {/* Classement */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            📊 Classement
          </h2>
          
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={result.playerId}
                className={`bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 transition-all hover:scale-102 ${
                  index === 0 ? 'border-yellow-400 shadow-xl shadow-yellow-400/30' :
                  index === 1 ? 'border-gray-300 shadow-xl shadow-gray-300/30' :
                  index === 2 ? 'border-orange-600 shadow-xl shadow-orange-600/30' :
                  'border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-6">
                  
                  {/* Rang */}
                  <div className="text-4xl font-bold text-white min-w-[80px] text-center">
                    {getMedalEmoji(index)}
                  </div>

                  {/* Joueur */}
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-5xl">{result.playerAvatar}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {result.playerName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getDifficultyColor(result.difficulty)} text-white`}>
                          {getDifficultyLabel(result.difficulty)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-center min-w-[150px]">
                    <div className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                      {result.score}%
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {getScoreLabel(result.score)}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="text-center min-w-[100px]">
                    {result.score >= 90 && (
                      <div className="text-4xl" title="Mémoire photographique !">
                        🤯
                      </div>
                    )}
                    {result.score >= 70 && result.score < 90 && (
                      <div className="text-4xl" title="Excellent !">
                        👏
                      </div>
                    )}
                    {result.score >= 50 && result.score < 70 && (
                      <div className="text-4xl" title="Pas mal !">
                        💪
                      </div>
                    )}
                    {result.score < 50 && (
                      <div className="text-4xl" title="Continue à t'entraîner">
                        😅
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-3xl font-bold text-white">{results.length}</div>
            <div className="text-gray-300">Joueurs</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-3xl font-bold text-white">{averageScore}%</div>
            <div className="text-gray-300">Moyenne</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
            <div className="text-4xl mb-2">🏆</div>
            <div className="text-3xl font-bold text-white">{winner?.score || 0}%</div>
            <div className="text-gray-300">Meilleur score</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-3xl font-bold text-white">
              {results.filter(r => r.score >= 90).length}
            </div>
            <div className="text-gray-300">Score parfait</div>
          </div>
        </div>

        {/* Fun Facts */}
        <div className="mb-12 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">
            🎉 Fun Facts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            {results.some(r => r.score === 100) && (
              <div className="text-lg text-yellow-300">
                🤯 Quelqu'un a eu 100% ! Incroyable !
              </div>
            )}
            {results.every(r => r.score >= 50) && (
              <div className="text-lg text-green-300">
                👏 Tout le monde a réussi à +50% !
              </div>
            )}
            {averageScore >= 80 && (
              <div className="text-lg text-blue-300">
                🧠 Équipe de génies : {averageScore}% de moyenne !
              </div>
            )}
            {results.some(r => r.difficulty === 'hard') && (
              <div className="text-lg text-red-300">
                💪 Quelqu'un a tenté le mode DIFFICILE !
              </div>
            )}
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