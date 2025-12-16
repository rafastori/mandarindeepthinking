import React from 'react';
import Icon from '../../components/Icon';
import { GameCard } from '../../types';

interface ReviewPhaseProps {
    deck: GameCard[];
    isHost: boolean;
    onCancel: () => void;
    onStartGame: () => void;
}

export const ReviewPhase: React.FC<ReviewPhaseProps> = ({ deck, isHost, onCancel, onStartGame }) => {
    return (
        <>
            {/* 1. Lista de Cartas (Simplificada) */}
            <div className="animate-in slide-in-from-bottom-4 fade-in pb-32">
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                    <Icon name="info" className="text-purple-500 mt-1 flex-shrink-0" size={20} />
                    <div>
                        <h4 className="font-bold text-purple-800 text-sm">Palavras Geradas</h4>
                        <p className="text-xs text-purple-600 mt-1">
                            {isHost ? "Confira as palavras que serão usadas na partida." : "O Host está revisando as palavras."}
                        </p>
                    </div>
                </div>

                {/* Grid de Palavras (Visual Limpo) */}
                <div className="grid grid-cols-2 gap-3">
                    {deck.map((card, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-center opacity-90 min-h-[80px]">
                            <p className="font-bold text-slate-700 text-lg">
                                {card.word}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Barra de Ação (Fixa) */}
            {isHost && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[100]">
                    <div className="flex gap-3 max-w-3xl mx-auto">
                        <button 
                            onClick={onCancel} 
                            className="flex-1 bg-white border border-slate-200 text-slate-600 py-3.5 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={onStartGame} 
                            className="flex-[2] bg-green-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 flex items-center justify-center gap-2 hover:bg-green-700 active:scale-95 transition-all"
                        >
                            <Icon name="play" size={20} /> 
                            Iniciar Jogo
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};