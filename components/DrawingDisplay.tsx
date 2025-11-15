// components/DrawingDisplay.tsx - VERSION COMPLÈTE CORRIGÉE

// components/DrawingDisplay.tsx

'use client'

import { useEffect, useRef } from 'react'

interface DrawingDisplayProps {
  data: any
  width?: number
  height?: number
  className?: string  // ← AJOUTE CETTE LIGNE
}

export default function DrawingDisplay({ 
  data, 
  width = 800, 
  height = 600,
  className = ''  // ← NOUVEAU
}: DrawingDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // ... ton code existant
  }, [data, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`border-2 border-gray-300 rounded-lg bg-white shadow-lg ${className}`}  // ← MODIFIE CETTE LIGNE
    />
  )
}

interface DrawingDisplayProps {
  data: any
  width?: number
  height?: number
}

export default function DrawingDisplay({ data, width = 800, height = 600 }: DrawingDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn('Canvas ref is null')
      return
    }

    if (!data) {
      console.warn('No data provided to DrawingDisplay')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.warn('Cannot get canvas context')
      return
    }

    // Clear canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    console.log('🎨 DrawingDisplay rendering...')
    console.log('Data type:', typeof data)
    console.log('Data:', data)

    try {
      // ✅ CAS 1 : String directe (base64)
      if (typeof data === 'string') {
        if (data.startsWith('data:image')) {
          console.log('📷 Type: Direct base64 string')
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          }
          img.onerror = () => {
            console.error('Failed to load image from string')
          }
          img.src = data
          return
        } else {
          console.warn('String data but not base64 image')
          ctx.fillStyle = '#666'
          ctx.font = '16px Arial'
          ctx.textAlign = 'center'
          ctx.fillText('Format de données invalide', canvas.width / 2, canvas.height / 2)
          return
        }
      }

      // ✅ CAS 2 : Object avec imageData
      if (data && typeof data === 'object' && data.imageData) {
        console.log('📷 Type: Object with imageData')
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
        img.onerror = () => {
          console.error('Failed to load image from imageData')
        }
        img.src = data.imageData
        return
      }

      // ✅ CAS 3 : Strokes (mode classique)
      if (data && typeof data === 'object' && data.strokes && Array.isArray(data.strokes)) {
        console.log('✏️ Type: Strokes array')
        data.strokes.forEach((stroke: any) => {
          if (!stroke || !stroke.points || !Array.isArray(stroke.points) || stroke.points.length < 2) {
            return
          }
          
          ctx.strokeStyle = stroke.color || '#000000'
          ctx.lineWidth = stroke.width || 3
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          
          ctx.beginPath()
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
          
          stroke.points.forEach((point: any) => {
            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
              ctx.lineTo(point.x, point.y)
            }
          })
          
          ctx.stroke()
        })
        return
      }

      // ✅ CAS 4 : Pixel grid
      if (data && typeof data === 'object' && (data.playerGrid || data.originalGrid)) {
        console.log('🎮 Type: Pixel grid')
        const grid = data.playerGrid || data.originalGrid
        const gridSize = Math.sqrt(Object.keys(grid).length)
        const cellSize = canvas.width / gridSize

        Object.entries(grid).forEach(([key, color]) => {
          const [x, y] = key.split(',').map(Number)
          ctx.fillStyle = color as string
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        })
        return
      }

      // ✅ FALLBACK : Format inconnu
      console.warn('⚠️ Unknown data format')
      console.log('Available keys:', Object.keys(data))
      
      ctx.fillStyle = '#666666'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Format de dessin non supporté', canvas.width / 2, canvas.height / 2)
      ctx.font = '14px Arial'
      ctx.fillText(`Type: ${typeof data}`, canvas.width / 2, canvas.height / 2 + 30)

    } catch (error) {
      console.error('Error rendering drawing:', error)
      ctx.fillStyle = '#FF0000'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Erreur d\'affichage du dessin', canvas.width / 2, canvas.height / 2)
    }

  }, [data, width, height])

return (
  <canvas
    ref={canvasRef}
    width={width}
    height={height}
    className={`border-2 border-gray-300 rounded-lg bg-white shadow-lg ${className}`}
  />
)