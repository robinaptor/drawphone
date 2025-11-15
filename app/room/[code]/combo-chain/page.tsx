// app/room/[code]/combo-chain/page.tsx - VERSION COMPLÈTE CORRIGÉE

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import { Timer } from '@/components/Timer'
import toast from 'react-hot-toast'

interface CanvasZone {
  playerId: string
  playerName: string
  playerAvatar: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

export default function ComboChainPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#8B5CF6')
  const [brushSize, setBrushSize] = useState(3)

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [zones, setZones] = useState<CanvasZone[]>([])
  const [myZone, setMyZone] = useState<CanvasZone | null>(null)
  const [prompt, setPrompt] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 600

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadData()
  }, [playerId])

  useEffect(() => {
    if (room && players.length > 0) {
      initializeZones()
      generatePrompt()
    }
  }, [room, players])

  const loadData = async () => {
    try {
      console.log('📡 Loading combo chain data...')
      console.log('Room code:', roomCode)
      console.log('Player ID:', playerId)

      // Charger la room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      console.log('Room query result:', { data: roomData, error: roomError })

      if (roomError) {
        console.error('❌ Room error:', roomError)
        throw roomError
      }

      setRoom(roomData)
      console.log('✅ Room loaded:', roomData)

      // Charger les joueurs avec room_code (PAS room_id)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode) // ← IMPORTANT : utiliser room_code
        .order('joined_at', { ascending: true })

      console.log('Players query result:', { data: playersData, error: playersError })

      if (playersError) {
        console.error('❌ Players error:', playersError)
        throw playersError
      }

      setPlayers(playersData || [])
      console.log('✅ Players loaded:', playersData?.length)

      const current = playersData?.find(p => p.id === playerId)
      setCurrentPlayer(current || null)
      console.log('✅ Current player:', current)

      setIsLoading(false)

    } catch (error: any) {
      console.error('💥 Error loading data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error('Failed to load game data')
      setIsLoading(false)
    }
  }

  const initializeZones = () => {
    if (!players || players.length === 0) return

    console.log('🎨 Initializing zones for', players.length, 'players')
    
    const playerCount = players.length
    const calculatedZones: CanvasZone[] = []

    const colors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6', '#F97316']

    if (playerCount <= 2) {
      // Split vertical
      calculatedZones.push(...players.map((player, idx) => ({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar || '👤',
        x: (CANVAS_WIDTH / 2) * idx,
        y: 0,
        width: CANVAS_WIDTH / 2,
        height: CANVAS_HEIGHT,
        color: colors[idx % colors.length]
      })))
    } else if (playerCount <= 4) {
      // Split en 4 quadrants
      calculatedZones.push(...players.map((player, idx) => ({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar || '👤',
        x: (idx % 2) * (CANVAS_WIDTH / 2),
        y: Math.floor(idx / 2) * (CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH / 2,
        height: CANVAS_HEIGHT / 2,
        color: colors[idx % colors.length]
      })))
    } else {
      // Split horizontal pour 5-8 joueurs
      const rows = Math.ceil(playerCount / 2)
      const cols = 2
      calculatedZones.push(...players.map((player, idx) => ({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar || '👤',
        x: (idx % cols) * (CANVAS_WIDTH / cols),
        y: Math.floor(idx / cols) * (CANVAS_HEIGHT / rows),
        width: CANVAS_WIDTH / cols,
        height: CANVAS_HEIGHT / rows,
        color: colors[idx % colors.length]
      })))
    }

    setZones(calculatedZones)
    const mine = calculatedZones.find(z => z.playerId === playerId)
    setMyZone(mine || null)
    
    if (mine) {
      setCurrentColor(mine.color)
      console.log('✅ My zone:', mine)
    }

    setTimeout(() => initCanvas(calculatedZones), 100)
  }

  const generatePrompt = () => {
    const prompts = [
      'La plage en été 🏖️',
      'Une ville futuriste 🏙️',
      'La forêt enchantée 🌳',
      'Le fond de l\'océan 🐠',
      'Une fête d\'anniversaire 🎉',
      'L\'espace et les étoiles ⭐',
      'Un château médiéval 🏰',
      'Un parc d\'attractions 🎢',
      'La jungle tropicale 🦜',
      'Un marché coloré 🏪'
    ]
    const selected = prompts[Math.floor(Math.random() * prompts.length)]
    setPrompt(selected)
    console.log('📝 Prompt:', selected)
  }

  const initCanvas = (zonesToDraw: CanvasZone[]) => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.error('❌ Canvas ref is null')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('❌ Cannot get canvas context')
      return
    }

    console.log('🖼️ Initializing canvas...')

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Dessiner les bordures des zones
    zonesToDraw.forEach(zone => {
      ctx.strokeStyle = zone.color
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.strokeRect(zone.x + 1, zone.y + 1, zone.width - 2, zone.height - 2)
      ctx.setLineDash([])
    })

    console.log('✅ Canvas initialized')
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!myZone) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Vérifier si dans ma zone
    if (
      x >= myZone.x && 
      x <= myZone.x + myZone.width &&
      y >= myZone.y && 
      y <= myZone.y + myZone.height
    ) {
      setIsDrawing(true)
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(x, y)
      }
    } else {
      toast.error('❌ Dessine uniquement dans ta zone !')
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Limiter au canvas ET à ma zone
    if (myZone) {
      const clampedX = Math.max(myZone.x, Math.min(x, myZone.x + myZone.width))
      const clampedY = Math.max(myZone.y, Math.min(y, myZone.y + myZone.height))

      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = currentColor

      ctx.lineTo(clampedX, clampedY)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.beginPath()
    }
  }

  const submitDrawing = async () => {
    const canvas = canvasRef.current
    if (!canvas || !room || !currentPlayer) return

    try {
      console.log('💾 Submitting drawing...')
      const dataURL = canvas.toDataURL('image/png')

      const { error } = await supabase
        .from('rounds')
        .insert({
          room_id: room.id,
          book_id: room.id,
          round_number: 1,
          player_id: currentPlayer.id,
          type: 'draw',
          content: {
            imageData: dataURL,
            zone: myZone,
            prompt: prompt,
            completed: true
          }
        })

      if (error) throw error

      console.log('✅ Drawing submitted!')
      toast.success('✅ Dessin sauvegardé !')
      setHasSubmitted(true)

      // Vérifier si tout le monde a fini
      checkCompletion()

    } catch (error: any) {
      console.error('💥 Error submitting drawing:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const checkCompletion = async () => {
    if (!room) return

    try {
      const { count } = await supabase
        .from('rounds')
        .select('*', { count: 'exact' })
        .eq('room_id', room.id)
        .eq('round_number', 1)

      console.log('Checking completion:', { count, needed: players.length })

      if (count && count >= players.length) {
        console.log('🎉 Everyone is done!')
        
        await supabase
          .from('rooms')
          .update({ status: 'results' })
          .eq('id', room.id)

        setTimeout(() => {
          router.push(`/room/${roomCode}/combo-results`)
        }, 2000)
      }

    } catch (error) {
      console.error('Error checking completion:', error)
    }
  }

  const handleTimeUp = () => {
    if (!hasSubmitted) {
      toast.error('⏱️ Temps écoulé !')
      submitDrawing()
    }
  }

  const colors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

  // LOADING
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <div className="text-white text-2xl">Chargement...</div>
        </div>
      </div>
    )
  }

  // ERROR STATE
  if (!myZone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Erreur de chargement
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Impossible d'initialiser le canvas
          </p>
          <button
            onClick={() => router.push(`/room/${roomCode}/lobby`)}
            className="px-6 py-3 bg-white text-purple-600 rounded-full font-bold hover:scale-110 transition-transform"
          >
            Retour au lobby
          </button>
        </div>
      </div>
    )
  }

  // HAS SUBMITTED
  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">✅</div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Dessin sauvegardé !
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
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-white mb-4">
            🤝 Combo Chain
          </h1>
          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4">
            <p className="text-3xl font-bold text-yellow-300">
              {prompt}
            </p>
            <p className="text-sm text-gray-300 mt-2">
              Dessinez tous ensemble ! Chacun dans sa zone
            </p>
          </div>
        </div>

        {/* Timer */}
        <div className="mb-6">
          <Timer 
            duration={room?.round_time || 90}
            onComplete={handleTimeUp}
          />
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
                max="15"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-white text-sm w-8">{brushSize}px</span>
            </div>
          </div>
        </div>

          {/* Canvas Container */}
          <div className="flex justify-center mb-6">
          <div className="relative">
          <canvas
               ref={canvasRef}
               width={CANVAS_WIDTH}
               height={CANVAS_HEIGHT}
               onMouseDown={startDrawing}
               onMouseMove={draw}
               onMouseUp={stopDrawing}
               onMouseLeave={stopDrawing}
               className="border-4 border-white rounded-lg cursor-crosshair shadow-2xl bg-white"
          />

          {/* Zone Labels */}
          {zones.map((zone) => (
               <div
               key={zone.playerId}
               style={{
                    position: 'absolute',
                    left: zone.x + 10,
                    top: zone.y + 10,
                    pointerEvents: 'none',
                    color: zone.color
               }}
               className="bg-black/70 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
               >
               <span>{zone.playerAvatar}</span>
               <span>{zone.playerName}</span>
               {zone.playerId === playerId && <span>(TOI)</span>}
               </div>
          ))}
          </div>
          </div>

          {/* Zone Labels */}
          {zones.map((zone) => (
          <div
          key={zone.playerId}
          style={{
               position: 'absolute',
               left: zone.x + 10,
               top: zone.y + 10,
               pointerEvents: 'none',
               color: zone.color
          }}
          className="bg-black/70 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
          >
          <span>{zone.playerAvatar}</span>
          <span>{zone.playerName}</span>
          {zone.playerId === playerId && <span>(TOI)</span>}
          </div>
          ))}

        {/* Submit Button */}
        <div className="text-center">
          <button
            onClick={submitDrawing}
            className="px-12 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-bold text-2xl hover:scale-110 transition-transform shadow-2xl"
          >
            ✅ J'ai fini !
          </button>
        </div>

      </div>
    </div>
  )
}