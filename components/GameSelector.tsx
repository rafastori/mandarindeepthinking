import React from 'react';
import Icon from './Icon';

interface GameSelectorProps {
    onSelectGame: (game: 'lingoarena' | 'polyquest' | 'domino') => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({ onSelectGame }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-3xl w-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* LingoArena Card */}
                    <button
                        onClick={() => onSelectGame('lingoarena')}
                        className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200 hover:border-brand-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-rose-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-orange-200 transition-all duration-300">
                                <Icon name="flame" size={32} className="text-white" fill="currentColor" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">LingoArena</h2>
                            <p className="text-slate-600 text-xs mb-4">
                                Jogo competitivo de vocabulário
                            </p>
                            <div className="flex flex-wrap gap-1 justify-center">
                                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-[10px] font-semibold">Competitivo</span>
                            </div>
                        </div>
                    </button>

                    {/* PolyQuest Card */}
                    <button
                        onClick={() => onSelectGame('polyquest')}
                        className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Icon name="sparkles" size={32} className="text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">PolyQuest</h2>
                            <p className="text-slate-600 text-xs mb-4">
                                Desafio Cooperativo
                            </p>
                            <div className="flex flex-wrap gap-1 justify-center">
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold">Cooperativo</span>
                            </div>
                        </div>
                    </button>

                    {/* Dominó Mexicano Card */}
                    <button
                        onClick={() => onSelectGame('domino')}
                        className="group bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-200 hover:border-orange-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <span className="text-3xl">🎲</span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-2">Dominó</h2>
                            <p className="text-slate-600 text-xs mb-4">
                                Trem Mexicano com termos
                            </p>
                            <div className="flex flex-wrap gap-1 justify-center">
                                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-[10px] font-semibold">2-6 Jogadores</span>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-400">
                        Todos usam sua conta Google para salvar progresso
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GameSelector;
