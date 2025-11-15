// app/api/join/route.ts - ADAPTÉ

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { code, name } = await request.json()

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Room code and name are required' },
        { status: 400 }
      )
    }

    // 1. Vérifier que la room existe
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // 2. Vérifier que la room est en lobby
    if (room.status !== 'lobby') {
      return NextResponse.json(
        { error: 'Game already started' },
        { status: 400 }
      )
    }

    // 3. Vérifier le nombre de joueurs
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', code.toUpperCase())

    if (players && players.length >= room.max_players) {
      return NextResponse.json(
        { error: 'Room is full' },
        { status: 400 }
      )
    }

    // 4. Créer le joueur
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    const avatars = ['👤', '😀', '😎', '🤓', '🥳', '🤠', '👻', '🤖', '👽', '🦄']
    const usedAvatars = players?.map(p => p.avatar) || []
    const availableAvatars = avatars.filter(a => !usedAvatars.includes(a))
    const randomAvatar = availableAvatars[Math.floor(Math.random() * availableAvatars.length)] || avatars[0]

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_code: code.toUpperCase(),
        name: name.trim(),
        avatar: randomAvatar,
        is_host: false
      })
      .select()
      .single()

    if (playerError) {
      console.error('Player error:', playerError)
      return NextResponse.json(
        { error: 'Failed to join room' },
        { status: 500 }
      )
    }

    return NextResponse.json({ room, player })

  } catch (error: any) {
    console.error('Error in /api/join:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}