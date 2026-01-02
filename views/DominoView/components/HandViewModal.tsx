import React, { useState, useEffect } from 'react';
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
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Sync with props
    useEffect(() => {
        setLocalPieces(pieces);
    }, [pieces]);

    const handlePieceClick = (index: number) => {
        if (selectedIndex === null) {
            // Select first piece
            setSelectedIndex(index);
        } else if (selectedIndex === index) {
            // Deselect
            setSelectedIndex(null);
        } else {
            // Swap pieces
            const newPieces = [...localPieces];
            [newPieces[selectedIndex], newPieces[index]] = [newPieces[index], newPieces[selectedIndex]];
            setLocalPieces(newPieces);
            onReorder(newPieces);
            setSelectedIndex(null);
            playSuccessSound();
            if (navigator.vibrate) navigator.vibrate(30);
        }
    };

    const handleMoveLeft = (index: number) => {
        if (index === 0) return;
        const newPieces = [...localPieces];
        [newPieces[index - 1], newPieces[index]] = [newPieces[index], newPieces[index - 1]];
        setLocalPieces(newPieces);
        onReorder(newPieces);
        playSuccessSound();
    };

    const handleMoveRight = (index: number) => {
        if (index === localPieces.length - 1) return;
        const newPieces = [...localPieces];
        [newPieces[index + 1], newPieces[index]] = [newPieces[index], newPieces[index + 1]];
        setLocalPieces(newPieces);
        onReorder(newPieces);
        playSuccessSound();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                    {selectedIndex !== null
                        ? '✨ Toque em outra peça para trocar posição'
                        : 'Toque em uma peça para selecionar, depois toque em outra para trocar'}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {localPieces.map((piece, index) => {
                            const isSelected = selectedIndex === index;

                            return (
                                <div
                                    key={piece.id}
                                    onClick={() => handlePieceClick(index)}
                                    className={`
                                        relative rounded-xl p-3 flex flex-col items-center select-none cursor-pointer transition-all
                                        ${isSelected
                                            ? 'bg-blue-100 border-2 border-blue-500 ring-2 ring-blue-300 scale-105 shadow-lg'
                                            : 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}
                                    `}
                                >
                                    {/* Position number */}
                                    <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-400">
                                        {index + 1}
                                    </span>

                                    {/* Move buttons when selected */}
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveLeft(index); }}
                                                disabled={index === 0}
                                                className="w-5 h-5 flex items-center justify-center bg-blue-500 text-white rounded text-xs disabled:opacity-30"
                                            >
                                                ←
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMoveRight(index); }}
                                                disabled={index === localPieces.length - 1}
                                                className="w-5 h-5 flex items-center justify-center bg-blue-500 text-white rounded text-xs disabled:opacity-30"
                                            >
                                                →
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-2">
                                        <DominoPiece
                                            piece={piece}
                                            size="md"
                                            orientation="vertical"
                                            selected={isSelected}
                                        />
                                    </div>
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
                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
                    {selectedIndex !== null && (
                        <button
                            onClick={() => setSelectedIndex(null)}
                            className="px-4 py-2 text-slate-600 text-sm"
                        >
                            Cancelar seleção
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors ml-auto"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
