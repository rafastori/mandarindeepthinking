import React from 'react';
import Icon from '../../../components/Icon';
import { Train, DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';

interface TrainViewModalProps {
    train: Train;
    isMyTrain: boolean;
    onClose: () => void;
}

export const TrainViewModal: React.FC<TrainViewModalProps> = ({ train, isMyTrain, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{isMyTrain ? '🏠' : '🚂'}</span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                {isMyTrain ? 'Meu Trem' : 'Trem'}
                            </h2>
                            <p className="text-xs text-slate-500">{train.pieces.length} peças jogadas</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 transition-colors"
                    >
                        <Icon name="x" size={16} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {train.pieces.map((placed, index) => (
                            <div
                                key={`${train.id}-grid-${index}`}
                                className="relative bg-white rounded-xl shadow-sm p-2 flex justify-center items-center border border-slate-200"
                            >
                                <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-300">
                                    {index + 1}
                                </span>
                                <DominoPiece
                                    piece={placed.piece}
                                    size="md"
                                    orientation="vertical"
                                    flipped={placed.orientation === 'flipped'}
                                />
                                {index === train.pieces.length - 1 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {train.pieces.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Icon name="train" size={32} className="mb-2 opacity-50" />
                            <p>Nenhuma peça neste trem ainda!</p>
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
        </div>
    );
};
