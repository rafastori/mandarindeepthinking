import React, { useState, useRef, useEffect } from 'react';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface PlayerHandProps {
    pieces: DominoPieceType[];
    isMyTurn: boolean;
    selectedPieceId: string | null;
    playablePieceIds: string[];
    onSelectPiece: (piece: DominoPieceType) => void;
    onReorderPieces: (newOrder: DominoPieceType[]) => void;
    onDragPieceToTrain?: (pieceId: string) => void;
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
    onReorderPieces,
    onDragPieceToTrain,
    onDragStart,
    onDragEnd,
    onTrainHover,
    onTrainDrop
}) => {
    // Custom Drag State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const dragRef = useRef<{
        active: boolean;
        timer: NodeJS.Timeout | null;
        startPos: { x: number; y: number };
        pieceId: string | null;
        index: number | null;
    }>({
        active: false,
        timer: null,
        startPos: { x: 0, y: 0 },
        pieceId: null,
        index: null
    });

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Cancel drag on unmount
    useEffect(() => {
        return () => {
            if (dragRef.current.timer) clearTimeout(dragRef.current.timer);
        };
    }, []);

    const handlePointerDown = (e: React.PointerEvent, piece: DominoPieceType, index: number) => {
        // Prevent default only if necessary, but we need scroll to work initially
        // e.preventDefault(); 

        dragRef.current = {
            active: false,
            timer: setTimeout(() => startDrag(e.clientX, e.clientY, piece, index), 1000), // 1000ms long press
            startPos: { x: e.clientX, y: e.clientY },
            pieceId: piece.id,
            index: index
        };
    };

    const startDrag = (x: number, y: number, piece: DominoPieceType, index: number) => {
        dragRef.current.active = true;
        setDraggingId(piece.id);
        setGhostPos({ x, y });
        onDragStart?.(piece.id);

        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.pieceId) return;

        if (!dragRef.current.active) {
            // Check if moved too much - cancel long press (Scroll detection)
            const moveX = Math.abs(e.clientX - dragRef.current.startPos.x);
            const moveY = Math.abs(e.clientY - dragRef.current.startPos.y);

            if (moveX > 10 || moveY > 10) {
                if (dragRef.current.timer) {
                    clearTimeout(dragRef.current.timer);
                    dragRef.current.timer = null;
                    dragRef.current.pieceId = null; // Reset
                }
            }
        } else {
            // Dragging Logic
            e.preventDefault(); // Stop scrolling while dragging
            setGhostPos({ x: e.clientX, y: e.clientY });

            // Check collisions
            const elements = document.elementsFromPoint(e.clientX, e.clientY);

            // 1. Check Reorder (Internal)
            let foundIndex = false;
            for (const el of elements) {
                const indexAttr = el.getAttribute('data-index');
                if (indexAttr) {
                    const idx = parseInt(indexAttr);
                    if (idx !== dragRef.current.index) {
                        setDragOverIndex(idx);
                    }
                    foundIndex = true;
                    break;
                }
            }
            if (!foundIndex) setDragOverIndex(null);

            // 2. Check Train (External)
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
        if (dragRef.current.timer) {
            clearTimeout(dragRef.current.timer);
            dragRef.current.timer = null;
        }

        if (dragRef.current.active && dragRef.current.pieceId && dragRef.current.index !== null) {
            // Dropping
            onTrainHover?.(null); // Clear highlight

            // Check Drop Target
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            let droppedOnTrain = false;

            for (const el of elements) {
                const trainId = el.getAttribute('data-train-id');
                if (trainId) {
                    onTrainDrop?.(trainId, dragRef.current.pieceId);
                    droppedOnTrain = true;
                    break;
                }
            }

            // If not dropped on train, check reorder
            if (!droppedOnTrain && dragOverIndex !== null && dragOverIndex !== dragRef.current.index) {
                const newPieces = [...pieces];
                const [moved] = newPieces.splice(dragRef.current.index, 1);
                newPieces.splice(dragOverIndex, 0, moved);
                onReorderPieces(newPieces);
            }

            onDragEnd?.();
        }

        // Reset
        dragRef.current = { active: false, timer: null, startPos: { x: 0, y: 0 }, pieceId: null, index: null };
        setDraggingId(null);
        setDragOverIndex(null);
    };

    return (
        <div className="relative select-none"> {/* Allow touch scrolling on wrapper */}
            {/* Instructions */}
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                <span>💡</span>
                <span>Segure por 1 segundo para arrastar • Clique para selecionar • Duplo clique para detalhes</span>
            </div>

            {/* Pieces Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4 touch-pan-x" // touch-pan-x allows horizontal scroll
                style={{ touchAction: draggingId ? 'none' : 'pan-x' }} // Disable scroll ONLY when dragging
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()} // Disable context menu
                onWheel={(e) => {
                    if (scrollContainerRef.current && e.deltaY !== 0) {
                        scrollContainerRef.current.scrollLeft += e.deltaY;
                    }
                }}
            >
                {pieces.map((piece, index) => {
                    const isPlayable = playablePieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;
                    const isDragged = draggingId === piece.id;
                    const isDraggedOver = dragOverIndex === index && !isDragged;

                    return (
                        <div
                            key={piece.id}
                            data-index={index}
                            onPointerDown={(e) => handlePointerDown(e, piece, index)}
                            className={`
                                flex-shrink-0 transition-all duration-200 snap-start
                                ${isDraggedOver ? 'transform scale-95 opacity-80' : ''}
                                ${isDragged ? 'opacity-30' : ''}
                            `}
                            style={{
                                marginLeft: isDraggedOver ? '20px' : '0', // Subtle shift
                                transition: 'margin-left 0.2s ease'
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
                        transform: 'translate(-50%, -50%) rotate(-5deg)'
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
