import React from 'react';
import Icon from './Icon';

interface GameSelectorProps {
    onSelectGame: (game: 'lingoarena' | 'polyquest' | 'domino') => void;
}

const GameSelector: React.FC<GameSelectorProps> = ({ onSelectGame }) => {
    return (
        <div className="flex flex-col items-center h-full p-4 pb-8 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Icon name="gamepad-2" size={24} className="text-brand-500" />
                Escolha um Jogo
            </h2>
            <div className="w-full max-w-md space-y-4">
                {/* LingoArena Card */}
                <button
                    onClick={() => onSelectGame('lingoarena')}
                    className="w-full group bg-white rounded-2xl p-4 shadow-md border-2 border-slate-200 hover:border-brand-400 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-rose-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                            <Icon name="flame" size={28} className="text-white" fill="currentColor" />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-lg font-bold text-slate-800">LingoArena</h3>
                            <p className="text-slate-500 text-sm">Jogo competitivo de vocabulário</p>
                        </div>
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">Competitivo</span>
                    </div>
                </button>

                {/* PolyQuest Card */}
                <button
                    onClick={() => onSelectGame('polyquest')}
                    className="w-full group bg-white rounded-2xl p-4 shadow-md border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                            <Icon name="sparkles" size={28} className="text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-lg font-bold text-slate-800">PolyQuest</h3>
                            <p className="text-slate-500 text-sm">Desafio Cooperativo</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Cooperativo</span>
                    </div>
                </button>

                {/* Dominó Mexicano Card */}
                <button
                    onClick={() => onSelectGame('domino')}
                    className="w-full group bg-white rounded-2xl p-4 shadow-md border-2 border-slate-200 hover:border-orange-400 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="text-2xl">🎲</span>
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className="text-lg font-bold text-slate-800">Dominó</h3>
                            <p className="text-slate-500 text-sm">Trem Mexicano com termos</p>
                        </div>
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">2-6 Jogadores</span>
                    </div>
                </button>
            </div>

            <p className="text-xs text-slate-400 mt-6">
                Todos usam sua conta Google para salvar progresso
            </p>
        </div>
    );
};

export default GameSelector;
