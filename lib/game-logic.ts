import { Player, Round } from '@/types/game'

export function calculateRoundAssignments(
  players: Player[],
  currentRound: number,
  existingRounds: Round[]
): Map<string, { bookId: string; type: 'prompt' | 'draw' | 'describe'; previousRound?: Round }> {
  const assignments = new Map()
  
  players.forEach((player, playerIndex) => {
    const bookIndex = (playerIndex + currentRound) % players.length
    const bookId = `book-${players[bookIndex].id}`
    
    const bookRounds = existingRounds
      .filter(r => r.book_id === bookId)
      .sort((a, b) => a.round_number - b.round_number)
    
    let type: 'prompt' | 'draw' | 'describe'
    const roundsInBook = bookRounds.length
    
    if (roundsInBook === 0) {
      type = 'prompt'
    } else if (roundsInBook % 2 === 1) {
      type = 'draw'
    } else {
      type = 'describe'
    }
    
    assignments.set(player.id, {
      bookId,
      type,
      previousRound: bookRounds[bookRounds.length - 1]
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