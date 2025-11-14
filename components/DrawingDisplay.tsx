'use client'

import { useEffect, useRef } from 'react'
import { DrawingContent } from '@/types/game'

interface DrawingDisplayProps {
  data: DrawingContent
  className?: string
}

export function DrawingDisplay({ data, className = '' }: DrawingDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = data.width
    canvas.height = data.height
    
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    data.strokes.forEach(stroke => {
      if (stroke.points.length < 2) return
      
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      
      ctx.stroke()
    })
  }, [data])
  
  return <canvas ref={canvasRef} className={className} />
}