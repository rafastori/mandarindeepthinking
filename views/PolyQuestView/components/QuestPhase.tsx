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
    onLockEnigma: (index: number) => Promise<boolean>;
    onUnlockEnigma: (index: number) => Promise<void>;
}

// Helper to get user color (consistent with BossPhase)
const USER_COLORS = [
    'border-pink-500 bg-pink-50 text-pink-900',
    'border-blue-500 bg-blue-50 text-blue-900',
    'border-green-500 bg-green-50 text-green-900',
    'border-yellow-500 bg-yellow-50 text-yellow-900',
    'border-purple-500 bg-purple-50 text-purple-900',
    'border-orange-500 bg-orange-50 text-orange-900',
];

const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

export const QuestPhase: React.FC<QuestPhaseProps> = ({
    room,
    currentUserId,
    onSetEnigmas,
    onAnswer,
    onUpdateConfidence,
    onTriggerIntruder,
    onLockEnigma,
    onUnlockEnigma
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeEnigmaIndex, setActiveEnigmaIndex] = useState<number | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);

    // Derived state for the modal options (shuffled once per open)
    const [currentOptions, setCurrentOptions] = useState<string[]>([]);

    const progress = room.enigmas.length > 0 ? ((room.enigmas.filter(e => e.isDiscovered).length / room.enigmas.length) * 100) : 0;

    // --- Enigma Generation & Intruder Logic (Original) ---
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
                    const enigmas: WordEnigma[] = enigmasData.map(data => ({
                        word: data.word,
                        translation: data.translation,
                        alternatives: data.alternatives,
                        synonym: data.synonym,
                        isDiscovered: false,
                        attempts: 0,
                    }));
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

    useEffect(() => {
        if (room.intruderFound || room.intruderWord) return;
        const totalEnigmas = room.enigmas.length;
        if (totalEnigmas === 0) return;
        const discovered = room.enigmas.filter(e => e.isDiscovered).length;
        if ((discovered / totalEnigmas) >= GAME_CONSTANTS.INTRUDER_TRIGGER_PERCENT) {
            const generateAndTrigger = async () => {
                try {
                    const contextSample = room.enigmas.slice(0, 10).map(e => e.word);
                    const intruderData = await generateIntruder(contextSample, room.config.targetLang);
                    await onTriggerIntruder(intruderData.word);
                } catch (err) {
                    await onTriggerIntruder("Unicorn");
                }
            };
            generateAndTrigger();
        }
    }, [room.enigmas, room.intruderFound, room.intruderWord]);

    // --- Interaction Handlers ---

    const handleCardClick = async (index: number) => {
        // Prevent if solved or locked by someone else
        const enigma = room.enigmas[index];
        if (enigma.isDiscovered) return;
        if (enigma.activeSolver && enigma.activeSolver !== currentUserId) return;

        // Try to lock
        const locked = await onLockEnigma(index);
        if (locked) {
            setActiveEnigmaIndex(index);
            setShowHint(false);
            setEliminatedOptions([]);
            // Shuffle options for this session
            setCurrentOptions(shuffleArray([enigma.translation, ...enigma.alternatives]));
        } else {
            alert("Este enigma já está sendo resolvido por outro jogador!");
        }
    };

    const handleCloseModal = async () => {
        if (activeEnigmaIndex !== null) {
            await onUnlockEnigma(activeEnigmaIndex);
            setActiveEnigmaIndex(null);
        }
    };

    const handleAnswerSubmit = async (answer: string) => {
        if (activeEnigmaIndex === null) return;
        const currentEnigma = room.enigmas[activeEnigmaIndex];

        const isCorrect = answer.toLowerCase() === currentEnigma.translation.toLowerCase();

        // Optimistic close
        setActiveEnigmaIndex(null);
        await onUnlockEnigma(activeEnigmaIndex); // Unlock first? Or submit answer handles it?
        // Actually, submitAnswer logic might handling unlocking or state change
        // But for safety:

        onAnswer(activeEnigmaIndex, answer, isCorrect);
    };

    const handleSOS = async () => {
        if (room.confidence <= 5 || showHint) return;
        await onUpdateConfidence(-5);
        setShowHint(true);
    };

    const handleEliminate = async () => {
        if (room.confidence <= 5 || eliminatedOptions.length > 0 || activeEnigmaIndex === null) return;
        await onUpdateConfidence(-5);
        const currentEnigma = room.enigmas[activeEnigmaIndex];
        const wrongs = currentEnigma.alternatives;
        setEliminatedOptions(shuffleArray(wrongs).slice(0, 2));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Icon name="loader" size={48} className="text-emerald-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-semibold">Gerando enigmas com IA...</p>
                </div>
            </div>
        );
    }

    // --- Modal Component (Inline for simplicity access to state) ---
    const renderModal = () => {
        if (activeEnigmaIndex === null) return null;
        const enigma = room.enigmas[activeEnigmaIndex];

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Icon name="lock-open" size={18} className="text-emerald-600" />
                            Decifre a Palavra
                        </h3>
                        <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                            <Icon name="x" size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 text-center space-y-6">
                        {/* Context Phrase (Simulated/Placeholder or from Data if available) */}
                        {/* Since we don't store the full sentence per word in this model, we show the word clearly */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <p className="text-sm text-slate-500 uppercase tracking-wider mb-2">Palavra Oculta</p>
                            <h2 className="text-4xl font-bold text-slate-800">{enigma.word}</h2>
                            <p className="text-slate-400 mt-2 text-sm italic">Qual é o significado?</p>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-2 gap-3">
                            {currentOptions.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswerSubmit(opt)}
                                    disabled={eliminatedOptions.includes(opt)}
                                    className={`
                                        p-4 rounded-xl border-2 font-medium transition-all text-sm
                                        ${eliminatedOptions.includes(opt)
                                            ? 'opacity-20 bg-slate-100 border-slate-200 cursor-not-allowed'
                                            : 'border-slate-100 bg-white hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md active:scale-95'
                                        }
                                    `}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        {/* Helpers */}
                        <div className="flex justify-center gap-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                Recompensa: {GAME_CONSTANTS.CORRECT_POINTS} pts
                            </div>

                            <button
                                onClick={handleSOS}
                                disabled={showHint || room.confidence <= 5}
                                className="flex items-center gap-1 text-xs font-bold text-yellow-600 hover:text-yellow-700 disabled:opacity-50"
                            >
                                <Icon name="sun" size={14} />
                                Dica (-5)
                            </button>
                            <button
                                onClick={handleSOS} // Placeholder for SOS request logic
                                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition-colors"
                            >
                                <Icon name="life-buoy" size={14} />
                                PEDIR AJUDA (SOS)
                            </button>
                        </div>
                        {showHint && enigma.synonym && (
                            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-lg animate-in slide-in-from-bottom-2">
                                💡 Dica: "{enigma.synonym}"
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-0 z-40">
                <ConfidenceBar confidence={room.confidence} />

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">
                        <span>{room.enigmas.filter(e => e.isDiscovered).length}/{room.enigmas.length} Palavras</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold">
                        <Icon name="trophy" size={14} />
                        <span>{room.players.find(p => p.id === currentUserId)?.score || 0} pts</span>
                    </div>
                </div>
            </div>

            {/* Grid Area */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                {room.enigmas.map((enigma, index) => {
                    // Determine User Styles if active
                    const activeUser = enigma.activeSolver
                        ? room.players.find(p => p.id === enigma.activeSolver)
                        : null;

                    const userStyle = activeUser
                        ? getUserColor(activeUser.id)
                        : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md';

                    return (
                        <button
                            key={index}
                            onClick={() => handleCardClick(index)}
                            disabled={enigma.isDiscovered || (!!enigma.activeSolver && enigma.activeSolver !== currentUserId)}
                            className={`
                                relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[160px] group
                                ${enigma.isDiscovered
                                    ? 'bg-emerald-50 border-emerald-200 opacity-80'
                                    : userStyle}
                            `}
                        >
                            {/* Status Icon */}
                            {enigma.isDiscovered ? (
                                <>
                                    <Icon name="check" size={32} className="text-emerald-500 mb-1" />
                                    <span className="font-bold text-slate-700 text-lg">{enigma.word}</span>
                                    <span className="text-xs text-emerald-600 font-medium">{enigma.translation}</span>
                                </>
                            ) : enigma.activeSolver ? (
                                <>
                                    {activeUser?.avatarUrl ? (
                                        <img src={activeUser.avatarUrl} className="w-10 h-10 rounded-full border-2 border-white shadow-sm mb-1" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-1 shadow-sm opacity-80`} style={{ backgroundColor: '#64748b' }}>
                                            {activeUser?.name[0]}
                                        </div>
                                    )}
                                    <span className="font-bold opacity-0 group-hover:opacity-100 transition-opacity text-slate-800">{enigma.word}</span>
                                    <span className="text-xs font-bold animate-pulse text-slate-500">
                                        {activeUser?.id === currentUserId ? 'Resolvendo...' : `${activeUser?.name} resolvendo...`}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Icon name="lock" size={32} className="text-slate-300 group-hover:text-emerald-400 transition-colors mb-1" />
                                    <span className="font-bold text-slate-700 text-lg group-hover:scale-110 transition-transform">{enigma.word}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-emerald-500">Toque para resolver</span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Modal */}
            {activeEnigmaIndex !== null && renderModal()}

        </div>
    );
};

