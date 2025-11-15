export interface Room {
  id: string
  code: string
  host_id: string
  status: 'lobby' | 'playing' | 'voting' | 'results' | 'finished'
  max_players: number
  round_time: number
  current_round: number
  max_rounds: number
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  name: string
  color: string
  is_host: boolean
  is_ready: boolean
  avatar_seed: string
  created_at: string
}

export interface Round {
  id: string
  room_id: string
  book_id: string
  round_number: number
  player_id: string
  type: 'prompt' | 'draw' | 'describe'
  content: PromptContent | DrawingContent
  created_at: string
}

export interface PromptContent {
  text: string
}

export interface DrawingContent {
  strokes: Stroke[]
  width: number
  height: number
}

export interface Stroke {
  points: Point[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
}

export interface Point {
  x: number
  y: number
}

export interface Vote {
  id: string
  room_id: string
  voter_id: string
  round_id: string
  created_at: string
}

export interface Message {
     id: string
     room_id: string
     player_id: string
     player_name: string
     player_color: string
     message: string
     created_at: string
   }