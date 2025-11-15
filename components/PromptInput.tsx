'use client'

import { useState, useRef, useEffect } from 'react'
import { PromptContent } from '@/types/game'
import DrawingDisplay from './DrawingDisplay'

interface PromptInputProps {
  type: 'prompt' | 'describe'
  onComplete: (data: PromptContent) => void
  reference?: any
}

export function PromptInput({ type, onComplete, reference }: PromptInputProps) {
  const [text, setText] = useState('')
  
  const handleSubmit = () => {
    if (text.trim()) {
      onComplete({ text: text.trim() })
    }
  }
  
  const placeholder = type === 'prompt'
    ? 'Enter a funny sentence... (e.g., "A cat riding a unicycle")'
    : 'Describe what you see in the drawing...'
  
  const title = type === 'prompt'
    ? '📝 Write a Prompt'
    : '👀 Describe the Drawing'
  
  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
      <h2 className="text-4xl font-black text-gray-800">{title}</h2>
      
      {type === 'describe' && reference && (
        <div className="border-4 border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <DrawingDisplay data={reference} />
        </div>
      )}
      
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={200}
        className="w-full h-32 p-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
        autoFocus
      />
      
      <div className="text-sm text-gray-500">
        {text.length}/200 characters
      </div>
      
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="px-12 py-4 bg-green-500 text-white text-xl font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition transform hover:scale-105"
      >
        Submit! ✓
      </button>
    </div>
  )
}