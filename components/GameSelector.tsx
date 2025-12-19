import React from 'react';
import Icon from './Icon';

interface GameSelectorProps {
    onSelectGame: (game: 'lingoarena' | 'polyquest') => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({ onSelectGame }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-2xl w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LingoArena Card */}
                    <button
                        onClick={() => onSelectGame('lingoarena')}
                        className="group bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200 hover:border-brand-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Icon name="swords" size={40} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">LingoArena</h2>
                            <p className="text-slate-600 text-sm mb-4">
                                Jogo multiplayer competitivo onde você e seus amigos testam conhecimentos de vocabulário em tempo real
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold">Multiplayer</span>
                                <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">Tempo Real</span>
                                <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold">Competitivo</span>
                            </div>
                        </div>
                    </button>

                    {/* PolyQuest Card */}
                    <button
                        onClick={() => onSelectGame('polyquest')}
                        className="group bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Icon name="sparkles" size={40} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">PolyQuest</h2>
                            <p className="text-slate-600 text-sm mb-4">
                                Desafio Cooperativo
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">Multiplayer Cooperativo</span>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-400">
                        Ambos os jogos usam sua conta Google para salvar progresso
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GameSelector;
