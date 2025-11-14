'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  duration: number
  onComplete: () => void
}

export function Timer({ duration, onComplete }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration)
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete()
      return
    }
    
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [timeLeft, onComplete])
  
  const percentage = (timeLeft / duration) * 100
  const isUrgent = timeLeft <= 10
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-6xl font-black ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
        {timeLeft}
      </div>
      
      <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${
            isUrgent ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}