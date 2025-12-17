import React, { useState, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, WordEnigma, GAME_CONSTANTS } from '../types';
import { ConfidenceBar } from './ConfidenceBar';
import { generateEnigmas, generateIntruder } from '../../../services/gemini';
import { shuffleArray } from '../utils';

interface QuestPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onSetEnigmas: (enigmas: WordEnigma[]) => void;
    onAnswer: (enigmaIndex: number, selectedAnswer: string, isCorrect: boolean) => void;
    onUpdateConfidence: (delta: number) => Promise<void>;
    onTriggerIntruder: (intruderWord: string) => Promise<void>;
}

export const QuestPhase: React.FC<QuestPhaseProps> = ({ room, currentUserId, onSetEnigmas, onAnswer, onUpdateConfidence, onTriggerIntruder }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentEnigmaIndex, setCurrentEnigmaIndex] = useState(0);

    const [fatigueTimeLeft, setFatigueTimeLeft] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);

    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const currentEnigma = room.enigmas[currentEnigmaIndex];
    const progress = room.enigmas.length > 0 ? ((room.enigmas.filter(e => e.isDiscovered).length / room.enigmas.length) * 100) : 0;

    // Resetar estados locais ao mudar enigma
    useEffect(() => {
        setShowHint(false);
        setEliminatedOptions([]);
    }, [currentEnigmaIndex]);

    // Gerenciar Fadiga
    useEffect(() => {
        if (!currentPlayer?.isFatigued || !currentPlayer.fatigueEndsAt) {
            setFatigueTimeLeft(0);
            return;
        }

        const checkFatigue = () => {
            const now = Date.now();
            const left = Math.max(0, Math.ceil((currentPlayer.fatigueEndsAt! - now) / 1000));
            setFatigueTimeLeft(left);

            if (left <= 0 && currentPlayer.isFatigued) {
                // O tempo acabou, a limpeza no banco deve ser feita por uma ação ou efeito colateral.
                // Aqui apenas liberamos a UI localmente se possível, mas o ideal é atualizar o banco.
            }
        };

        checkFatigue();
        const interval = setInterval(checkFatigue, 1000);
        return () => clearInterval(interval);
    }, [currentPlayer?.isFatigued, currentPlayer?.fatigueEndsAt]);

    const isInputBlocked = fatigueTimeLeft > 0;

    // Gerar enigmas na primeira renderização se ainda não existirem
    useEffect(() => {
        const initializeEnigmas = async () => {
            if (room.enigmas.length === 0 && room.selectedWords.length > 0) {
                try {
                    setLoading(true);
                    setError(null);

                    const enigmasData = await generateEnigmas(
                        room.selectedWords,
                        room.config.sourceLang,
                        room.config.targetLang
                    );

                    // Converter para formato WordEnigma
                    const enigmas: WordEnigma[] = enigmasData.map(data => ({
                        word: data.word,
                        translation: data.translation,
                        alternatives: data.alternatives,
                        synonym: data.synonym,
                        isDiscovered: false,
                        attempts: 0,
                    }));

                    // Salvar no Firestore via prop
                    onSetEnigmas(enigmas);

                } catch (err) {
                    console.error('Erro ao gerar enigmas:', err);
                    setError('Erro ao gerar enigmas. Tente novamente.');
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        initializeEnigmas();
    }, []);

    // Check Intruder Trigger (50%)
    useEffect(() => {
        // Se já foi encontrado, ou já temos uma palavra intrusa definida mas ainda não validada, ignoramos geração
        if (room.intruderFound || room.intruderWord) return;

        const totalEnigmas = room.enigmas.length;
        if (totalEnigmas === 0) return;

        const discovered = room.enigmas.filter(e => e.isDiscovered).length;
        const progressPercent = discovered / totalEnigmas;

        if (progressPercent >= GAME_CONSTANTS.INTRUDER_TRIGGER_PERCENT) {
            // Trigger! Gerar e chamar hook
            const generateAndTrigger = async () => {
                try {
                    // Pega algumas palavras do contexto para gerar o intruso
                    const contextSample = room.enigmas.slice(0, 10).map(e => e.word);
                    const intruderData = await generateIntruder(contextSample, room.config.targetLang);

                    await onTriggerIntruder(intruderData.word);
                } catch (err) {
                    console.error("Falha ao gerar intruso:", err);
                    // Fallback se IA falhar
                    await onTriggerIntruder("Unicorn");
                }
            };
            generateAndTrigger();
        }

    }, [room.enigmas, room.intruderFound, room.intruderWord]);

    const handleAnswer = (answer: string) => {
        if (!currentEnigma) return;

        const isCorrect = answer.toLowerCase() === currentEnigma.translation.toLowerCase();
        onAnswer(currentEnigmaIndex, answer, isCorrect);

        // Avançar para próximo enigma se acertou
        if (isCorrect && currentEnigmaIndex < room.enigmas.length - 1) {
            setCurrentEnigmaIndex(prev => prev + 1);
        }
    };

    const handleSOS = async () => {
        if (room.confidence <= 5) return; // Mínimo de vida
        if (showHint) return;

        await onUpdateConfidence(-5); // Custo do SOS
        setShowHint(true);
    };

    const handleEliminate = async () => {
        if (room.confidence <= 5) return;
        if (eliminatedOptions.length > 0) return;

        await onUpdateConfidence(-5); // Custo da Eliminação

        // Encontrar 2 erradas para eliminar
        const correct = currentEnigma.translation;
        const wrongs = currentEnigma.alternatives;
        const toEliminate = shuffleArray(wrongs).slice(0, 2);
        setEliminatedOptions(toEliminate);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Icon name="loader" size={48} className="text-emerald-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-semibold">Gerando enigmas com IA...</p>
                    <p className="text-sm text-slate-500 mt-2">Isso pode levar alguns segundos</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <Icon name="alert-circle" size={48} className="text-red-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-red-800 mb-2">Erro</h3>
                <p className="text-red-700">{error}</p>
            </div>
        );
    }

    if (!currentEnigma) {
        return (
            <div className="text-center py-12">
                <Icon name="check-circle" size={64} className="text-emerald-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Todos os enigmas resolvidos!</h2>
                <p className="text-slate-600">Aguardando próxima fase...</p>
            </div>
        );
    }

    // Embaralhar opções (tradução correta + alternativas)
    const allOptions = shuffleArray([currentEnigma.translation, ...currentEnigma.alternatives]);

    return (
        <div className="space-y-6">
            {/* Barra de Confiança */}
            <ConfidenceBar confidence={room.confidence} />

            {/* Placar de Jogadores */}
            <div className="bg-white rounded-xl p-4 shadow-md border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Placar</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {room.players.map(player => (
                        <div
                            key={player.id}
                            className={`flex items-center gap-2 p-2 rounded-lg ${player.id === currentUserId ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-50'
                                }`}
                        >
                            {player.avatarUrl && (
                                <img src={player.avatarUrl} alt={player.name} className="w-8 h-8 rounded-full" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{player.name}</p>
                                <p className="text-xs text-slate-500">{player.score || 0} pts</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progresso */}
            <div className="bg-white rounded-xl p-4 shadow-md border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Progresso</span>
                    <span className="text-sm text-slate-600">
                        {room.enigmas.filter(e => e.isDiscovered).length} / {room.enigmas.length} enigmas
                    </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Carta de Enigma */}
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-8 shadow-xl border-2 border-emerald-200">
                <div className="text-center mb-8">
                    <div className="inline-block px-4 py-2 bg-white rounded-full shadow-md mb-4">
                        <span className="text-sm font-semibold text-slate-600">
                            Enigma {currentEnigmaIndex + 1} de {room.enigmas.length}
                        </span>
                    </div>
                    <h2 className="text-5xl font-bold text-slate-800 mb-2">{currentEnigma.word}</h2>
                    <p className="text-slate-600">Qual é a tradução?</p>
                </div>

                {/* Opções de Resposta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {allOptions.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleAnswer(option)}
                            disabled={isInputBlocked || eliminatedOptions.includes(option)}
                            className={`
                                p-6 bg-white rounded-xl shadow-md border-2 transition-all duration-200 group relative overflow-hidden
                                ${isInputBlocked || eliminatedOptions.includes(option)
                                    ? 'opacity-30 cursor-not-allowed border-slate-200 grayscale'
                                    : 'hover:shadow-lg hover:scale-105 border-slate-200 hover:border-emerald-400'
                                }
                            `}
                        >
                            <span className={`text-lg font-semibold ${isInputBlocked ? 'text-slate-400' : 'text-slate-800 group-hover:text-emerald-600'}`}>
                                {option}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Área de Assistência */}
                <div className="flex justify-center gap-4 mt-8">
                    <button
                        onClick={handleSOS}
                        disabled={room.confidence <= 5 || showHint || isInputBlocked}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${showHint
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 hover:scale-105'
                            } disabled:opacity-50`}
                        title="Revelar dica (-5 Confiança)"
                    >
                        <Icon name="sun" size={18} />
                        SOS (Dica)
                    </button>

                    <button
                        onClick={handleEliminate}
                        disabled={room.confidence <= 5 || eliminatedOptions.length > 0 || isInputBlocked}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${eliminatedOptions.length > 0
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 hover:scale-105'
                            } disabled:opacity-50`}
                        title="Eliminar 2 opções (-5 Confiança)"
                    >
                        <Icon name="zap" size={18} />
                        50/50
                    </button>
                </div>

                {/* Overlay de Fadiga */}
                {isInputBlocked && (
                    <div className="absolute inset-x-0 bottom-0 text-center p-4">
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-full shadow-xl animate-pulse">
                            <Icon name="clock" size={20} className="text-yellow-400" />
                            <span className="font-bold">Fadiga Tática: {fatigueTimeLeft}s</span>
                            <span className="text-xs text-slate-300 ml-2">(Ajudem seus colegas!)</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                    <Icon name="info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-semibold mb-1">Dica:</p>
                        <p>
                            ✅ Acerto: +{GAME_CONSTANTS.CORRECT_POINTS} pontos<br />
                            ❌ Erro: -{GAME_CONSTANTS.ERROR_PENALTY}% de confiança
                        </p>
                    </div>
                    {showHint && currentEnigma.synonym && (
                        <div className="border-l-2 border-blue-300 pl-3 ml-3">
                            <p className="font-semibold text-blue-800">Dica Revelada:</p>
                            <p className="text-blue-700 italic">"{currentEnigma.synonym}"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
