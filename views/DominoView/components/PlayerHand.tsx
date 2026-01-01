import React, { useState, useRef, useEffect } from 'react';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface PlayerHandProps {
    pieces: DominoPieceType[];
    isMyTurn: boolean;
    selectedPieceId: string | null;
    playablePieceIds: string[];
    onSelectPiece: (piece: DominoPieceType) => void;
    onDragStart?: (pieceId: string) => void;
    onDragEnd?: () => void;
    onTrainHover?: (trainId: string | null) => void;
    onTrainDrop?: (trainId: string, pieceId: string) => void;
    onPieceDoubleClick?: (piece: DominoPieceType) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
    pieces,
    isMyTurn,
    selectedPieceId,
    playablePieceIds,
    onSelectPiece,
    onDragStart,
    onDragEnd,
    onTrainHover,
    onTrainDrop,
    onPieceDoubleClick
}) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

    const dragRef = useRef<{
        active: boolean;
        startPos: { x: number; y: number };
        pieceId: string | null;
        piece: DominoPieceType | null;
    }>({
        active: false,
        startPos: { x: 0, y: 0 },
        pieceId: null,
        piece: null
    });

    // Double-tap detection
    const lastTapRef = useRef<{ time: number; pieceId: string | null }>({ time: 0, pieceId: null });

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handlePointerDown = (e: React.PointerEvent, piece: DominoPieceType) => {
        // Check for double-tap first
        const now = Date.now();
        if (lastTapRef.current.pieceId === piece.id && now - lastTapRef.current.time < 300) {
            e.preventDefault();
            onPieceDoubleClick?.(piece);
            lastTapRef.current = { time: 0, pieceId: null };
            return;
        }
        lastTapRef.current = { time: now, pieceId: piece.id };

        // Store start position for direction detection
        dragRef.current = {
            active: false,
            startPos: { x: e.clientX, y: e.clientY },
            pieceId: piece.id,
            piece: piece
        };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.pieceId || !dragRef.current.piece) return;

        const deltaX = e.clientX - dragRef.current.startPos.x;
        const deltaY = e.clientY - dragRef.current.startPos.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (!dragRef.current.active) {
            // Direction detection: determine if horizontal scroll or vertical drag
            const totalMove = Math.sqrt(absX * absX + absY * absY);

            if (totalMove > 15) {
                // Check direction
                if (absY > absX && deltaY < -10) {
                    // Moving UP = start drag to train
                    e.preventDefault();
                    dragRef.current.active = true;
                    setDraggingId(dragRef.current.pieceId);
                    setGhostPos({ x: e.clientX, y: e.clientY });
                    onDragStart?.(dragRef.current.pieceId);

                    if (navigator.vibrate) navigator.vibrate(30);
                } else if (absX > absY) {
                    // Moving HORIZONTAL = cancel and allow scroll
                    dragRef.current.pieceId = null;
                    dragRef.current.piece = null;
                }
            }
        } else {
            // Already dragging - update ghost position and check targets
            e.preventDefault();
            setGhostPos({ x: e.clientX, y: e.clientY });

            // Check train targets
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            let foundTrain = false;
            for (const el of elements) {
                const trainId = el.getAttribute('data-train-id');
                if (trainId) {
                    onTrainHover?.(trainId);
                    foundTrain = true;
                    break;
                }
            }
            if (!foundTrain) onTrainHover?.(null);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragRef.current.active && dragRef.current.pieceId) {
            onTrainHover?.(null);

            // Check if dropped on a train
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            for (const el of elements) {
                const trainId = el.getAttribute('data-train-id');
                if (trainId) {
                    onTrainDrop?.(trainId, dragRef.current.pieceId);
                    break;
                }
            }

            onDragEnd?.();
        }

        // Reset
        dragRef.current = { active: false, startPos: { x: 0, y: 0 }, pieceId: null, piece: null };
        setDraggingId(null);
    };

    const handlePointerCancel = () => {
        dragRef.current = { active: false, startPos: { x: 0, y: 0 }, pieceId: null, piece: null };
        setDraggingId(null);
        onTrainHover?.(null);
    };

    return (
        <div className="relative select-none">
            {/* Instructions */}
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                <span>💡</span>
                <span>Arraste para cima ↑ para jogar • Toque duplo para ampliar</span>
            </div>

            {/* Pieces Container - Native horizontal scroll */}
            <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4"
                style={{
                    touchAction: draggingId ? 'none' : 'pan-x',
                    WebkitOverflowScrolling: 'touch'
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(e) => e.preventDefault()}
            >
                {pieces.map((piece) => {
                    const isPlayable = playablePieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;
                    const isDragged = draggingId === piece.id;

                    return (
                        <div
                            key={piece.id}
                            onPointerDown={(e) => handlePointerDown(e, piece)}
                            className={`
                                flex-shrink-0 transition-all duration-200 snap-start
                                ${isDragged ? 'opacity-30 scale-95' : ''}
                            `}
                            style={{
                                touchAction: draggingId ? 'none' : 'pan-x' // Allow horizontal scroll on cards
                            }}
                        >
                            <DominoPiece
                                piece={piece}
                                orientation="vertical"
                                selected={isSelected}
                                disabled={!isMyTurn}
                                canPlay={isPlayable && isMyTurn}
                                onClick={() => onSelectPiece(piece)}
                                size="md"
                            />
                            {isPlayable && isMyTurn && (
                                <div className="text-center mt-1">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Ghost Piece (Draggable Overlay) */}
            {draggingId && (
                <div
                    className="fixed pointer-events-none z-50 shadow-2xl scale-110 opacity-90"
                    style={{
                        left: ghostPos.x,
                        top: ghostPos.y,
                        transform: 'translate(-50%, -50%) rotate(-3deg)'
                    }}
                >
                    <DominoPiece
                        piece={pieces.find(p => p.id === draggingId)!}
                        orientation="vertical"
                        size="md"
                        selected={true}
                    />
                </div>
            )}

            {pieces.length === 0 && (
                <div className="text-center py-4 text-slate-400">
                    <span className="text-2xl">🎉</span>
                    <p className="text-sm mt-1">Sem peças!</p>
                </div>
            )}
        </div>
    );
};
