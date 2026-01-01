import { DominoRoom, Train, DominoPiece } from '../types';

/**
 * Result of a Bot Logic calculation
 */
export interface BotMoveResult {
    action: 'place' | 'draw' | 'pass';
    pieceId?: string;
    trainId?: string;
    flipped?: boolean;
}

/**
 * Checks if a piece can be played on a specific train
 */
const canPlayOnTrain = (piece: DominoPiece, train: Train): { can: boolean; flipped: boolean } => {
    if (piece.leftIndex === train.openEndIndex) return { can: true, flipped: false };
    if (piece.rightIndex === train.openEndIndex) return { can: true, flipped: true };
    return { can: false, flipped: false };
};

/**
 * Calculates the best move for a bot
 */
export const calculateBotMove = (room: DominoRoom, botId: string): BotMoveResult => {
    const player = room.players.find(p => p.id === botId);
    if (!player) return { action: 'pass' }; // Should not happen

    // 1. Identify valid trains this bot can play on
    // - Mexican Train (always open if exists)
    // - Own Train (always open for owner)
    // - Other Players' Trains (if isOpen is true)
    const validTrains = room.trains.filter(train => {
        const isMexican = train.ownerId === null;
        const isMine = train.ownerId === botId;
        return isMexican || isMine || train.isOpen;
    });

    // 2. Search for ANY valid move in hand
    // Improved Heuristic:
    // - Prefer playing doubles? (Usually good strategy)
    // - Prefer playing on own train to keep it private?
    // - Prefer playing on Mexican train to save own train?

    // Simple Heuristic V1: First valid move found
    for (const piece of player.hand) {
        for (const train of validTrains) {
            const check = canPlayOnTrain(piece, train);
            if (check.can) {
                return {
                    action: 'place',
                    pieceId: piece.id,
                    trainId: train.id,
                    flipped: check.flipped
                };
            }
        }
    }

    // 3. If no move found, Draw or Pass
    // If boneyard is empty, must Pass. If not, Draw.
    // The GameBoard logic handles "Pass" generally only if boneyard is empty OR if player already acted?
    // In Mexican Train standard rules: If cannot play, Draw. If drawn piece plays, play it. If not, Pass.
    // Our simplify logic for now: If boneyard > 0, Draw. Else Pass.

    if (room.boneyard.length > 0) {
        return { action: 'draw' };
    }

    return { action: 'pass' };
};
