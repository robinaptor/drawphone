import { Player, Round } from '@/types/game'

export function calculateRoundAssignments(
  players: Player[],
  currentRound: number,
  rounds: Round[]
) {
  // ordre stable par joined_at
  const order = [...players].sort((a, b) =>
    new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  )
  const n = order.length
  const assignments = new Map<string, {
    bookId: string
    type: 'prompt' | 'draw' | 'describe'
    previousRound?: Round
  }>()

  order.forEach((player, i) => {
    if (currentRound === 0) {
      assignments.set(player.id, { bookId: player.id, type: 'prompt' })
      return
    }

    const offset = currentRound % n
    const ownerIndex = (i - offset + n) % n
    const bookOwner = order[ownerIndex]
    const bookId = bookOwner.id

    const prev = rounds.find(r =>
      r.book_id === bookId && r.round_number === currentRound - 1
    )

    const type: 'draw' | 'describe' =
      prev?.type === 'prompt' ? 'draw' : 'describe'

    assignments.set(player.id, {
      bookId,
      type,
      previousRound: prev
    })
  })

  return assignments
}

export function organizeIntoBooks(rounds: Round[], players: Player[]): Map<string, Round[]> {
  const books = new Map<string, Round[]>()
  
  rounds.forEach(round => {
    if (!books.has(round.book_id)) {
      books.set(round.book_id, [])
    }
    books.get(round.book_id)!.push(round)
  })
  
  books.forEach(bookRounds => {
    bookRounds.sort((a, b) => a.round_number - b.round_number)
  })
  
  return books
}