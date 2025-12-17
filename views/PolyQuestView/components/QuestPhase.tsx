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
    onRequestHelp: (index: number) => Promise<void>;
    onProvideHelp: (index: number) => Promise<void>;
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
    onUnlockEnigma,
    onRequestHelp,
    onProvideHelp
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeEnigmaIndex, setActiveEnigmaIndex] = useState<number | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
    const [showOriginalText, setShowOriginalText] = useState(false);

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
                        needsHelp: false
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
        const enigma = room.enigmas[index];
        if (enigma.isDiscovered) return;

        // Special Case: Helping someone
        if (enigma.needsHelp && enigma.helpRequestedBy !== currentUserId) {
            setActiveEnigmaIndex(index);
            setShowHint(false);
            setEliminatedOptions([]);
            setCurrentOptions(shuffleArray([enigma.translation, ...enigma.alternatives]));
            return;
        }

        // Standard Case: Locking for yourself
        // Force unlock for yourself if it was returned to you? activeSolver handles it.
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
            // Only unlock if I am the active solver (don't mess with helps)
            const enigma = room.enigmas[activeEnigmaIndex];
            if (enigma.activeSolver === currentUserId) {
                await onUnlockEnigma(activeEnigmaIndex);
            }
            setActiveEnigmaIndex(null);
        }
    };

    const handleAnswerSubmit = async (answer: string) => {
        if (activeEnigmaIndex === null) return;
        const currentEnigma = room.enigmas[activeEnigmaIndex];
        const isCorrect = answer.toLowerCase() === currentEnigma.translation.toLowerCase();

        // Check if I am Helping
        if (currentEnigma.needsHelp && currentEnigma.helpRequestedBy !== currentUserId) {
            if (isCorrect) {
                await onProvideHelp(activeEnigmaIndex);
                setActiveEnigmaIndex(null); // Close modal automatically
                // Maybe show a toast "Help sent!"?
            } else {
                // Wrong answer provided by helper... penalty? For now just shake or alert
                alert("Resposta incorreta! Tente outra.");
            }
            return;
        }

        // Standard Answer
        setActiveEnigmaIndex(null);
        await onUnlockEnigma(activeEnigmaIndex);
        onAnswer(activeEnigmaIndex, answer, isCorrect);
    };

    const handleSOS = async () => {
        if (room.confidence <= 5 || showHint) return;
        await onUpdateConfidence(-5);
        setShowHint(true);
    };

    const handleRequestHelp = async () => {
        if (activeEnigmaIndex === null) return;
        await onRequestHelp(activeEnigmaIndex);
        setActiveEnigmaIndex(null); // Close modal so others can see it/take it
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
        const isHelping = enigma.needsHelp && enigma.helpRequestedBy !== currentUserId;
        const requester = enigma.helpRequestedBy ? room.players.find(p => p.id === enigma.helpRequestedBy) : null;
        const returnedAfterHelp = enigma.helpedBy && !enigma.isDiscovered;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200 ${isHelping ? 'ring-4 ring-green-400' : ''}`}>
                    {/* Header */}
                    <div className={`border-b p-4 flex justify-between items-center ${isHelping ? 'bg-green-50' : 'bg-slate-50'}`}>
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            {isHelping ? (
                                <>
                                    <Icon name="life-buoy" size={18} className="text-green-600" />
                                    <span className="text-green-800">AJUDANDO {requester?.name || 'Jogardor'} (+5 pts)</span>
                                </>
                            ) : (
                                <>
                                    <Icon name="lock-open" size={18} className="text-emerald-600" />
                                    Decifre a Palavra
                                </>
                            )}
                        </h3>
                        <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                            <Icon name="x" size={24} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 text-center space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 relative">
                            {returnedAfterHelp ? (
                                <div className="mb-4 bg-emerald-100 text-emerald-800 p-3 rounded-lg animate-pulse border border-emerald-200">
                                    <p className="font-bold text-xs uppercase tracking-wider mb-1">💡 Dica do Parceiro Recebida!</p>
                                    <p className="font-medium text-lg italic">"{enigma.synonym}"</p>
                                </div>
                            ) : null}

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
                                            : isHelping
                                                ? 'border-slate-100 bg-white hover:border-green-500 hover:bg-green-50 hover:shadow-md'
                                                : 'border-slate-100 bg-white hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md active:scale-95'
                                        }
                                    `}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        {/* Helpers */}
                        {!isHelping && (
                            <div className="flex justify-center gap-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                                    Recompensa: {returnedAfterHelp ? 5 : GAME_CONSTANTS.CORRECT_POINTS} pts
                                </div>

                                <button
                                    onClick={handleSOS}
                                    disabled={showHint || room.confidence <= 5 || !!returnedAfterHelp}
                                    className="flex items-center gap-1 text-xs font-bold text-yellow-600 hover:text-yellow-700 disabled:opacity-50 transition-colors"
                                >
                                    <Icon name="sun" size={14} />
                                    Dica (-5)
                                </button>
                                <button
                                    onClick={handleRequestHelp}
                                    disabled={enigma.needsHelp || !!returnedAfterHelp}
                                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-colors ${enigma.needsHelp || returnedAfterHelp
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100'
                                        }`}
                                >
                                    <Icon name="life-buoy" size={14} />
                                    {enigma.needsHelp ? 'Ajuda Solicitada' : 'PEDIR AJUDA (SOS)'}
                                </button>
                            </div>
                        )}

                        {/* Hint Display (Standard) */}
                        {showHint && enigma.synonym && !returnedAfterHelp && (
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

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOriginalText(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Icon name="book-open" size={16} />
                        <span className="hidden sm:inline">Ver Texto</span>
                    </button>
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">
                        <span>{room.enigmas.filter(e => e.isDiscovered).length}/{room.enigmas.length}</span>
                    </div>
                </div>

                {/* Scoreboard (All Players) */}
                <div className="flex items-center gap-3 overflow-x-auto max-w-[200px] sm:max-w-md no-scrollbar">
                    {room.players.map(p => (
                        <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-bold border ${getUserColor(p.id)} shadow-sm truncate`}>
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] uppercase">
                                {p.name[0]}
                            </div>
                            <span>{p.score || 0}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Original Text Modal */}
            {showOriginalText && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setShowOriginalText(false)}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowOriginalText(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"
                        >
                            <Icon name="x" size={20} />
                        </button>
                        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Icon name="book-open" size={24} className="text-slate-600" />
                            Texto Original
                        </h3>
                        <div className="prose prose-slate max-w-none bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <p className="text-lg leading-relaxed text-slate-700 whitespace-pre-line">
                                {room.config.originalText}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid Area */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                {room.enigmas.map((enigma, index) => {
                    // Determine User Styles
                    const activeUser = enigma.activeSolver
                        ? room.players.find(p => p.id === enigma.activeSolver)
                        : null;

                    // Prioritize Red pulse if help is needed
                    const containerClasses = [
                        'relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[160px] group'
                    ];

                    if (enigma.isDiscovered) {
                        containerClasses.push('bg-emerald-50 border-emerald-200 opacity-80');
                    } else if (enigma.needsHelp) {
                        containerClasses.push('bg-red-50 border-red-400 border-dashed animate-pulse');
                    } else if (activeUser) {
                        containerClasses.push(getUserColor(activeUser.id));
                    } else {
                        containerClasses.push('bg-white border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md');
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => handleCardClick(index)}
                            // Allow clicking if it needs help even if active? Maybe. For now standard lock rules.
                            disabled={enigma.isDiscovered || (!!enigma.activeSolver && enigma.activeSolver !== currentUserId)}
                            className={containerClasses.join(' ')}
                        >
                            {/* Needs Help Badge */}
                            {!enigma.isDiscovered && enigma.needsHelp && (
                                <div className="absolute top-3 right-3 text-red-500 animate-bounce">
                                    <Icon name="life-buoy" size={20} />
                                </div>
                            )}

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

