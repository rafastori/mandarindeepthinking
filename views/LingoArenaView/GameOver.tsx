import React, { useState } from 'react';
import Icon from '../../components/Icon';
import { GameRoom, GameCard } from '../../types';

interface GameOverProps {
    room: GameRoom;
    isHost: boolean;
    onRestart: () => void;
    onDelete: () => void;
    onSaveWords?: (words: { word: string; meaning: string; pinyin: string }[]) => void;
}

export const GameOver: React.FC<GameOverProps> = ({ room, isHost, onRestart, onDelete, onSaveWords }) => {
    // Lógica de Vitória ou Derrota baseada no score
    const isVictory = (room.teamScore || 0) > 0;

    // State for word selection
    const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
    const [showWordList, setShowWordList] = useState(false);
    const [saving, setSaving] = useState(false);

    const toggleWord = (index: number) => {
        const newSet = new Set(selectedWords);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedWords(newSet);
    };

    const selectAll = () => {
        if (selectedWords.size === room.deck.length) {
            setSelectedWords(new Set());
        } else {
            setSelectedWords(new Set(room.deck.map((_, i) => i)));
        }
    };

    const handleSaveWords = async () => {
        if (!onSaveWords || selectedWords.size === 0) return;
        setSaving(true);

        const wordsToSave = Array.from(selectedWords).map(i => ({
            word: room.deck[i].word,
            meaning: room.deck[i].meaning,
            pinyin: room.deck[i].pinyin
        }));

        await onSaveWords(wordsToSave);
        setSaving(false);
        setSelectedWords(new Set());
        setShowWordList(false);
    };

    return (
        <div className="text-center py-10 animate-in zoom-in duration-300">

            {/* Ícone Dinâmico */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${isVictory ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <Icon
                    name={isVictory ? "trophy" : "slash"}
                    size={48}
                    className={isVictory ? "text-yellow-600" : "text-red-500"}
                />
            </div>

            {/* Título Dinâmico */}
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
                {isVictory ? "Vitória da Equipe!" : "Game Over"}
            </h2>

            <p className="text-slate-500 mb-6 max-w-xs mx-auto">
                {isVictory
                    ? `Vocês atingiram a meta de ${room.targetScore} pontos!`
                    : "A pontuação da equipe chegou a zero (ou menos). Tente novamente!"
                }
            </p>

            {/* Placar Final */}
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm mx-auto border border-slate-100">
                <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase">Pontuação Final</span>
                    <span className={`text-2xl font-black ${isVictory ? 'text-green-600' : 'text-red-600'}`}>
                        {room.teamScore}
                    </span>
                </div>

                <h3 className="font-bold text-slate-700 mb-4 text-left text-sm">Contribuições</h3>
                {room.players
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((p, index) => (
                        <div key={p.id} className="flex justify-between items-center py-2 text-sm">
                            <span className={`font-medium ${index === 0 ? 'text-brand-600' : 'text-slate-600'}`}>
                                {index === 0 && '👑 '} {p.name} {p.isBot && '🤖'}
                            </span>
                            <span className="font-bold text-slate-800">{p.score} pts</span>
                        </div>
                    ))}
            </div>

            {/* Save Words Section */}
            {onSaveWords && room.deck.length > 0 && (
                <div className="mt-6 max-w-sm mx-auto">
                    <button
                        onClick={() => setShowWordList(!showWordList)}
                        className="w-full flex items-center justify-center gap-2 bg-purple-50 text-purple-700 px-4 py-3 rounded-xl font-bold hover:bg-purple-100 transition-colors"
                    >
                        <Icon name="bookmark" size={18} />
                        Salvar Palavras ({room.deck.length} disponíveis)
                        <Icon name={showWordList ? "chevron-up" : "chevron-down"} size={16} />
                    </button>

                    {showWordList && (
                        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-4 text-left">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase">
                                    {selectedWords.size} selecionadas
                                </span>
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-purple-600 font-bold hover:text-purple-800"
                                >
                                    {selectedWords.size === room.deck.length ? 'Limpar' : 'Selecionar Todas'}
                                </button>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {room.deck.map((card, idx) => (
                                    <label
                                        key={idx}
                                        className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedWords.has(idx) ? 'bg-purple-50 border border-purple-200' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedWords.has(idx)}
                                            onChange={() => toggleWord(idx)}
                                            className="mt-1 accent-purple-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 text-sm">{card.word}</p>
                                            <p className="text-xs text-slate-500 truncate">{card.meaning}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {selectedWords.size > 0 && (
                                <button
                                    onClick={handleSaveWords}
                                    disabled={saving}
                                    className="w-full mt-4 bg-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Icon name="loader" size={18} className="animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="save" size={18} />
                                            Salvar {selectedWords.size} Palavras
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isHost ? (
                <div className="mt-8 space-y-3 max-w-sm mx-auto">
                    <button onClick={onRestart} className="w-full bg-brand-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all">
                        Jogar Novamente
                    </button>
                    <button onClick={onDelete} className="w-full text-slate-400 hover:text-red-500 font-bold py-2 text-sm">
                        Encerrar Sala
                    </button>
                </div>
            ) : (
                <p className="mt-8 text-slate-400 italic">Aguardando Host reiniciar...</p>
            )}
        </div>
    );
};