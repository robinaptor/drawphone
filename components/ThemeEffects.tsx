'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'

export function ThemeEffects() {
  const { currentTheme } = useTheme()
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([])

  useEffect(() => {
    if (!currentTheme.effects) return

    // Generate particles
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 5
    }))

    setParticles(newParticles)
  }, [currentTheme])

  const getParticleEmoji = () => {
    if (!currentTheme.effects) return '✨'
    
    if (currentTheme.effects.snow) return '❄️'
    if (currentTheme.effects.leaves) return '🍂'
    if (currentTheme.effects.hearts) return '💖'
    if (currentTheme.effects.confetti) return '🎉'
    return '✨'
  }

  // Don't render if no effects
  if (!currentTheme.effects) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute text-2xl animate-fall"
          style={{
            left: `${particle.left}%`,
            top: '-10%',
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            opacity: 0.7
          }}
        >
          {getParticleEmoji()}
        </div>
      ))}
    </div>
  )
}