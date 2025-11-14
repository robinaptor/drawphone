'use client'

import { useRef, useState, useEffect } from 'react'
import { DrawingContent, Stroke, Point } from '@/types/game'

interface CanvasProps {
  onComplete: (data: DrawingContent) => void
}

export function Canvas({ onComplete }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  
  const colors = ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = 800
    canvas.height = 600
    
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    strokes.forEach(stroke => drawStroke(ctx, stroke))
  }, [strokes])
  
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
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
  }
  
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }
  
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const point = getCoordinates(e)
    setCurrentStroke([point])
  }
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    
    const point = getCoordinates(e)
    setCurrentStroke(prev => [...prev, point])
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    if (currentStroke.length > 0) {
      const prevPoint = currentStroke[currentStroke.length - 1]
      ctx.beginPath()
      ctx.moveTo(prevPoint.x, prevPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }
  
  const stopDrawing = () => {
    if (isDrawing && currentStroke.length > 0) {
      const stroke: Stroke = {
        points: currentStroke,
        color: tool === 'eraser' ? '#ffffff' : color,
        width: tool === 'eraser' ? brushSize * 3 : brushSize,
        tool
      }
      setStrokes(prev => [...prev, stroke])
      setCurrentStroke([])
    }
    setIsDrawing(false)
  }
  
  const undo = () => {
    setStrokes(prev => prev.slice(0, -1))
  }
  
  const clear = () => {
    setStrokes([])
  }
  
  const handleSubmit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    onComplete({
      strokes,
      width: canvas.width,
      height: canvas.height
    })
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-lg">
        <div className="flex gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            ✏️ Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            🧽 Eraser
          </button>
        </div>
        
        {tool === 'pen' && (
          <div className="flex gap-2">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full border-4 transition ${
                  color === c ? 'border-gray-800 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Size:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-bold w-8">{brushSize}</span>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
          >
            ↶ Undo
          </button>
          <button
            onClick={clear}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-4 border-gray-800 rounded-xl cursor-crosshair bg-white shadow-2xl"
        style={{ touchAction: 'none' }}
      />
      
      <button
        onClick={handleSubmit}
        disabled={strokes.length === 0}
        className="px-12 py-4 bg-green-500 text-white text-xl font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 shadow-lg transition transform hover:scale-105"
      >
        Done! ✓
      </button>
    </div>
  )
}