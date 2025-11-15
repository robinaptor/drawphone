import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateColor, generateAvatarSeed } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { code, name } = await req.json()
    
    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name required' }, { status: 400 })
    }
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single()
    
    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    if (room.status !== 'lobby') {
      return NextResponse.json({ error: 'Game already started' }, { status: 400 })
    }
    
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
    
    if (count && count >= room.max_players) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 })
    }
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        name: name.trim(),
        color: generateColor(),
        is_host: false,
        is_ready: false,
        is_eliminated: false,
        avatar_seed: generateAvatarSeed()
      })
      .select()
      .single()
    
    if (playerError) throw playerError
    
    return NextResponse.json({ room, player })
    
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
  }
}