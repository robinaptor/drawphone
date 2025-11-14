import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateRoomCode, generateColor, generateAvatarSeed } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { hostName } = await req.json()
    
    if (!hostName || hostName.trim().length === 0) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    
    let code = generateRoomCode()
    let attempts = 0
    
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('code')
        .eq('code', code)
        .single()
      
      if (!existing) break
      code = generateRoomCode()
      attempts++
    }
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        max_rounds: 6,
      })
      .select()
      .single()
    
    if (roomError) throw roomError
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        name: hostName.trim(),
        color: generateColor(),
        is_host: true,
        is_ready: false,
        avatar_seed: generateAvatarSeed()
      })
      .select()
      .single()
    
    if (playerError) throw playerError
    
    await supabase
      .from('rooms')
      .update({ host_id: player.id })
      .eq('id', room.id)
    
    return NextResponse.json({ 
      room: { ...room, host_id: player.id },
      player 
    })
    
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}