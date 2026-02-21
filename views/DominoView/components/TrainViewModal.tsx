import React, { useEffect, useRef } from 'react';
import Icon from '../../../components/Icon';
import { Train, DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface TrainViewModalProps {
    train: Train;
    isMyTrain: boolean;
    onClose: () => void;
    onPieceClick?: (piece: DominoPieceType) => void;
}

export const TrainViewModal: React.FC<TrainViewModalProps> = ({ train, isMyTrain, onClose, onPieceClick }) => {
    const endOfTrainRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Auto scroll para o fim do trem ao montar
        if (endOfTrainRef.current) {
            endOfTrainRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [train.pieces.length]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border border-slate-700">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl shadow-inner border border-slate-600">
                            {isMyTrain ? '🏠' : '🚂'}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-200 uppercase tracking-wide">
                                {isMyTrain ? 'Meu Trem' : 'Histórico do Trem'}
                            </h2>
                            <p className="text-sm font-bold text-slate-400 bg-slate-900/50 px-2 rounded w-fit mt-0.5">{train.pieces.length} peças enfileiradas</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-95 border border-slate-600 shadow-md"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Train Track Viewer */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-[#1c2e26] p-8 flex flex-col items-center">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                    {train.pieces.length === 0 ? (
                        <div className="w-full h-full flex justify-center text-slate-400 font-bold opacity-50 flex-col items-center">
                            <span className="text-6xl mb-4 grayscale">👻</span>
                            <span>Ainda não há peças neste trem.</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center min-h-max pb-32 relative z-10 w-full py-[5vh]">
                            {/* The "Head" or Origin point visualization */}
                            <div className="flex flex-col items-center opacity-40 mb-2 flex-shrink-0 relative">
                                <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse absolute -top-6" />
                                <div className="w-2 h-12 bg-slate-500 rounded-full" />
                            </div>

                            {train.pieces.map((placed, index) => {
                                // Feed Vertical: Duplos (x/x) ficam deitadinhos na horizontal. Normais ficam na vertical.
                                const isDouble = placed.piece.leftIndex === placed.piece.rightIndex;
                                const orientation = isDouble ? 'horizontal' : 'vertical';
                                const isLast = index === train.pieces.length - 1;

                                return (
                                    <div
                                        key={`${train.id}-chain-${index}`}
                                        className={`flex flex-col items-center hover:scale-105 transition-transform cursor-pointer relative ${isDouble ? '-my-2' : '-my-1'} z-10 group`}
                                        onClick={() => onPieceClick?.(placed.piece)}
                                    >
                                        <div className={`
                                            drop-shadow-2xl flex justify-center w-full
                                            ${isLast ? 'ring-4 ring-green-400 ring-offset-4 ring-offset-[#1c2e26] rounded-xl scale-110 z-20 shadow-green-900/50' : ''}
                                        `}>
                                            <DominoPiece
                                                piece={placed.piece}
                                                size="xl" // Render highly legible large pieces for history
                                                orientation={orientation}
                                                flipped={placed.orientation === 'flipped'}
                                            />
                                        </div>
                                        {isLast && (
                                            <div className="absolute top-1/2 -right-[100px] -translate-y-1/2 bg-green-500 text-white font-black text-[10px] px-2 py-1 rounded-full uppercase tracking-widest shadow-lg pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                Ponta Atual
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={endOfTrainRef} className="h-10 w-full" />
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center text-slate-400 font-medium text-sm">
                    <div className="flex items-center gap-2">
                        <span>👆</span>
                        <span>Toque em qualquer peça para ver sua definição detalhada</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
