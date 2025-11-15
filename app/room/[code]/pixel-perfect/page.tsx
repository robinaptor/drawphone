// app/room/[code]/pixel-perfect/page.tsx - VERSION COMPLÈTE CORRIGÉE

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import { Timer } from '@/components/Timer'
import toast from 'react-hot-toast'

type Phase = 'memorize' | 'draw' | 'compare'
type Difficulty = 'easy' | 'medium' | 'hard'

interface PixelGrid {
  [key: string]: string // "x,y" => color
}

const DIFFICULTIES = {
  easy: { size: 8, colors: ['#000000', '#FFFFFF', '#FF0000'], memoryTime: 10, drawTime: 30 },
  medium: { size: 16, colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'], memoryTime: 8, drawTime: 45 },
  hard: { size: 32, colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'], memoryTime: 5, drawTime: 60 }
}

export default function PixelPerfectPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const playerCanvasRef = useRef<HTMLCanvasElement>(null)

  const [room, setRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [phase, setPhase] = useState<Phase>('memorize')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [originalGrid, setOriginalGrid] = useState<PixelGrid>({})
  const [playerGrid, setPlayerGrid] = useState<PixelGrid>({})
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [score, setScore] = useState(0)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [timerKey, setTimerKey] = useState(0) // Pour forcer le reset du timer

  const config = DIFFICULTIES[difficulty]
  const cellSize = 400 / config.size

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadData()
  }, [playerId])

  const loadData = async () => {
    try {
      console.log('📊 Loading pixel perfect data...')
      
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError) throw roomError
      setRoom(roomData)

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      setCurrentPlayer(playerData)

      // Générer le pixel art
      generatePixelArt()

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load game data')
    }
  }

  const generatePixelArt = () => {
    console.log('🎨 Generating pixel art...')
    const grid: PixelGrid = {}
    const { size, colors } = config

    // Générer un pattern simple
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Pattern smiley simple pour easy
        if (difficulty === 'easy') {
          if (
            (y === 2 && (x === 2 || x === 5)) || // Yeux
            (y === 5 && x >= 2 && x <= 5) // Bouche
          ) {
            grid[`${x},${y}`] = '#000000'
          } else {
            grid[`${x},${y}`] = '#FFFF00'
          }
        } else {
          // Pattern checker pour medium/hard
          const colorIndex = (x + y) % colors.length
          grid[`${x},${y}`] = colors[colorIndex]
        }
      }
    }

    setOriginalGrid(grid)
    
    // Initialiser la grille du joueur (vide/blanc)
    const emptyGrid: PixelGrid = {}
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        emptyGrid[`${x},${y}`] = '#FFFFFF'
      }
    }
    setPlayerGrid(emptyGrid)

    // Dessiner l'original
    setTimeout(() => {
      if (phase === 'memorize') {
        drawGrid(originalCanvasRef, grid)
      }
    }, 100)
  }

  const drawGrid = (canvasRef: React.RefObject<HTMLCanvasElement | null>, grid: PixelGrid) => {
     const canvas = canvasRef.current
     if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    console.log('🖼️ Drawing grid...')
    ctx.clearRect(0, 0, 400, 400)

    // Dessiner les pixels
    for (let y = 0; y < config.size; y++) {
      for (let x = 0; x < config.size; x++) {
        const color = grid[`${x},${y}`] || '#FFFFFF'
        ctx.fillStyle = color
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }

    // Grille
    ctx.strokeStyle = '#CCCCCC'
    ctx.lineWidth = 1
    for (let i = 0; i <= config.size; i++) {
      ctx.beginPath()
      ctx.moveTo(i * cellSize, 0)
      ctx.lineTo(i * cellSize, 400)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, i * cellSize)
      ctx.lineTo(400, i * cellSize)
      ctx.stroke()
    }
  }

  useEffect(() => {
    console.log('📍 Phase changed to:', phase)
    
    if (phase === 'memorize' && originalCanvasRef.current) {
      drawGrid(originalCanvasRef, originalGrid)
    } else if (phase === 'draw' && playerCanvasRef.current) {
      drawGrid(playerCanvasRef, playerGrid)
    } else if (phase === 'compare') {
      // Redessiner les deux grilles pour comparaison
      if (originalCanvasRef.current) {
        drawGrid(originalCanvasRef, originalGrid)
      }
      if (playerCanvasRef.current) {
        drawGrid(playerCanvasRef, playerGrid)
      }
    }
  }, [phase, playerGrid, originalGrid])

  const handleMemoryTimeUp = () => {
    console.log('⏰ Memory time up! Switching to draw phase')
    setPhase('draw')
    setTimerKey(prev => prev + 1) // Reset le timer
    toast.success('🎨 À toi de dessiner !')
  }

  const handleDrawTimeUp = () => {
    console.log('⏰ Draw time up! Comparing...')
    compareGrids()
  }

  const handleCellClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'draw') {
      console.log('❌ Cannot draw in phase:', phase)
      return
    }

    const canvas = playerCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / cellSize)
    const y = Math.floor((e.clientY - rect.top) / cellSize)

    console.log('🖱️ Clicked cell:', x, y, 'with color:', selectedColor)

    const newGrid = { ...playerGrid }
    newGrid[`${x},${y}`] = selectedColor
    setPlayerGrid(newGrid)

    // Redessiner immédiatement
    drawGrid(playerCanvasRef, newGrid)
  }

  const compareGrids = () => {
    console.log('📊 Comparing grids...')
    let correctPixels = 0
    const totalPixels = config.size * config.size

    for (let y = 0; y < config.size; y++) {
      for (let x = 0; x < config.size; x++) {
        const key = `${x},${y}`
        if (originalGrid[key] === playerGrid[key]) {
          correctPixels++
        }
      }
    }

    const percentage = Math.round((correctPixels / totalPixels) * 100)
    console.log('✅ Score:', percentage, '%')
    setScore(percentage)
    setPhase('compare')

    saveScore(percentage)
  }

  const saveScore = async (percentage: number) => {
    if (!room || !currentPlayer || hasSubmitted) return

    try {
      await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: room.id,
          round_number: 1,
          player_id: currentPlayer.id,
          type: 'draw',
          content: {
            score: percentage,
            playerGrid,
            originalGrid,
            difficulty
          }
        })

      toast.success(`Score: ${percentage}%`)
      setHasSubmitted(true)

      checkCompletion()

    } catch (error) {
      console.error('Error saving score:', error)
    }
  }

  const checkCompletion = async () => {
    if (!room) return

    try {
      const { data: players } = await supabase
        .from('players')
        .select('id')
        .eq('room_code', roomCode)

      const { data: rounds, count } = await supabase
        .from('rounds')
        .select('*', { count: 'exact' })
        .eq('room_id', room.id)
        .eq('round_number', 1)

      console.log('Checking completion:', { players: players?.length, rounds: count })

      if (rounds && players && count !== null && count >= players.length) {
        await supabase
          .from('rooms')
          .update({ status: 'results' })
          .eq('id', room.id)

        setTimeout(() => {
          router.push(`/room/${roomCode}/pixel-results`)
        }, 3000)
      }

    } catch (error) {
      console.error('Error checking completion:', error)
    }
  }

  // PHASE COMPARE
  if (phase === 'compare') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              🎯 Pixel Perfect
            </h1>
            <div className="text-8xl mb-4">
              {score >= 90 && '🏆'}
              {score >= 70 && score < 90 && '🥈'}
              {score >= 50 && score < 70 && '🥉'}
              {score < 50 && '😅'}
            </div>
            <p className="text-6xl font-bold text-yellow-400 mb-4">
              {score}%
            </p>
            <p className="text-2xl text-white">
              {score >= 90 && 'PARFAIT ! Mémoire photographique ! 🤯'}
              {score >= 70 && score < 90 && 'Excellent ! Presque parfait ! 👏'}
              {score >= 50 && score < 70 && 'Pas mal ! Continue ! 💪'}
              {score < 50 && 'Ça ira mieux la prochaine fois ! 😊'}
            </p>
          </div>

          {/* Comparaison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">
                📷 ORIGINAL
              </h3>
              <canvas
                ref={originalCanvasRef}
                width={400}
                height={400}
                className="border-4 border-purple-500 rounded-lg mx-auto bg-white"
              />
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-green-400 mb-4">
                ✏️ TON DESSIN
              </h3>
              <canvas
                ref={playerCanvasRef}
                width={400}
                height={400}
                className="border-4 border-green-500 rounded-lg mx-auto bg-white"
              />
            </div>
          </div>

          {hasSubmitted && (
            <div className="text-center">
              <p className="text-xl text-gray-300">
                En attente des autres joueurs...
              </p>
            </div>
          )}

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎯 Pixel Perfect
          </h1>
          <p className="text-xl text-gray-300">
            {phase === 'memorize' && '👀 MÉMORISE CE PIXEL ART !'}
            {phase === 'draw' && '✏️ REPRODUIS-LE DE MÉMOIRE !'}
          </p>
          <p className="text-lg text-gray-400">
            Difficulté: {difficulty.toUpperCase()} ({config.size}x{config.size})
          </p>
        </div>

        {/* Timer */}
        <div className="mb-6">
          <Timer 
            key={timerKey} // Force reset quand la phase change
            duration={phase === 'memorize' ? config.memoryTime : config.drawTime}
            onComplete={phase === 'memorize' ? handleMemoryTimeUp : handleDrawTimeUp}
          />
        </div>

        {/* Palette (seulement en draw) */}
        {phase === 'draw' && (
          <div className="mb-6 flex justify-center gap-2 flex-wrap">
            {config.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-12 h-12 rounded-lg border-4 transition-transform hover:scale-110 ${
                  selectedColor === color ? 'border-white scale-125 ring-2 ring-white' : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}

        {/* Canvas */}
        <div className="flex justify-center mb-6">
          {phase === 'memorize' && (
            <div className="text-center">
              <canvas
                ref={originalCanvasRef}
                width={400}
                height={400}
                className="border-4 border-purple-500 rounded-lg bg-white shadow-2xl"
              />
              <p className="mt-4 text-yellow-400 animate-pulse">
                📸 Mémorise bien !
              </p>
            </div>
          )}
          
          {phase === 'draw' && (
            <div className="text-center">
              <canvas
                ref={playerCanvasRef}
                width={400}
                height={400}
                onClick={handleCellClick}
                className="border-4 border-green-500 rounded-lg cursor-pointer bg-white shadow-2xl hover:shadow-green-500/50 transition-shadow"
              />
              <p className="mt-4 text-green-400">
                👆 Clique sur les cases pour dessiner
              </p>
            </div>
          )}
        </div>

        {/* Submit (seulement en draw) */}
        {phase === 'draw' && (
          <div className="text-center">
            <button
              onClick={compareGrids}
              className="px-12 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-bold text-2xl hover:scale-110 transition-transform shadow-2xl"
            >
              ✅ Valider mon dessin
            </button>
          </div>
        )}

      </div>
    </div>
  )
}