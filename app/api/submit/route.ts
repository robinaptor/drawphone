import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { roomId, playerId, bookId, roundNumber, type, content } = await req.json()
    
    const { data: round, error } = await supabase
      .from('rounds')
      .insert({
        room_id: roomId,
        player_id: playerId,
        book_id: bookId,
        round_number: roundNumber,
        type,
        content
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ round })
    
  } catch (error) {
    console.error('Error submitting round:', error)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}