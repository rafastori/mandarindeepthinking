import React, { useRef, useEffect } from 'react';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface PlayerHandProps {
    pieces: DominoPieceType[];
    isMyTurn: boolean;
    selectedPieceId: string | null;
    playablePieceIds: string[];
    onSelectPiece: (piece: DominoPieceType) => void;
    onPieceDoubleClick?: (piece: DominoPieceType) => void;
    // Keeping these signatures to not break GameBoard until we rewrite it, but we won't use them here.
    onDragStart?: (pieceId: string) => void;
    onDragEnd?: () => void;
    onTrainHover?: (trainId: string | null) => void;
    onTrainDrop?: (trainId: string, pieceId: string) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
    pieces,
    isMyTurn,
    selectedPieceId,
    playablePieceIds,
    onSelectPiece,
    onPieceDoubleClick
}) => {
    // Double-tap detection
    const lastTapRef = useRef<{ time: number; pieceId: string | null }>({ time: 0, pieceId: null });

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent, piece: DominoPieceType) => {
        // Check for double-tap
        const now = Date.now();
        if (lastTapRef.current.pieceId === piece.id && now - lastTapRef.current.time < 300) {
            e.preventDefault();
            onPieceDoubleClick?.(piece);
            lastTapRef.current = { time: 0, pieceId: null };
            return;
        }
        lastTapRef.current = { time: now, pieceId: piece.id };

        // Regular selection logic happens via onClick passed down to DominoPiece,
        // but since we catch pointer down for double tap, we let React handle the click bubbled event.
    };

    // Auto-scroll to selected piece if needed
    useEffect(() => {
        if (selectedPieceId && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const selectedElement = container.querySelector(`[data-piece-id="${selectedPieceId}"]`) as HTMLElement;

            if (selectedElement) {
                // Ensure the selected element is visible in the scroll view
                const containerRect = container.getBoundingClientRect();
                const elRect = selectedElement.getBoundingClientRect();

                if (elRect.left < containerRect.left || elRect.right > containerRect.right) {
                    container.scrollTo({
                        left: selectedElement.offsetLeft - container.clientWidth / 2 + selectedElement.clientWidth / 2,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }, [selectedPieceId]);

    return (
        <div className="relative select-none">
            {/* Instructions */}
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 font-medium">
                <span>💡</span>
                <span>{isMyTurn ? "Toque numa peça brilhante para jogar. Toque duplo amplia." : "Esperando sua vez..."}</span>
            </div>

            {/* Pieces Container - Native horizontal scroll */}
            <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto pb-8 pt-6 scrollbar-hide snap-x px-4 min-h-[160px] items-center"
                style={{ WebkitOverflowScrolling: 'touch' }}
                onContextMenu={(e) => e.preventDefault()}
            >
                {pieces.map((piece) => {
                    const isPlayable = playablePieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;
                    const isUnplayableList = isMyTurn && pieces.length > 0 && playablePieceIds.length > 0 && !isPlayable;

                    return (
                        <div
                            key={piece.id}
                            data-piece-id={piece.id}
                            onPointerDown={(e) => handlePointerDown(e, piece)}
                            className="flex-shrink-0 transition-transform duration-200 snap-center"
                        >
                            <DominoPiece
                                piece={piece}
                                orientation="vertical"
                                selected={isSelected}
                                disabled={!isMyTurn}
                                canPlay={isPlayable && isMyTurn}
                                isUnplayableInHand={isUnplayableList}
                                onClick={() => onSelectPiece(piece)}
                                size="lg" // Bigger pieces in the hand for easy reading
                            />
                        </div>
                    );
                })}
            </div>

            {pieces.length === 0 && (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <span className="text-3xl">🎉</span>
                    <p className="font-bold mt-2 text-slate-500">Mão Vazia!</p>
                </div>
            )}
        </div>
    );
};
