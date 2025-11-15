// app/api/rooms/route.ts - VERSION FINALE RECOMMANDÉE

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GAME_MODE_CONFIGS, GameMode } from '@/types/game'

export async function POST(request: NextRequest) {
  console.log('🚀 [API] POST /api/rooms - START')
  
  try {
    const body = await request.json()
    const playerName = body.hostName || body.playerName
    const gameMode = (body.gameMode || 'classic') as GameMode

    if (!playerName) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    // 1. Créer la room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        game_mode: gameMode,
        status: 'lobby',
        current_round: 0,
        max_rounds: null,
        max_players: GAME_MODE_CONFIGS[gameMode]?.maxPlayers || 12,
        round_time: GAME_MODE_CONFIGS[gameMode]?.defaultRoundTime || 60,
      })
      .select()
      .single()

    if (roomError) {
      console.error('❌ Room error:', roomError)
      return NextResponse.json({ 
        error: 'Failed to create room',
        details: roomError.message 
      }, { status: 500 })
    }

    console.log('✅ Room created:', room)

    // 2. Créer le joueur
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]
    const avatars = ['👤', '😀', '😎', '🤓', '🥳', '🤠', '👻', '🤖', '👽', '🦄']
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)]
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_code: code,        // ← room_code
        name: playerName.trim(),
        avatar: randomAvatar,   // ← avatar
        color: randomColor,     // ← color (après avoir ajouté la colonne)
        is_host: true,
        is_ready: false,        // ← après avoir ajouté la colonne
        is_eliminated: false    // ← après avoir ajouté la colonne
      })
      .select()
      .single()

    if (playerError) {
      console.error('❌ Player error:', playerError)
      await supabase.from('rooms').delete().eq('code', code)
      return NextResponse.json({ 
        error: 'Failed to create player',
        details: playerError.message 
      }, { status: 500 })
    }

    console.log('✅ Player created:', player)
    console.log('✅ Success!')

    return NextResponse.json({ room, player })

  } catch (error: any) {
    console.error('💥 Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}