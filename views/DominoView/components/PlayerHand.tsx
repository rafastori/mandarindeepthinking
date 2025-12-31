import React, { useState, useRef } from 'react';
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
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
    pieces,
    isMyTurn,
    selectedPieceId,
    playablePieceIds,
    onSelectPiece,
    onReorderPieces,
    onDragPieceToTrain
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // Handle drag start
    const handleDragStart = (e: React.DragEvent, index: number) => {
        dragItem.current = index;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pieces[index].id);

        // Add visual feedback - capture element before setTimeout
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => {
            target.style.opacity = '0.5';
        }, 0);
    };

    // Handle drag enter (over another piece)
    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        dragOverItem.current = index;
        setDragOverIndex(index);
    };

    // Handle drag over
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Handle drag end - reorder pieces
    const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }

        if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
            const newPieces = [...pieces];
            const [draggedPiece] = newPieces.splice(dragItem.current, 1);
            newPieces.splice(dragOverItem.current, 0, draggedPiece);
            onReorderPieces(newPieces);
        }

        setDraggedIndex(null);
        setDragOverIndex(null);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    // Touch support for mobile
    const [touchStartIndex, setTouchStartIndex] = useState<number | null>(null);
    const [touchElement, setTouchElement] = useState<HTMLElement | null>(null);

    const handleTouchStart = (e: React.TouchEvent, index: number) => {
        setTouchStartIndex(index);
        if (e.currentTarget instanceof HTMLElement) {
            setTouchElement(e.currentTarget);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartIndex === null || !touchElement) return;

        const touch = e.touches[0];
        const elements = document.elementsFromPoint(touch.clientX, touch.clientY);

        for (const el of elements) {
            const indexAttr = el.getAttribute('data-index');
            if (indexAttr !== null) {
                const overIndex = parseInt(indexAttr);
                if (overIndex !== touchStartIndex) {
                    setDragOverIndex(overIndex);
                }
                break;
            }
        }
    };

    const handleTouchEnd = () => {
        if (touchStartIndex !== null && dragOverIndex !== null && touchStartIndex !== dragOverIndex) {
            const newPieces = [...pieces];
            const [draggedPiece] = newPieces.splice(touchStartIndex, 1);
            newPieces.splice(dragOverIndex, 0, draggedPiece);
            onReorderPieces(newPieces);
        }

        setTouchStartIndex(null);
        setDragOverIndex(null);
        setTouchElement(null);
    };

    return (
        <div className="relative">
            {/* Instructions */}
            <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                <span>💡</span>
                <span>Arraste para reorganizar • Clique para selecionar • Clique novamente para ampliar</span>
            </div>

            {/* Pieces */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {pieces.map((piece, index) => {
                    const isPlayable = playablePieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;
                    const isDraggedOver = dragOverIndex === index && draggedIndex !== index;

                    return (
                        <div
                            key={piece.id}
                            data-index={index}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, index)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            className={`
                                flex-shrink-0 transition-all duration-200 select-none
                                ${isDraggedOver ? 'transform scale-90 opacity-50' : ''}
                                ${draggedIndex === index ? 'opacity-50' : ''}
                            `}
                            style={{
                                marginLeft: isDraggedOver ? '60px' : '0',
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

                            {/* Playable indicator */}
                            {isPlayable && isMyTurn && (
                                <div className="text-center mt-1">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {pieces.length === 0 && (
                <div className="text-center py-4 text-slate-400">
                    <span className="text-2xl">🎉</span>
                    <p className="text-sm mt-1">Sem peças! Você está quase vencendo!</p>
                </div>
            )}
        </div>
    );
};
