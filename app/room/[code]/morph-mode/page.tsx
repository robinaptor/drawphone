// app/room/[code]/morph-mode/page.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import { Timer } from '@/components/Timer'
import toast from 'react-hot-toast'

export default function MorphModePage() {
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
  const [myStage, setMyStage] = useState(1)
  const [totalStages, setTotalStages] = useState(4)
  const [startWord, setStartWord] = useState('')
  const [endWord, setEndWord] = useState('')
  const [morphPercentage, setMorphPercentage] = useState(0)
  const [previousDrawing, setPreviousDrawing] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadData()
  }, [playerId])

  const loadData = async () => {
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
        .eq('room_code', roomCode.toUpperCase())
        .order('joined_at', { ascending: true })

      setPlayers(playersData || [])
      setTotalStages(playersData?.length || 4)

      const current = playersData?.find(p => p.id === playerId)
      setCurrentPlayer(current || null)

      // Déterminer mon stage
      const myIndex = playersData?.findIndex(p => p.id === playerId) || 0
      setMyStage(myIndex + 1)
      setMorphPercentage(Math.round((myIndex / ((playersData?.length || 1) - 1)) * 100))

      // Générer les mots
      generateWords()

      // Si pas le premier, attendre le dessin précédent
      if (myIndex > 0) {
        setIsWaiting(true)
        waitForPreviousDrawing(roomData.id, myIndex)
      } else {
        initCanvas(null)
      }

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load game data')
    }
  }

  const generateWords = () => {
    const wordPairs = [
      ['CHAT', 'FUSÉE'],
      ['ARBRE', 'ROBOT'],
      ['MAISON', 'VAISSEAU'],
      ['POISSON', 'OISEAU'],
      ['SOLEIL', 'LUNE']
    ]
    const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)]
    setStartWord(pair[0])
    setEndWord(pair[1])
  }

  const waitForPreviousDrawing = async (roomId: string, myIndex: number) => {
    const previousPlayer = players[myIndex - 1]
    if (!previousPlayer) return

    const checkInterval = setInterval(async () => {
      const { data } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomId)
        .eq('player_id', previousPlayer.id)
        .eq('round_number', myIndex)
        .single()

      if (data) {
        clearInterval(checkInterval)
        const content = data.content as any
        setPreviousDrawing(content.imageData)
        setIsWaiting(false)
        initCanvas(content.imageData)
      }
    }, 1000)

    setTimeout(() => clearInterval(checkInterval), 120000)
  }

  const initCanvas = (backgroundImage: string | null) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, 800, 600)

    if (backgroundImage) {
      const img = new Image()
      img.onload = () => {
        ctx.globalAlpha = 0.3
        ctx.drawImage(img, 0, 0)
        ctx.globalAlpha = 1.0
      }
      img.src = backgroundImage
    }
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
    if (!canvas || !room || !currentPlayer) return

    try {
      const dataURL = canvas.toDataURL('image/png')

      await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: room.id,
          round_number: myStage,
          player_id: currentPlayer.id,
          type: 'draw',
          content: {
            imageData: dataURL,
            morphPercentage,
            stage: myStage
          }
        })

      toast.success('✅ Dessin sauvegardé !')
      setHasSubmitted(true)

      checkCompletion()

    } catch (error) {
      console.error('Error submitting drawing:', error)
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const checkCompletion = async () => {
    if (!room) return

    try {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', room.id)

      if (rounds && rounds.length >= totalStages) {
        await supabase
          .from('rooms')
          .update({ status: 'results' })
          .eq('id', room.id)

        setTimeout(() => {
          router.push(`/room/${roomCode}/results`)
        }, 2000)
      }

    } catch (error) {
      console.error('Error checking completion:', error)
    }
  }

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ]

  if (isWaiting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-pulse">⏳</div>
          <h1 className="text-4xl font-bold text-white mb-4">
            En attente...
          </h1>
          <p className="text-xl text-gray-300">
            Le joueur précédent dessine...
          </p>
        </div>
      </div>
    )
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">✅</div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Transformation sauvegardée !
          </h1>
          <p className="text-xl text-gray-300">
            En attente des autres joueurs...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-white mb-4">
            🔄 Morph Mode
          </h1>
          <div className="flex items-center justify-center gap-4 text-3xl font-bold text-white">
            <span className="text-blue-400">{startWord}</span>
            <span className="text-gray-500">→</span>
            <span className="text-purple-400">{morphPercentage}%</span>
            <span className="text-gray-500">→</span>
            <span className="text-pink-400">{endWord}</span>
          </div>
          <p className="text-gray-300 mt-2">
            Stage {myStage}/{totalStages}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-700 rounded-full h-8">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold"
              style={{ width: `${morphPercentage}%` }}
            >
              {morphPercentage}%
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <p className="text-center text-white">
            {myStage === 1 && (
              <>✏️ Dessine un <strong>{startWord}</strong> classique</>
            )}
            {myStage > 1 && myStage < totalStages && (
              <>✏️ Transforme le dessin pour qu'il ressemble à <strong>{morphPercentage}%</strong> à un <strong>{endWord}</strong></>
            )}
            {myStage === totalStages && (
              <>✏️ Transforme complètement en <strong>{endWord}</strong> !</>
            )}
          </p>
        </div>

        {/* Timer */}
        <div className="mb-6">
          <Timer duration={90} onComplete={submitDrawing} />
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
            className="px-12 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-bold text-2xl hover:scale-110 transition-transform shadow-2xl"
          >
            ✅ Valider la transformation
          </button>
        </div>

      </div>
    </div>
  )
}