'use client'

import { useState } from 'react'
import { Room } from '@/types/game'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface GameSettingsProps {
  room: Room
  isHost: boolean
}

export function GameSettings({ room, isHost }: GameSettingsProps) {
  const [roundTime, setRoundTime] = useState(room.round_time)
  const [maxPlayers, setMaxPlayers] = useState(room.max_players)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const saveSettings = async () => {
    if (!isHost) {
      toast.error('Only the host can change settings')
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          round_time: roundTime,
          max_players: maxPlayers
        })
        .eq('id', room.id)

      if (error) throw error

      toast.success('Settings saved!')
      setIsOpen(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
      >
        ⚙️ Settings
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-800">⚙️ Game Settings</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Round Time */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              ⏱️ Time per Round
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="30"
                max="120"
                step="15"
                value={roundTime}
                onChange={(e) => setRoundTime(Number(e.target.value))}
                disabled={!isHost}
                className="flex-1"
              />
              <span className="text-2xl font-bold text-purple-600 w-20 text-center">
                {roundTime}s
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30s</span>
              <span>60s</span>
              <span>90s</span>
              <span>120s</span>
            </div>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              👥 Max Players
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="3"
                max="12"
                step="1"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                disabled={!isHost}
                className="flex-1"
              />
              <span className="text-2xl font-bold text-purple-600 w-20 text-center">
                {maxPlayers}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>8</span>
              <span>12</span>
            </div>
          </div>

          {!isHost && (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 text-sm text-yellow-800">
              ℹ️ Only the host can change settings
            </div>
          )}
        </div>

        {isHost && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-bold transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}