'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  
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
        body: JSON.stringify({ hostName: name.trim() })
      })
      
      if (!res.ok) throw new Error('Failed to create room')
      
      const data = await res.json()
      
      // ✅ CHANGEMENT ICI : sessionStorage au lieu de localStorage
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
      
      // ✅ CHANGEMENT ICI : sessionStorage au lieu de localStorage
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
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🎨📞</div>
          <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            DrawPhone
          </h1>
          <p className="text-gray-600 text-lg">
            The hilarious drawing & guessing game!
          </p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-gray-700">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg"
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
          />
        </div>
        
        <button
          onClick={createRoom}
          disabled={!name.trim() || isCreating}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed mb-4 text-lg shadow-lg transition transform hover:scale-105"
        >
          {isCreating ? 'Creating...' : '🎨 Create Room'}
        </button>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500 font-medium">or join existing</span>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-bold mb-2 text-gray-700">
            Room Code
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABCDEF"
            maxLength={6}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-center text-2xl font-bold uppercase tracking-wider"
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          />
        </div>
        
        <button
          onClick={joinRoom}
          disabled={!name.trim() || !roomCode.trim() || isJoining}
          className="w-full py-4 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg transition transform hover:scale-105"
        >
          {isJoining ? 'Joining...' : '🚪 Join Room'}
        </button>
        
        <div className="mt-8 p-4 bg-purple-50 rounded-xl">
          <h3 className="font-bold text-purple-900 mb-2">How to Play:</h3>
          <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
            <li>Someone writes a sentence</li>
            <li>Next player draws it</li>
            <li>Next player describes the drawing</li>
            <li>Repeat until everyone&apos;s done!</li>
            <li>See the hilarious results! 😂</li>
          </ol>
        </div>
      </div>
    </div>
  )
}