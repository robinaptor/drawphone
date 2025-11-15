'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { ThemeSelector } from '@/components/ThemeSelector'
import { ThemeEffects } from '@/components/ThemeEffects'
import { ModeSelector } from '@/components/ModeSelector'
import { GameMode } from '@/types/game'
import toast, { Toaster } from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const { currentTheme } = useTheme()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic')
  
  const createRoom = async () => {
    if (!name.trim()) {
      toast.error('Please enter your name')
      return
    }
    
    setIsCreating(true)
    
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hostName: name.trim(),
          gameMode: selectedMode 
        })
      })
      
      if (!res.ok) throw new Error('Failed to create room')
      
      const data = await res.json()
      
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('playerName', data.player.name)
      sessionStorage.setItem('roomId', data.room.id)
      
      router.push(`/room/${data.room.code}/lobby`)
    } catch (error) {
      toast.error('Failed to create room')
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }
  
  const joinRoom = async () => {
    if (!name.trim()) {
      toast.error('Please enter your name')
      return
    }
    
    if (!roomCode.trim()) {
      toast.error('Please enter room code')
      return
    }
    
    setIsJoining(true)
    
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: roomCode.trim().toUpperCase(),
          name: name.trim()
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to join room')
      }
      
      const data = await res.json()
      
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('playerName', data.player.name)
      sessionStorage.setItem('roomId', data.room.id)
      
      router.push(`/room/${data.room.code}/lobby`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to join room')
      console.error(error)
    } finally {
      setIsJoining(false)
    }
  }
  
  return (
    <>
      <ThemeSelector />
      <ThemeEffects />
      
      <div 
        className="min-h-screen flex items-center justify-center p-4 transition-all duration-500"
        style={{
          background: `linear-gradient(to bottom right, ${currentTheme.colors.gradientFrom}, ${currentTheme.colors.gradientVia}, ${currentTheme.colors.gradientTo})`
        }}
      >
        <Toaster position="top-center" />
        
        <div 
          className="rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full transition-all duration-500"
          style={{ 
            backgroundColor: currentTheme.colors.cardBg,
            color: currentTheme.colors.text
          }}
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🎨📞</div>
            <h1 
              className="text-5xl font-black mb-2"
              style={{
                background: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              DrawPhone
            </h1>
            <p className="text-lg opacity-80">
              The hilarious drawing & guessing game!
            </p>
          </div>
          
          {/* Name input */}
          <div className="mb-6">
            <label 
              className="block text-sm font-bold mb-2"
              style={{ color: currentTheme.colors.text }}
            >
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-lg transition-all"
              style={{
                borderColor: currentTheme.colors.primary + '40',
                backgroundColor: currentTheme.id === 'dark' || currentTheme.id === 'halloween' || currentTheme.id === 'matrix' 
                  ? currentTheme.colors.background 
                  : '#FFFFFF',
                color: currentTheme.colors.text
              }}
              onFocus={(e) => e.target.style.borderColor = currentTheme.colors.primary}
              onBlur={(e) => e.target.style.borderColor = currentTheme.colors.primary + '40'}
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            />
          </div>
          
          {/* Mode Selector Toggle */}
          {!showModeSelector && (
            <button
              onClick={() => setShowModeSelector(true)}
              className="w-full py-3 mb-4 bg-gradient-to-r text-white font-bold rounded-xl transition transform hover:scale-105 text-base shadow-lg"
              style={{
                background: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`
              }}
            >
              🎮 Choose Game Mode
            </button>
          )}
          
          {/* Mode Selector */}
          {showModeSelector && (
            <div className="mb-6">
              <ModeSelector 
                selectedMode={selectedMode}
                onSelectMode={setSelectedMode}
              />
            </div>
          )}
          
          {/* Create room button */}
          <button
            onClick={createRoom}
            disabled={!name.trim() || isCreating}
            className={`w-full py-4 bg-gradient-to-r text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed mb-4 text-lg shadow-lg transition transform hover:scale-105`}
            style={{
              background: !name.trim() || isCreating 
                ? '#9CA3AF' 
                : `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`
            }}
          >
            {isCreating ? 'Creating...' : '🎨 Create Room'}
          </button>
          
          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div 
                className="w-full border-t"
                style={{ borderColor: currentTheme.colors.text + '20' }}
              ></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span 
                className="px-4 font-medium"
                style={{ 
                  backgroundColor: currentTheme.colors.cardBg,
                  color: currentTheme.colors.text,
                  opacity: 0.7
                }}
              >
                or join existing
              </span>
            </div>
          </div>
          
          {/* Join room */}
          <div className="mb-4">
            <label 
              className="block text-sm font-bold mb-2"
              style={{ color: currentTheme.colors.text }}
            >
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF"
              maxLength={6}
              className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-center text-2xl font-bold uppercase tracking-wider transition-all"
              style={{
                borderColor: currentTheme.colors.primary + '40',
                backgroundColor: currentTheme.id === 'dark' || currentTheme.id === 'halloween' || currentTheme.id === 'matrix' 
                  ? currentTheme.colors.background 
                  : '#FFFFFF',
                color: currentTheme.colors.text
              }}
              onFocus={(e) => e.target.style.borderColor = currentTheme.colors.primary}
              onBlur={(e) => e.target.style.borderColor = currentTheme.colors.primary + '40'}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            />
          </div>
          
          <button
            onClick={joinRoom}
            disabled={!name.trim() || !roomCode.trim() || isJoining}
            className="w-full py-4 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg transition transform hover:scale-105"
            style={{
              backgroundColor: !name.trim() || !roomCode.trim() || isJoining 
                ? '#9CA3AF'
                : currentTheme.colors.text === '#22C55E' || currentTheme.id === 'dark'
                  ? currentTheme.colors.primary
                  : '#1F2937'
            }}
          >
            {isJoining ? 'Joining...' : '🚪 Join Room'}
          </button>
        </div>
      </div>
    </>
  )
}