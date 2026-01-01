import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface HandViewModalProps {
    pieces: DominoPieceType[];
    onClose: () => void;
    onReorder: (newOrder: DominoPieceType[]) => void;
}

export const HandViewModal: React.FC<HandViewModalProps> = ({ pieces, onClose, onReorder }) => {
    // Local state for 'live' sorting
    const [localPieces, setLocalPieces] = useState<DominoPieceType[]>(pieces);
    const [isDragging, setIsDragging] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Ghost Element State
    const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

    const dragRef = useRef<{
        active: boolean;
        startX: number;
        startY: number;
        pieceId: string | null;
        currentIndex: number | null;
        elementWidth: number;
        elementHeight: number;
    }>({
        active: false,
        startX: 0,
        startY: 0,
        pieceId: null,
        currentIndex: null,
        elementWidth: 0,
        elementHeight: 0
    });

    // Valid drop indices ref to avoid recalculating unnecessarily, but elementsFromPoint is safer

    // Sync props to local state if props change (and not dragging)
    useEffect(() => {
        if (!isDragging) {
            setLocalPieces(pieces);
        }
    }, [pieces, isDragging]);

    const handlePointerDown = (e: React.PointerEvent, piece: DominoPieceType, index: number) => {
        const element = e.currentTarget as HTMLElement;
        element.setPointerCapture(e.pointerId);

        const rect = element.getBoundingClientRect();

        dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            pieceId: piece.id,
            currentIndex: index,
            elementWidth: rect.width,
            elementHeight: rect.height
        };

        setDraggingId(piece.id);
        setIsDragging(true);
        setGhostPos({ x: e.clientX, y: e.clientY });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.active || !dragRef.current.pieceId) return;
        e.preventDefault();

        // Update Ghost Position
        setGhostPos({ x: e.clientX, y: e.clientY });

        // Find hover target
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let targetIndex: number | null = null;

        for (const el of elements) {
            const indexAttr = el.getAttribute('data-index');
            if (indexAttr) {
                targetIndex = parseInt(indexAttr);
                break;
            }
        }

        // Live Sort Logic
        if (targetIndex !== null && targetIndex !== dragRef.current.currentIndex) {
            const oldIndex = dragRef.current.currentIndex!;
            const newIndex = targetIndex;

            // Swap in local state
            setLocalPieces(prev => {
                const copy = [...prev];
                const [moved] = copy.splice(oldIndex, 1);
                copy.splice(newIndex, 0, moved);
                return copy;
            });

            // Update ref to new index so we don't swap repeatedly
            dragRef.current.currentIndex = newIndex;

            // Haptic Feedback
            if (navigator.vibrate) navigator.vibrate(10);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragRef.current.active) return;

        const element = e.currentTarget as HTMLElement;
        element.releasePointerCapture(e.pointerId);

        // Commit changes
        onReorder(localPieces);

        // Reset
        dragRef.current = { active: false, startX: 0, startY: 0, pieceId: null, currentIndex: null, elementWidth: 0, elementHeight: 0 };
        setDraggingId(null);
        setIsDragging(false);
    };

    const draggingPiece = pieces.find(p => p.id === draggingId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm touch-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🙌</span>
                        <h2 className="text-lg font-bold text-slate-800">Minhas Peças ({localPieces.length})</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition-colors"
                    >
                        <Icon name="x" size={16} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100 touch-pan-y">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {localPieces.map((piece, index) => {
                            const isBeingDragged = draggingId === piece.id;

                            return (
                                <div
                                    key={piece.id}
                                    data-index={index}
                                    onPointerDown={(e) => handlePointerDown(e, piece, index)}
                                    // Attach events to specific elements is tricky if they move. 
                                    // Better to attach Global Pointer Move/Up to window? 
                                    // But using Capture on the element works if the element moves?
                                    // Actually, if we swap elements in DOM, the captured element might be unmounted or moved?
                                    // React Reconciliation keeps the key, so the DOM node should conceptually stay or move.
                                    // PointerCapture is attached to the DOM node. If React destroys it, capture is lost.
                                    // Safe ref access: always attach move/up to the element we captured.
                                    onPointerMove={isBeingDragged ? handlePointerMove : undefined}
                                    onPointerUp={isBeingDragged ? handlePointerUp : undefined}
                                    className={`
                                        relative rounded-xl transition-all duration-200 p-2 flex justify-center items-center select-none
                                        ${isBeingDragged
                                            ? 'opacity-0' // Invisible placeholder
                                            : 'bg-white shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing border border-slate-200'}
                                    `}
                                    style={{
                                        // If dragged, occupy space but show nothing
                                    }}
                                >
                                    {!isBeingDragged && (
                                        <>
                                            <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-300">
                                                {index + 1}
                                            </span>
                                            <DominoPiece
                                                piece={piece}
                                                size="md"
                                                orientation="vertical"
                                            />
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {localPieces.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Icon name="layout-grid" size={32} className="mb-2 opacity-50" />
                            <p>Sua mão está vazia!</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-transform active:scale-95"
                    >
                        Fechar
                    </button>
                </div>
            </div>

            {/* Ghost Portal */}
            {isDragging && draggingPiece && createPortal(
                <div
                    className="fixed pointer-events-none z-[100] drop-shadow-2xl"
                    style={{
                        left: ghostPos.x,
                        top: ghostPos.y,
                        width: dragRef.current.elementWidth,
                        height: dragRef.current.elementHeight,
                        transform: 'translate(-50%, -50%) rotate(-5deg)',
                    }}
                >
                    <div className="bg-white rounded-xl p-2 h-full w-full flex items-center justify-center border-2 border-blue-400">
                        <DominoPiece
                            piece={draggingPiece}
                            size="md"
                            orientation="vertical"
                            selected={true}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
