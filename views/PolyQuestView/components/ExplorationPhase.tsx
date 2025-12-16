import React from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';
import { tokenizeText } from '../utils';

interface ExplorationPhaseProps {
    room: PolyQuestRoom;
    onSelectWord: (word: string) => void;
    onStartQuest: () => void;
}

export const ExplorationPhase: React.FC<ExplorationPhaseProps> = ({
    room,
    onSelectWord,
    onStartQuest,
}) => {
    const tokens = tokenizeText(room.config.originalText);
    const selectedWords = room.selectedWords || [];
    const minWords = 5;
    const canStart = selectedWords.length >= minWords;

    // Verificar se um token é uma palavra (não pontuação)
    const isWord = (token: string) => /^[\w'-]+$/.test(token);

    // Verificar se palavra está selecionada
    const isSelected = (word: string) => {
        return selectedWords.some(w => w.toLowerCase() === word.toLowerCase());
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="search" size={28} className="text-emerald-600" />
                            Fase de Exploração
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Clique nas palavras que você não conhece para marcá-las como enigmas
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-600">{selectedWords.length}</p>
                        <p className="text-xs text-slate-500">enigmas selecionados</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                            style={{ width: `${Math.min(100, (selectedWords.length / minWords) * 100)}%` }}
                        />
                    </div>
                    <span className="text-sm font-semibold text-slate-600">
                        {selectedWords.length} / {minWords} mín.
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Texto Principal */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Icon name="file-text" size={20} className="text-slate-600" />
                            Texto Original
                        </h3>

                        <div className="prose prose-lg max-w-none">
                            <div className="text-lg leading-relaxed space-y-2">
                                {tokens.map((token, index) => {
                                    const isWordToken = isWord(token);
                                    const selected = isWordToken && isSelected(token);

                                    if (!isWordToken) {
                                        // Pontuação - apenas renderizar
                                        return (
                                            <span key={index} className="text-slate-700">
                                                {token}
                                            </span>
                                        );
                                    }

                                    // Palavra - clicável
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => onSelectWord(token)}
                                            className={`
                                                inline-block px-1 py-0.5 mx-0.5 rounded transition-all duration-200
                                                ${selected
                                                    ? 'bg-yellow-200 text-slate-900 font-semibold shadow-sm scale-105'
                                                    : 'hover:bg-slate-100 text-slate-700'
                                                }
                                            `}
                                        >
                                            {token}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista de Enigmas */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 sticky top-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Icon name="list" size={20} className="text-emerald-600" />
                            Enigmas Selecionados
                        </h3>

                        {selectedWords.length === 0 ? (
                            <div className="text-center py-8">
                                <Icon name="mouse-pointer-click" size={48} className="text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">
                                    Clique nas palavras do texto para adicioná-las aqui
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                                {selectedWords.map((word, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg group hover:bg-yellow-100 transition-colors"
                                    >
                                        <span className="font-semibold text-slate-800">{word}</span>
                                        <button
                                            onClick={() => onSelectWord(word)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                                        >
                                            <Icon name="x" size={16} className="text-red-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Botão Iniciar Quest */}
                        <div className="space-y-3">
                            {!canStart && (
                                <p className="text-xs text-slate-500 text-center">
                                    Selecione pelo menos {minWords} palavras para continuar
                                </p>
                            )}
                            <button
                                onClick={onStartQuest}
                                disabled={!canStart}
                                className="w-full px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg disabled:shadow-none"
                            >
                                <Icon name="play" size={20} />
                                <span>Iniciar Quest</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                    <Icon name="info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-semibold mb-1">Como funciona:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Clique nas palavras que você não conhece</li>
                            <li>As palavras marcadas ficam destacadas em amarelo</li>
                            <li>Todos os jogadores veem as mesmas marcações em tempo real</li>
                            <li>Selecione pelo menos {minWords} palavras para iniciar a Quest</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
