'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Message, Player } from '@/types/game'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatProps {
  roomId: string
  currentPlayer: Player
}

export function Chat({ roomId, currentPlayer }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    setupRealtimeSubscription()
  }, [roomId])

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      scrollToBottom()
    }
  }, [isOpen, messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(50)

    setMessages(data || [])
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => [...prev, newMsg])
          
          if (!isOpen && newMsg.player_id !== currentPlayer.id) {
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return

    try {
      await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          player_id: currentPlayer.id,
          player_name: currentPlayer.name,
          player_color: currentPlayer.color,
          message: newMessage.trim()
        })

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-2xl hover:scale-110 transition transform flex items-center justify-center text-2xl z-50"
      >
        💬
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <h3 className="font-bold text-lg">💬 Chat</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {messages.map((msg) => {
            const isMe = msg.player_id === currentPlayer.id
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    {!isMe && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: msg.player_color }}
                      >
                        {msg.player_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 font-medium">
                      {isMe ? 'You' : msg.player_name}
                    </span>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMe
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            maxLength={200}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 font-bold transition"
          >
            Send
          </button>
        </div>
      </form>
    </motion.div>
  )
}