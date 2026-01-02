import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface HandViewModalProps {
    pieces: DominoPieceType[];
    onClose: () => void;
    onReorder: (newOrder: DominoPieceType[]) => void;
}

// Simple success sound using Web Audio API
const playSuccessSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
        oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1); // C#6 note

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        // Audio not supported
    }
};

export const HandViewModal: React.FC<HandViewModalProps> = ({ pieces, onClose, onReorder }) => {
    const [localPieces, setLocalPieces] = useState<DominoPieceType[]>(pieces);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [ghostStyle, setGhostStyle] = useState<React.CSSProperties>({});
    const [didReorder, setDidReorder] = useState(false);

    const dragRef = useRef<{
        active: boolean;
        pieceId: string | null;
        currentIndex: number;
        originalIndex: number;
        elementRect: DOMRect | null;
        rafId: number | null;
        pendingPos: { x: number; y: number } | null;
    }>({
        active: false,
        pieceId: null,
        currentIndex: 0,
        originalIndex: 0,
        elementRect: null,
        rafId: null,
        pendingPos: null
    });

    // Sync props when not dragging
    useEffect(() => {
        if (!dragRef.current.active) {
            setLocalPieces(pieces);
        }
    }, [pieces]);

    // Global pointer move handler
    const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (!dragRef.current.active) return;
        e.preventDefault();

        // Queue position update for RAF
        dragRef.current.pendingPos = { x: e.clientX, y: e.clientY };

        if (!dragRef.current.rafId) {
            dragRef.current.rafId = requestAnimationFrame(() => {
                const pos = dragRef.current.pendingPos;
                if (pos && dragRef.current.elementRect) {
                    setGhostStyle({
                        left: pos.x,
                        top: pos.y,
                        width: dragRef.current.elementRect.width,
                        height: dragRef.current.elementRect.height
                    });

                    // Find hover target
                    const elements = document.elementsFromPoint(pos.x, pos.y);
                    let targetIndex: number | null = null;

                    for (const el of elements) {
                        const indexAttr = el.getAttribute('data-reorder-index');
                        if (indexAttr) {
                            targetIndex = parseInt(indexAttr);
                            break;
                        }
                    }

                    // Swap if needed
                    if (targetIndex !== null && targetIndex !== dragRef.current.currentIndex) {
                        const oldIndex = dragRef.current.currentIndex;

                        setLocalPieces(prev => {
                            const copy = [...prev];
                            const [moved] = copy.splice(oldIndex, 1);
                            copy.splice(targetIndex!, 0, moved);
                            return copy;
                        });

                        dragRef.current.currentIndex = targetIndex;
                        setDidReorder(true);

                        // Haptic
                        if (navigator.vibrate) navigator.vibrate(10);
                    }
                }
                dragRef.current.rafId = null;
            });
        }
    }, []);

    // Global pointer up handler
    const handleGlobalPointerUp = useCallback(() => {
        if (!dragRef.current.active) return;

        // Cancel pending RAF
        if (dragRef.current.rafId) {
            cancelAnimationFrame(dragRef.current.rafId);
            dragRef.current.rafId = null;
        }

        // Play success sound if reordered
        if (didReorder) {
            playSuccessSound();
            setDidReorder(false);
        }

        // Commit changes
        onReorder(localPieces);

        // Reset
        dragRef.current = {
            active: false,
            pieceId: null,
            currentIndex: 0,
            originalIndex: 0,
            elementRect: null,
            rafId: null,
            pendingPos: null
        };
        setDraggingId(null);
    }, [localPieces, onReorder, didReorder]);

    // Attach/detach global listeners
    useEffect(() => {
        if (draggingId) {
            window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
            window.addEventListener('pointerup', handleGlobalPointerUp);

            return () => {
                window.removeEventListener('pointermove', handleGlobalPointerMove);
                window.removeEventListener('pointerup', handleGlobalPointerUp);
            };
        }
    }, [draggingId, handleGlobalPointerMove, handleGlobalPointerUp]);

    const handlePointerDown = (e: React.PointerEvent, piece: DominoPieceType, index: number) => {
        e.preventDefault();
        const element = e.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();

        dragRef.current = {
            active: true,
            pieceId: piece.id,
            currentIndex: index,
            originalIndex: index,
            elementRect: rect,
            rafId: null,
            pendingPos: null
        };

        setDraggingId(piece.id);
        setDidReorder(false);
        setGhostStyle({
            left: e.clientX,
            top: e.clientY,
            width: rect.width,
            height: rect.height
        });
    };

    const draggingPiece = localPieces.find(p => p.id === draggingId);

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

                {/* Instruction */}
                <div className="px-4 py-2 bg-blue-50 text-blue-700 text-xs text-center">
                    Segure e arraste para reorganizar suas peças
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {localPieces.map((piece, index) => {
                            const isBeingDragged = draggingId === piece.id;

                            return (
                                <div
                                    key={piece.id}
                                    data-reorder-index={index}
                                    onPointerDown={(e) => handlePointerDown(e, piece, index)}
                                    className={`
                                        relative rounded-xl transition-transform duration-150 p-2 flex justify-center items-center select-none
                                        ${isBeingDragged
                                            ? 'opacity-30 scale-95 bg-blue-100 border-2 border-dashed border-blue-300'
                                            : 'bg-white shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing border border-slate-200'}
                                    `}
                                >
                                    <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-300">
                                        {index + 1}
                                    </span>
                                    <DominoPiece
                                        piece={piece}
                                        size="md"
                                        orientation="vertical"
                                    />
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
            {draggingId && draggingPiece && createPortal(
                <div
                    className="fixed pointer-events-none z-[100] drop-shadow-2xl"
                    style={{
                        left: ghostStyle.left,
                        top: ghostStyle.top,
                        width: ghostStyle.width,
                        height: ghostStyle.height,
                        transform: 'translate(-50%, -50%) rotate(-5deg) scale(1.05)',
                        transition: 'transform 0.05s ease-out'
                    }}
                >
                    <div className="bg-white rounded-xl p-2 h-full w-full flex items-center justify-center border-2 border-blue-400 shadow-xl">
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
