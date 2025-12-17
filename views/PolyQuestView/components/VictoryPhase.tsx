import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, PolyQuestPlayer, WordEnigma, SUPPORTED_LANGUAGES } from '../types';

interface VictoryPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onResetGame: () => void;
}

export const VictoryPhase: React.FC<VictoryPhaseProps> = ({ room, currentUserId, onResetGame }) => {
    const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());

    // Sort players by score
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const secondPlace = sortedPlayers[1];
    const thirdPlace = sortedPlayers[2];

    const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === room.config.targetLang)?.name || room.config.targetLang;

    const toggleWordSelection = (index: number) => {
        const newSet = new Set(selectedWords);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedWords(newSet);
    };

    const toggleAllWords = () => {
        if (selectedWords.size === room.enigmas.length) {
            setSelectedWords(new Set());
        } else {
            const allIndices = new Set(room.enigmas.map((_, i) => i));
            setSelectedWords(allIndices);
        }
    };

    const handleSaveLibrary = () => {
        alert(`Salvou ${selectedWords.size} palavras na biblioteca! (Simulado)`);
        // Here we would implement the actual save logic
    };

    // Helper to extract a context sentence snippet (simple simulation)
    const getContextSnippet = (word: string) => {
        if (!room.config.originalText) return `Apprentice learned: ${word}`;
        const sentences = room.config.originalText.split(/[.!?]/);
        const match = sentences.find(s => s.toLowerCase().includes(word.toLowerCase()));
        return match ? match.trim() + "." : `... ${word} ...`;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Victory Header Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />

                <div className="p-10 text-center">
                    <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Icon name="crown" size={48} className="text-yellow-500" />
                    </div>

                    <h1 className="text-4xl font-extrabold text-slate-800 mb-2">Missão Cumprida!</h1>
                    <p className="text-slate-500 text-lg">
                        A equipe dominou o idioma <span className="font-bold text-blue-600">{targetLangName}</span>.
                    </p>

                    {/* Podium */}
                    <div className="flex items-end justify-center gap-4 mt-12 h-48">
                        {/* 2nd Place */}
                        {secondPlace && (
                            <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow-md flex items-center justify-center font-bold text-slate-600 mb-2 relative">
                                    {secondPlace.avatarUrl ? <img src={secondPlace.avatarUrl} className="w-full h-full rounded-full" /> : secondPlace.name[0]}
                                    <div className="absolute -top-2 bg-slate-200 text-xs px-1.5 rounded-full border border-white">2º</div>
                                </div>
                                <div className="bg-slate-100 w-24 h-24 rounded-t-lg flex flex-col items-center justify-center border-t border-x border-slate-200">
                                    <span className="font-bold text-slate-700 text-xl">{secondPlace.score}</span>
                                    <span className="text-xs text-slate-500 max-w-[80px] truncate">{secondPlace.name}</span>
                                </div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {winner && (
                            <div className="flex flex-col items-center z-10 animate-in slide-in-from-bottom-12 duration-700">
                                <div className="w-16 h-16 rounded-full bg-yellow-100 border-4 border-yellow-300 shadow-lg flex items-center justify-center font-bold text-yellow-700 mb-3 relative">
                                    <div className="absolute -top-6 text-yellow-500 drop-shadow-sm"><Icon name="crown" size={24} /></div>
                                    {winner.avatarUrl ? <img src={winner.avatarUrl} className="w-full h-full rounded-full" /> : winner.name[0]}
                                </div>
                                <div className="bg-gradient-to-b from-yellow-50 to-yellow-100 w-32 h-32 rounded-t-xl flex flex-col items-center justify-center border-t border-x border-yellow-200 shadow-sm relative">
                                    <span className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">Vencedor</span>
                                    <span className="font-extrabold text-slate-800 text-4xl">{winner.score}</span>
                                    <span className="text-sm font-semibold text-slate-700 mt-1 max-w-[100px] truncate">{winner.name}</span>
                                </div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {thirdPlace && (
                            <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-200">
                                <div className="w-12 h-12 rounded-full bg-orange-100 border-2 border-white shadow-md flex items-center justify-center font-bold text-orange-700 mb-2 relative">
                                    {thirdPlace.avatarUrl ? <img src={thirdPlace.avatarUrl} className="w-full h-full rounded-full" /> : thirdPlace.name[0]}
                                    <div className="absolute -top-2 bg-orange-100 text-xs px-1.5 rounded-full border border-white">3º</div>
                                </div>
                                <div className="bg-orange-50 w-24 h-16 rounded-t-lg flex flex-col items-center justify-center border-t border-x border-orange-100">
                                    <span className="font-bold text-slate-700 text-lg">{thirdPlace.score}</span>
                                    <span className="text-xs text-slate-500 max-w-[80px] truncate">{thirdPlace.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mission Library */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                            <Icon name="book-open" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Biblioteca da Missão</h2>
                            <p className="text-sm text-slate-500">
                                Selecione as palavras para salvar ({selectedWords.size}/{room.enigmas.length})
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleAllWords}
                            className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            {selectedWords.size === room.enigmas.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                        </button>
                        <button
                            onClick={handleSaveLibrary}
                            disabled={selectedWords.size === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Icon name="save" size={18} />
                            Salvar ({selectedWords.size})
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {room.enigmas.map((enigma, index) => (
                        <div
                            key={index}
                            className={`p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer ${selectedWords.has(index) ? 'bg-blue-50/30' : ''}`}
                            onClick={() => toggleWordSelection(index)}
                        >
                            <div className={`mt-1 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedWords.has(index) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                {selectedWords.has(index) && <Icon name="check" size={14} className="text-white" />}
                            </div>

                            <div className="flex-1 grid md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <h3 className="text-xl font-bold text-slate-800">{enigma.word}</h3>
                                        <span className="text-xs font-bold text-slate-400 uppercase">{room.config.targetLang}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                                        <Icon name="star" size={14} />
                                        <span>{enigma.translation}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg p-3 border-l-4 border-blue-400 text-sm text-slate-600 italic">
                                    "{getContextSnippet(enigma.word)}"
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Restart Button */}
            <button
                onClick={onResetGame}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
                <Icon name="rotate-ccw" size={24} />
                Iniciar Nova Aventura
            </button>
        </div>
    );
};
