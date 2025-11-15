import { Player, Round, GameMode, CadavreExquisPart } from '@/types/game'

// ============================================
// LOGIQUE POUR CADAVRE EXQUIS
// ============================================

export function getCadavreExquisPart(roundNumber: number): CadavreExquisPart {
  if (roundNumber === 0) return 'head'
  if (roundNumber === 1) return 'body'
  return 'legs'
}

export function getCadavreExquisCanvasHeight(): { head: number; body: number; legs: number } {
  return {
    head: 200,    // Top third
    body: 200,    // Middle third
    legs: 200     // Bottom third
  }
}

export function getCadavreExquisJunctionLines(part: CadavreExquisPart) {
  const heights = getCadavreExquisCanvasHeight()
  
  switch (part) {
    case 'head':
      return {
        bottom: { y: heights.head - 20 }  // Ligne visible pour le prochain joueur
      }
    case 'body':
      return {
        top: { y: 20 },     // Ligne de jonction avec la tête
        bottom: { y: heights.body - 20 }  // Ligne pour les jambes
      }
    case 'legs':
      return {
        top: { y: 20 }      // Ligne de jonction avec le corps
      }
    default:
      return {}
  }
}

// ============================================
// LOGIQUE POUR COMBO CHAIN
// ============================================

export function getComboChainZone(playerIndex: number, totalPlayers: number): 'left' | 'center' | 'right' | 'full' {
  if (totalPlayers === 2) {
    return playerIndex === 0 ? 'left' : 'right'
  }
  if (totalPlayers === 3) {
    if (playerIndex === 0) return 'left'
    if (playerIndex === 1) return 'center'
    return 'right'
  }
  // Pour 4 joueurs, on peut faire un grid 2x2
  return 'full'
}

export function getComboChainCanvasZone(zone: 'left' | 'center' | 'right' | 'full', canvasWidth: number, canvasHeight: number) {
  switch (zone) {
    case 'left':
      return { x: 0, y: 0, width: canvasWidth / 2, height: canvasHeight }
    case 'center':
      return { x: canvasWidth / 3, y: 0, width: canvasWidth / 3, height: canvasHeight }
    case 'right':
      return { x: canvasWidth / 2, y: 0, width: canvasWidth / 2, height: canvasHeight }
    case 'full':
      return { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
  }
}

// ============================================
// LOGIQUE POUR PIXEL PERFECT
// ============================================

export function getPixelGridSize(difficulty: 'easy' | 'medium' | 'hard'): { width: number; height: number } {
  switch (difficulty) {
    case 'easy':
      return { width: 16, height: 16 }
    case 'medium':
      return { width: 24, height: 24 }
    case 'hard':
      return { width: 32, height: 32 }
    default:
      return { width: 16, height: 16 }
  }
}

export function getPixelColorPalette(theme: 'default' | 'retro' | 'gameboy'): string[] {
  switch (theme) {
    case 'retro':
      return ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
    case 'gameboy':
      return ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
    default:
      return ['#000000', '#FFFFFF', '#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#0000FF', '#800080']
  }
}

// ============================================
// LOGIQUE POUR MORPH MODE
// ============================================

export function getMorphProgress(roundNumber: number, totalRounds: number): number {
  // Round 0: 0% (objet original)
  // Round final: 100% (objet cible)
  return Math.round((roundNumber / (totalRounds - 1)) * 100)
}

export function getMorphPrompts(): { original: string; target: string }[] {
  return [
    { original: 'Cat', target: 'Rocket' },
    { original: 'Tree', target: 'Robot' },
    { original: 'House', target: 'Spaceship' },
    { original: 'Fish', target: 'Airplane' },
    { original: 'Flower', target: 'Dragon' },
    { original: 'Apple', target: 'Planet' },
    { original: 'Car', target: 'Monster' },
    { original: 'Bird', target: 'Submarine' },
  ]
}

export function getRandomMorphPair(): { original: string; target: string } {
  const pairs = getMorphPrompts()
  return pairs[Math.floor(Math.random() * pairs.length)]
}

// ============================================
// LOGIQUE POUR BATTLE ROYALE
// ============================================

export function getPlayersToEliminateCount(remainingPlayers: number): number {
  if (remainingPlayers <= 2) return 0
  if (remainingPlayers <= 4) return 1
  return 2  // Éliminer 2 joueurs par round
}

export function calculateEliminatedPlayers(
  votes: { voterId: string; targetRoundId: string }[],
  rounds: Round[],
  players: Player[]
): string[] {
  // Compter les votes contre chaque dessin
  const voteCount = new Map<string, number>()
  
  votes.forEach(vote => {
    const count = voteCount.get(vote.targetRoundId) || 0
    voteCount.set(vote.targetRoundId, count + 1)
  })
  
  // Associer les rounds aux joueurs et leurs votes
  const playerVotes = rounds.map(round => ({
    playerId: round.player_id,
    roundId: round.id,
    votes: voteCount.get(round.id) || 0
  }))
  
  // Trier par nombre de votes (décroissant = pire dessin)
  playerVotes.sort((a, b) => b.votes - a.votes)
  
  // Retourner les IDs des joueurs à éliminer
  const toEliminateCount = getPlayersToEliminateCount(players.filter(p => !p.is_eliminated).length)
  return playerVotes.slice(0, toEliminateCount).map(pv => pv.playerId)
}

// ============================================
// ASSIGNMENT LOGIC PAR MODE
// ============================================

export function calculateModeSpecificAssignments(
  gameMode: GameMode,
  players: Player[],
  currentRound: number,
  existingRounds: Round[]
): Map<string, any> {
  const assignments = new Map()
  
  switch (gameMode) {
    case 'cadavre-exquis':
      // Chaque joueur dessine la même partie au même round
      const part = getCadavreExquisPart(currentRound)
      players.forEach(player => {
        const bookId = `book-${player.id}`
        const previousRound = existingRounds.find(
          r => r.book_id === bookId && r.round_number === currentRound - 1
        )
        
        assignments.set(player.id, {
          bookId,
          type: 'draw',
          part,
          previousRound
        })
      })
      break
      
    case 'combo-chain':
      // Tous les joueurs dessinent ensemble
      players.forEach((player, index) => {
        assignments.set(player.id, {
          type: 'collaborative',
          zone: getComboChainZone(index, players.length)
        })
      })
      break
      
    case 'pixel-perfect':
      // Comme classic mais avec pixel art
      players.forEach((player, playerIndex) => {
        const bookIndex = (playerIndex + currentRound) % players.length
        const bookId = `book-${players[bookIndex].id}`
        
        const bookRounds = existingRounds
          .filter(r => r.book_id === bookId)
          .sort((a, b) => a.round_number - b.round_number)
        
        let type: 'prompt' | 'draw' | 'describe'
        if (bookRounds.length === 0) {
          type = 'prompt'
        } else if (bookRounds.length % 2 === 1) {
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
      break
      
    case 'morph-mode':
      // Transformation progressive
      const morphPair = getRandomMorphPair()
      const totalRounds = players.length
      
      players.forEach((player, playerIndex) => {
        const bookIndex = (playerIndex + currentRound) % players.length
        const bookId = `book-${players[bookIndex].id}`
        
        const bookRounds = existingRounds
          .filter(r => r.book_id === bookId)
          .sort((a, b) => a.round_number - b.round_number)
        
        const morphProgress = getMorphProgress(bookRounds.length, totalRounds)
        
        assignments.set(player.id, {
          bookId,
          type: 'draw',
          morphProgress,
          originalPrompt: morphPair.original,
          targetPrompt: morphPair.target,
          previousRound: bookRounds[bookRounds.length - 1]
        })
      })
      break
      
    case 'battle-royale':
      // Tous les joueurs dessinent le même prompt
      const activePlayers = players.filter(p => !p.is_eliminated)
      const prompt = `Battle Round ${currentRound + 1}`
      
      activePlayers.forEach(player => {
        assignments.set(player.id, {
          bookId: `battle-${currentRound}`,
          type: 'draw',
          prompt
        })
      })
      break
      
    default:
      // Classic mode - utiliser la logique existante
      break
  }
  
  return assignments
}