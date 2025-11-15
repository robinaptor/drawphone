// app/room/[code]/battle-royale/page.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import { Timer } from '@/components/Timer'
import toast from 'react-hot-toast'

type Phase = 'draw' | 'vote' | 'results' | 'final'

interface Submission {
  id: string
  player_id: string
  player_name: string
  player_avatar: string
  content: string
  votes: number
}

export default function BattleRoyalePage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [phase, setPhase] = useState<Phase>('draw')
  const [currentRound, setCurrentRound] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [myDrawing, setMyDrawing] = useState<string>('')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [eliminated, setEliminated] = useState<string[]>([])
  const [winner, setWinner] = useState<Player | null>(null)
  const [isEliminated, setIsEliminated] = useState(false)

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadData()
  }, [playerId])

  useEffect(() => {
    if (room && players.length > 0) {
      subscribeToChanges()
    }
  }, [room, players])

  const loadData = async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()

      if (roomError) throw roomError
      setRoom(roomData)
      setCurrentRound(roomData.current_round || 1)

      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .order('joined_at', { ascending: true })

      setPlayers(playersData || [])

      const current = playersData?.find(p => p.id === playerId)
      setCurrentPlayer(current || null)
      setIsEliminated(current?.is_eliminated || false)

      generatePrompt()
      initCanvas()

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load game data')
    }
  }

  const subscribeToChanges = () => {
    if (!room) return

    const channel = supabase
      .channel(`battle-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode.toUpperCase()}`
        },
        (payload) => {
          const updatedPlayer = payload.new as Player
          setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p))
          
          if (updatedPlayer.id === playerId && updatedPlayer.is_eliminated) {
            setIsEliminated(true)
            toast.error('💀 Tu as été éliminé !')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const generatePrompt = () => {
    const prompts = [
      'Un dragon jouant au tennis',
      'Une pizza qui vole dans l\'espace',
      'Un robot qui pleure',
      'Un château sur un nuage',
      'Un super-héros qui fait du shopping',
      'Une licorne qui fait du skateboard',
      'Un vampire au soleil',
      'Un extraterrestre qui cuisine',
      'Un pirate sur un vélo',
      'Un fantôme qui danse',
      'Un ninja qui jardine',
      'Un zombie au spa',
      'Un astronaute à la plage'
    ]
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)])
  }

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, 800, 600)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    draw(e)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && e.type !== 'mousedown') return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.fillStyle = currentColor
    ctx.beginPath()
    ctx.arc(x, y, brushSize, 0, Math.PI * 2)
    ctx.fill()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const submitDrawing = async () => {
    const canvas = canvasRef.current
    if (!canvas || !room || !currentPlayer || isEliminated) return

    try {
      const dataURL = canvas.toDataURL('image/png')
      setMyDrawing(dataURL)

      await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: room.id,
          round_number: currentRound,
          player_id: currentPlayer.id,
          type: 'draw',
          content: {
            imageData: dataURL,
            prompt
          }
        })

      toast.success('✅ Dessin envoyé !')
      
      checkIfAllDrawn()

    } catch (error) {
      console.error('Error submitting drawing:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const checkIfAllDrawn = async () => {
    if (!room) return

    try {
      const activePlayers = players.filter(p => !p.is_eliminated)
      
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', room.id)
        .eq('round_number', currentRound)

      if (rounds && rounds.length >= activePlayers.length) {
        // Tout le monde a dessiné, passer au vote
        await loadSubmissions()
        setPhase('vote')
      }

    } catch (error) {
      console.error('Error checking drawings:', error)
    }
  }

  const loadSubmissions = async () => {
    if (!room) return

    try {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*, player:players(name, avatar)')
        .eq('room_id', room.id)
        .eq('round_number', currentRound)

      const subs: Submission[] = (rounds || []).map(r => ({
        id: r.id,
        player_id: r.player_id,
        player_name: (r as any).player?.name || 'Joueur',
        player_avatar: (r as any).player?.avatar || '👤',
        content: r.content.imageData,
        votes: 0
      }))

      setSubmissions(subs)

    } catch (error) {
      console.error('Error loading submissions:', error)
    }
  }

  const handleVote = async (submissionId: string, votedPlayerId: string) => {
    if (!currentPlayer || hasVoted || isEliminated || votedPlayerId === playerId) return

    try {
      // Créer un vote dans la table rounds avec un type spécial
      await supabase
        .from('rounds')
        .insert({
          room_id: room!.id,
          book_id: room!.id,
          round_number: currentRound,
          player_id: currentPlayer.id,
          type: 'describe', // Utiliser 'describe' pour les votes
          content: {
            vote_for: votedPlayerId,
            submission_id: submissionId
          }
        })

      setHasVoted(true)
      toast.success('✅ Vote enregistré !')

      checkIfAllVoted()

    } catch (error) {
      console.error('Error voting:', error)
      toast.error('Erreur lors du vote')
    }
  }

  const checkIfAllVoted = async () => {
    if (!room) return

    try {
      const activePlayers = players.filter(p => !p.is_eliminated)

      const { data: votes } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', room.id)
        .eq('round_number', currentRound)
        .eq('type', 'describe')

      if (votes && votes.length >= activePlayers.length) {
        // Tout le monde a voté, calculer les éliminations
        await processEliminations(votes)
      }

    } catch (error) {
      console.error('Error checking votes:', error)
    }
  }

  const processEliminations = async (votes: any[]) => {
    if (!room) return

    try {
      // Compter les votes par joueur
      const voteCount: Record<string, number> = {}
      votes.forEach(vote => {
        const votedFor = vote.content.vote_for
        voteCount[votedFor] = (voteCount[votedFor] || 0) + 1
      })

      // Mettre à jour les submissions avec les votes
      const updatedSubs = submissions.map(sub => ({
        ...sub,
        votes: voteCount[sub.player_id] || 0
      }))
      setSubmissions(updatedSubs)

      // Trier par votes (moins de votes = pire dessin)
      const activePlayers = players.filter(p => !p.is_eliminated)
      const sortedPlayers = activePlayers
        .map(p => ({
          ...p,
          votes: voteCount[p.id] || 0
        }))
        .sort((a, b) => a.votes - b.votes)

      // Éliminer les 2 joueurs avec le moins de votes
      const toEliminate = sortedPlayers.slice(0, 2).map(p => p.id)
      
      // Mettre à jour la DB
      for (const playerId of toEliminate) {
        await supabase
          .from('players')
          .update({ is_eliminated: true })
          .eq('id', playerId)
      }

      setEliminated([...eliminated, ...toEliminate])
      setPhase('results')

      // Vérifier s'il reste seulement 1 ou 2 joueurs
      const remaining = activePlayers.filter(p => !toEliminate.includes(p.id))
      
      if (remaining.length <= 1) {
        setWinner(remaining[0] || null)
        setPhase('final')
      }

    } catch (error) {
      console.error('Error processing eliminations:', error)
    }
  }

  const handleNextRound = () => {
    const activePlayers = players.filter(p => !p.is_eliminated)
    
    if (activePlayers.length <= 1) {
      setPhase('final')
      return
    }

    // Nouveau round
    setCurrentRound(currentRound + 1)
    setPhase('draw')
    setMyDrawing('')
    setHasVoted(false)
    setSubmissions([])
    generatePrompt()
    initCanvas()
  }

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ]

  // PHASE FINALE
  if (phase === 'final' && winner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-orange-900 to-red-900 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-9xl mb-8 animate-bounce">
            🏆
          </div>
          <h1 className="text-7xl font-bold mb-6 text-yellow-300">
            VICTOIRE !
          </h1>
          <p className="text-5xl font-bold mb-8 text-white">
            {winner.avatar} {winner.name}
          </p>
          <p className="text-3xl text-gray-300 mb-12">
            Champion du Battle Royale ! 👑
          </p>
          
          <div className="text-7xl mb-8 animate-pulse">
            🎉 🎊 🎉 🎊 🎉
          </div>

          <button
            onClick={() => router.push(`/room/${roomCode}/lobby`)}
            className="mt-8 px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold text-2xl hover:scale-110 transition-transform"
          >
            🔄 Nouvelle partie
          </button>
        </div>
      </div>
    )
  }

  // MODE SPECTATEUR (éliminé)
  if (isEliminated && phase !== 'final') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-8">
            <div className="text-8xl mb-4">💀</div>
            <h1 className="text-5xl font-bold text-red-400 mb-4">
              Tu as été éliminé !
            </h1>
            <p className="text-2xl text-gray-300">
              Mode spectateur - Regarde la suite de la bataille
            </p>
          </div>

          {/* Joueurs restants */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Survivants ({players.filter(p => !p.is_eliminated).length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {players.filter(p => !p.is_eliminated).map(player => (
                <div
                  key={player.id}
                  className="px-4 py-2 bg-green-900/30 text-green-400 rounded-full font-bold border border-green-500"
                >
                  {player.avatar} {player.name}
                </div>
              ))}
            </div>
          </div>

          {/* Éliminés */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              Éliminés ({players.filter(p => p.is_eliminated).length})
            </h2>
            <div className="flex flex-wrap gap-3">
              {players.filter(p => p.is_eliminated).map(player => (
                <div
                  key={player.id}
                  className="px-4 py-2 bg-red-900/30 text-red-400 rounded-full font-bold border border-red-500 line-through opacity-50"
                >
                  💀 {player.avatar} {player.name}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    )
  }

  // PHASE VOTE
  if (phase === 'vote') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              🗳️ VOTE POUR LE MEILLEUR !
            </h1>
            <p className="text-xl text-gray-300">
              Les 2 pires dessins seront éliminés !
            </p>
            <div className="mt-4 text-2xl font-bold text-yellow-400">
              Round {currentRound}
            </div>
          </div>

          {hasVoted && (
            <div className="text-center mb-6 p-4 bg-green-900/30 rounded-xl border border-green-500">
              <p className="text-green-400 font-bold text-xl">
                ✅ Vote enregistré ! En attente des autres...
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {submissions.map((sub) => {
              const isMyDrawing = sub.player_id === playerId

              return (
                <div
                  key={sub.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isMyDrawing 
                      ? 'border-blue-500 bg-blue-900/20' 
                      : 'border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white">
                      {sub.player_avatar} {isMyDrawing ? 'TOI' : sub.player_name}
                    </span>
                  </div>

                  <img
                    src={sub.content}
                    alt="Dessin"
                    className="w-full h-48 object-contain bg-white rounded-lg mb-3"
                  />

                  {!isMyDrawing && !hasVoted && (
                    <button
                      onClick={() => handleVote(sub.id, sub.player_id)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold hover:scale-105 transition-transform"
                    >
                      👍 Voter pour ce dessin
                    </button>
                  )}

                  {isMyDrawing && (
                    <div className="text-center text-gray-500 italic">
                      (Tu ne peux pas voter pour toi)
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </div>
    )
  }

  // PHASE RESULTS
  if (phase === 'results') {
    const eliminatedThisRound = players.filter(p => 
      eliminated.includes(p.id) && !eliminated.slice(0, -2).includes(p.id)
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-red-400 mb-4">
              💀 ÉLIMINATIONS
            </h1>
            <p className="text-xl text-gray-300">
              Round {currentRound}
            </p>
          </div>

          {/* Résultats avec votes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {submissions
              .sort((a, b) => b.votes - a.votes)
              .map((sub) => {
                const isElim = eliminatedThisRound.some(p => p.id === sub.player_id)

                return (
                  <div
                    key={sub.id}
                    className={`p-4 rounded-xl border-2 ${
                      isElim 
                        ? 'border-red-500 bg-red-900/30' 
                        : 'border-green-500 bg-green-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-white">
                        {sub.player_avatar} {sub.player_name}
                      </span>
                      <span className="px-3 py-1 bg-purple-600 rounded-full font-bold">
                        👍 {sub.votes}
                      </span>
                    </div>

                    <img
                      src={sub.content}
                      alt="Dessin"
                      className="w-full h-48 object-contain bg-white rounded-lg mb-3"
                    />

                    {isElim && (
                      <div className="text-center text-red-400 font-bold">
                        💀 ÉLIMINÉ
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <div className="text-center">
            {players.filter(p => !p.is_eliminated).length > 1 ? (
              <button
                onClick={handleNextRound}
                className="px-12 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-bold text-2xl hover:scale-110 transition-transform"
              >
                ➡️ Round Suivant
              </button>
            ) : (
              <button
                onClick={() => setPhase('final')}
                className="px-12 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full font-bold text-2xl hover:scale-110 transition-transform"
              >
                🏆 Voir le gagnant !
              </button>
            )}
          </div>

        </div>
      </div>
    )
  }

  // PHASE DRAW
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-white mb-4">
            🏆 Battle Royale Draw
          </h1>
          <div className="flex items-center justify-center gap-6 text-xl mb-4">
            <div className="px-4 py-2 bg-red-900/50 rounded-full border border-red-500">
              Round {currentRound}
            </div>
            <div className="px-4 py-2 bg-green-900/50 rounded-full border border-green-500">
              {players.filter(p => !p.is_eliminated).length} survivants
            </div>
            <div className="px-4 py-2 bg-gray-900/50 rounded-full border border-gray-500">
              {players.filter(p => p.is_eliminated).length} éliminés
            </div>
          </div>
          <div className="text-3xl font-bold text-yellow-300">
            "{prompt}"
          </div>
        </div>

        {/* Timer */}
        <div className="mb-6">
          <Timer duration={45} onComplete={submitDrawing} />
        </div>

        {/* Toolbar */}
        <div className="mb-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex gap-4 items-center justify-between flex-wrap">
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 ${
                    currentColor === color ? 'border-white scale-125' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-white text-sm">Taille:</span>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-white text-sm w-8">{brushSize}px</span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex justify-center mb-6">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="border-4 border-white rounded-lg cursor-crosshair shadow-2xl bg-white"
          />
        </div>

        {/* Submit */}
        <div className="text-center">
          <button
            onClick={submitDrawing}
            disabled={!canvasRef.current}
            className="px-12 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-bold text-2xl hover:scale-110 transition-transform shadow-2xl disabled:opacity-50"
          >
            ✅ Soumettre mon dessin
          </button>
        </div>

      </div>
    </div>
  )
}