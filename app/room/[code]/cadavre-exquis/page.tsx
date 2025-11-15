// app/room/[code]/cadavre-exquis/page.tsx - VERSION AVEC LOGS DÉTAILLÉS

'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Room, Player } from '@/types/game'
import { Timer } from '@/components/Timer'
import toast from 'react-hot-toast'

type BodyPart = 'head' | 'body' | 'legs'

export default function CadavreExquisPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')

  const [room, setRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [currentPart, setCurrentPart] = useState<BodyPart>('head')
  const [partIndex, setPartIndex] = useState(0)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [allComplete, setAllComplete] = useState(false)

  const PARTS: BodyPart[] = ['head', 'body', 'legs']
  const CANVAS_HEIGHT = 600
  const PART_HEIGHT = CANVAS_HEIGHT / 3
  const JUNCTION_HEIGHT = 20

  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    loadData()
  }, [playerId])

  const loadData = async () => {
    try {
      console.log('📡 Loading cadavre exquis data...')
      console.log('Room code:', roomCode)
      console.log('Player ID:', playerId)
      
      // Charger la room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()

      console.log('Room query result:', { data: roomData, error: roomError })

      if (roomError) {
        console.error('❌ Room error:', roomError)
        throw roomError
      }
      
      setRoom(roomData)
      console.log('✅ Room loaded:', roomData)

      // Charger le joueur
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single()

      console.log('Player query result:', { data: playerData, error: playerError })

      if (playerError) {
        console.error('❌ Player error:', playerError)
        throw playerError
      }

      setCurrentPlayer(playerData)
      console.log('✅ Player loaded:', playerData)

      // Déterminer quelle partie dessiner
      if (roomData?.id) {
        await determineCurrentPart(roomData.id)
      }

    } catch (error: any) {
      console.error('💥 Error loading data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error('Failed to load game data')
    }
  }

  const determineCurrentPart = async (roomId: string) => {
    try {
      console.log('🔍 Determining current part...')
      console.log('Room ID:', roomId)
      console.log('Player ID:', playerId)
      
      // Test : Essayer de lire la table rounds
      console.log('Testing rounds table access...')
      const { data: testData, error: testError } = await supabase
        .from('rounds')
        .select('*')
        .limit(1)

      console.log('Test query result:', { data: testData, error: testError })

      if (testError) {
        console.error('❌ Cannot access rounds table:', testError)
        console.error('Error code:', testError.code)
        console.error('Error message:', testError.message)
        console.error('Error details:', testError.details)
        console.error('Error hint:', testError.hint)
        
        toast.error('Table "rounds" not accessible. Please create it in Supabase.')
        
        // Commencer quand même par la tête
        setPartIndex(0)
        setCurrentPart('head')
        setTimeout(() => initCanvas(), 100)
        return
      }

      console.log('✅ Rounds table is accessible')
      
      // Compter mes rounds
      console.log('Counting my rounds...')
      const { data: myRounds, error: countError, count } = await supabase
        .from('rounds')
        .select('*', { count: 'exact' })
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .eq('type', 'draw')

      console.log('Count query result:', { data: myRounds, error: countError, count })

      if (countError) {
        console.error('❌ Error counting rounds:', countError)
        console.error('Full error object:', JSON.stringify(countError, null, 2))
        throw countError
      }

      const partIdx = count || 0
      console.log('✅ Part index:', partIdx, '/', 3)

      if (partIdx >= 3) {
        console.log('🎉 All parts done!')
        setAllComplete(true)
        checkIfEveryoneIsDone(roomId)
        return
      }

      setPartIndex(partIdx)
      setCurrentPart(PARTS[partIdx])
      console.log(`🎨 Drawing part: ${PARTS[partIdx]} (${partIdx + 1}/3)`)

      setTimeout(() => initCanvas(), 100)

    } catch (error: any) {
      console.error('💥 Error in determineCurrentPart:', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', Object.keys(error))
      console.error('Error message:', error?.message)
      console.error('Error code:', error?.code)
      console.error('Full error:', JSON.stringify(error, null, 2))
      
      // Fallback : commencer par la tête
      setPartIndex(0)
      setCurrentPart('head')
      setTimeout(() => initCanvas(), 100)
    }
  }

  // app/room/[code]/cadavre-exquis/page.tsx - FONCTION initCanvas AMÉLIORÉE

const initCanvas = () => {
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
   
     console.log('🎨 Initializing canvas for part:', currentPart, 'index:', partIndex)
   
     // Fond blanc
     ctx.fillStyle = '#FFFFFF'
     ctx.fillRect(0, 0, 800, CANVAS_HEIGHT)
   
     // Dessiner les zones masquées en noir semi-transparent
     ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
     
     // Masquer le haut si pas la première partie
     if (partIndex > 0) {
       const maskTop = PART_HEIGHT * partIndex - JUNCTION_HEIGHT
       ctx.fillRect(0, 0, 800, maskTop)
     }
   
     // Masquer le bas si pas la dernière partie
     if (partIndex < 2) {
       const maskBottom = PART_HEIGHT * (partIndex + 1) + JUNCTION_HEIGHT
       ctx.fillRect(0, maskBottom, 800, CANVAS_HEIGHT - maskBottom)
     }
   
     // Zone de jonction en jaune clair (sans texte)
     if (partIndex < 2) {
       ctx.fillStyle = 'rgba(255, 255, 0, 0.15)'
       ctx.fillRect(0, PART_HEIGHT * (partIndex + 1), 800, JUNCTION_HEIGHT)
       
       // Bordures en pointillés pour indiquer la zone
       ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)'
       ctx.lineWidth = 2
       ctx.setLineDash([5, 5])
       ctx.strokeRect(0, PART_HEIGHT * (partIndex + 1), 800, JUNCTION_HEIGHT)
       ctx.setLineDash([]) // Reset
     }
   
     console.log('✅ Canvas initialized successfully')
   }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const minY = PART_HEIGHT * partIndex - (partIndex > 0 ? JUNCTION_HEIGHT : 0)
    const maxY = PART_HEIGHT * (partIndex + 1) + (partIndex < 2 ? JUNCTION_HEIGHT : 0)

    if (y < minY || y > maxY) {
      toast.error('❌ Dessine uniquement dans ta zone !')
      return
    }

    setIsDrawing(true)
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
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

    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = currentColor
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.beginPath()
    }
  }

  const clearCanvas = () => {
    if (window.confirm('Effacer tout le dessin ?')) {
      initCanvas()
    }
  }

  const submitDrawing = async () => {
    const canvas = canvasRef.current
    if (!canvas || !room || !currentPlayer) {
      console.error('❌ Missing data:', { canvas: !!canvas, room: !!room, currentPlayer: !!currentPlayer })
      return
    }

    try {
      console.log('💾 Submitting drawing...')
      
      const dataURL = canvas.toDataURL('image/png')
      console.log('Image data URL length:', dataURL.length)

      const insertData = {
        room_id: room.id,
        book_id: currentPlayer.id,
        round_number: partIndex + 1,
        player_id: currentPlayer.id,
        type: 'draw',
        content: {
          part: currentPart,
          imageData: dataURL,
          partIndex: partIndex
        }
      }

      console.log('Insert data:', {
        ...insertData,
        content: { ...insertData.content, imageData: 'TRUNCATED' }
      })

      const { data, error } = await supabase
        .from('rounds')
        .insert(insertData)
        .select()

      console.log('Insert result:', { data, error })

      if (error) {
        console.error('❌ Supabase error:', error)
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        console.error('Full error:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('✅ Drawing submitted successfully!')
      toast.success('✅ Partie sauvegardée !')
      setHasSubmitted(true)

      if (partIndex < 2) {
        setTimeout(() => {
          setHasSubmitted(false)
          determineCurrentPart(room.id)
        }, 2000)
      } else {
        setAllComplete(true)
        checkIfEveryoneIsDone(room.id)
      }

    } catch (error: any) {
      console.error('💥 Error in submitDrawing:', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', Object.keys(error))
      console.error('Full error:', JSON.stringify(error, null, 2))
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  // app/room/[code]/cadavre-exquis/page.tsx - LIGNE 340 environ

const checkIfEveryoneIsDone = async (roomId: string) => {
     try {
       const { data: allPlayers } = await supabase
         .from('players')
         .select('id')
         .eq('room_code', roomCode.toUpperCase())
   
       const { count } = await supabase
         .from('rounds')
         .select('player_id', { count: 'exact' })
         .eq('room_id', roomId)
         .eq('type', 'draw')
   
       console.log('Checking completion:', {
         totalPlayers: allPlayers?.length,
         totalRounds: count,
         needed: (allPlayers?.length || 0) * 3
       })
   
       if (count && allPlayers && count >= allPlayers.length * 3) {
         console.log('🎉 Everyone is done!')
         
         await supabase
           .from('rooms')
           .update({ status: 'results' })
           .eq('id', roomId)
   
         toast.success('🎉 Tout le monde a fini !')
         
         // ✅ REDIRIGER VERS LA PAGE SPÉCIFIQUE
         setTimeout(() => {
           router.push(`/room/${roomCode}/cadavre-exquis-results`)
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

  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#FFD700', '#00FF7F'
  ]

  if (allComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">✅</div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Toutes les parties terminées !
          </h1>
          <p className="text-xl text-gray-300">
            En attente des autres joueurs...
          </p>
          <div className="mt-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    )
  }

  if (hasSubmitted && partIndex < 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-6">✅</div>
          <h1 className="text-4xl font-bold text-white mb-4">
            {currentPart === 'head' ? 'Tête' : 'Corps'} sauvegardée !
          </h1>
          <p className="text-xl text-gray-300">
            Préparation de la prochaine partie...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎭 Cadavre Exquis
          </h1>
          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-4">
            <p className="text-3xl font-bold text-white">
              Dessine : {
                currentPart === 'head' ? '👤 La TÊTE' :
                currentPart === 'body' ? '👔 Le CORPS' :
                '👢 Les JAMBES'
              }
            </p>
            <p className="text-sm text-gray-300 mt-2">
              Partie {partIndex + 1}/3
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Timer 
            duration={room?.round_time || 60}
            onComplete={handleTimeUp}
          />
        </div>

        <div className="mb-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <p className="text-center text-white">
            {currentPart === 'head' && (
              <>✏️ Dessine la <strong>TÊTE</strong> ! Laisse des traits dans la <strong className="text-yellow-300">zone de jonction</strong> en bas.</>
            )}
            {currentPart === 'body' && (
              <>✏️ Continue le dessin ! Dessine le <strong>CORPS</strong> et laisse des traits dans la zone jaune en bas.</>
            )}
            {currentPart === 'legs' && (
              <>✏️ Termine la créature ! Dessine les <strong>JAMBES</strong>.</>
            )}
          </p>
        </div>

        <div className="mb-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex gap-4 items-center justify-between flex-wrap">
            
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCurrentColor(color)
                    setTool('pen')
                  }}
                  className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 ${
                    currentColor === color && tool === 'pen' ? 'border-white scale-125 ring-2 ring-white' : 'border-gray-600'
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

            <div className="flex gap-2">
              <button
                onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  tool === 'eraser'
                    ? 'bg-red-500 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🧹 Gomme
              </button>

              <button
                onClick={clearCanvas}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white transition-colors"
              >
                🗑️ Tout effacer
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <canvas
            ref={canvasRef}
            width={800}
            height={CANVAS_HEIGHT}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="border-4 border-white rounded-lg cursor-crosshair shadow-2xl bg-white"
          />
        </div>

        <div className="text-center">
          <button
            onClick={submitDrawing}
            disabled={hasSubmitted}
            className="px-12 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-bold text-2xl hover:scale-110 transition-transform shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✅ Valider cette partie
          </button>
        </div>

      </div>
    </div>
  )
}