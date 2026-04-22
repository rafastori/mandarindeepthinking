import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Variants, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Keyword } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { Star, Flame, RotateCcw, Volume2, Square, ArrowLeftRight, Zap, ArrowRight } from 'lucide-react';
import FavoriteModal from '../components/FavoriteModal';

// ══════════════════════════════════════════════
//  INTERFACES
// ══════════════════════════════════════════════

interface PracticeViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
    activeFolderFilters?: string[];
    showOnlyErrors?: boolean;
    wordCounts?: Record<string, any>;
    stats?: any;
    updateFavoriteConfig?: (config: any) => void;
}

interface SessionStats {
    totalAttempts: number;
    correctAnswers: number;
    incorrectAnswers: number;
    startTime: number;
    maxStreak: number;
    totalTimeMs?: number;
}

interface FloatingXP {
    id: string;
    value: number;
}

// ══════════════════════════════════════════════
//  ANIMATION VARIANTS
// ══════════════════════════════════════════════

const questionCardVariants: Variants = {
    initial: { opacity: 0, y: 20, scale: 0.97 },
    animate: {
        opacity: 1, y: 0, scale: 1,
        transition: { duration: 0.32, ease: 'easeOut' }
    },
    shake: {
        x: [0, -12, 12, -10, 10, -6, 6, 0],
        transition: { duration: 0.44 }
    },
    bounce: {
        y: [0, -13, 0],
        scale: [1, 1.04, 1],
        transition: { duration: 0.48, ease: 'easeOut' }
    },
    exit: {
        opacity: 0, y: -16, scale: 0.97,
        transition: { duration: 0.2 }
    }
};

const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.07, delayChildren: 0.05 }
    },
    exit: { opacity: 0, transition: { duration: 0.15 } }
};

const staggerItemVariants: Variants = {
    hidden: { opacity: 0, y: 14, scale: 0.93 },
    show: {
        opacity: 1, y: 0, scale: 1,
        transition: { duration: 0.28, ease: 'easeOut' }
    }
};

const floatingXPVariants: Variants = {
    initial: { opacity: 1, y: 0, scale: 1.15 },
    animate: {
        opacity: 0, y: -65, scale: 0.85,
        transition: { duration: 1.25, ease: 'easeOut' }
    }
};

const starVariants: Variants = {
    initial: { scale: 0, opacity: 0 },
    animate: (i: number) => ({
        scale: 1, opacity: 1,
        transition: {
            delay: 0.5 + i * 0.28,
            duration: 0.5,
            type: 'spring',
            stiffness: 190,
            damping: 11
        }
    })
};

// ══════════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════════

const CONFETTI_COLORS = ['#10b981', '#059669', '#34d399', '#fbbf24', '#f59e0b', '#6ee7b7', '#a7f3d0', '#d97706'];

function generateParticles(count = 55) {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        left: 10 + Math.random() * 80,
        top: 15 + Math.random() * 50,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 8,
        dx: (Math.random() - 0.5) * 110,
        dy: 50 + Math.random() * 140,
        rotate: Math.random() * 420,
        delay: Math.random() * 0.5,
    }));
}

// ══════════════════════════════════════════════
//  COMPLETION SCREEN
// ══════════════════════════════════════════════

interface CompletionProps {
    sessionStats: SessionStats;
    xpGained: number;
    totalQuestions: number;
    onRestart: () => void;
}

const CompletionScreen: React.FC<CompletionProps> = ({ sessionStats, xpGained, totalQuestions, onRestart }) => {
    const [particles] = useState(generateParticles);

    const accuracy = sessionStats.totalAttempts > 0
        ? Math.round((sessionStats.correctAnswers / sessionStats.totalAttempts) * 100)
        : 0;
    const earnedStars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;
    const totalSecs = sessionStats.totalTimeMs ? Math.floor(sessionStats.totalTimeMs / 1000) : 0;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-0 sm:pb-4"
        >
            {/* Confetti layer */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-[51]">
                {particles.map(p => (
                    <motion.div
                        key={p.id}
                        className="absolute rounded-sm"
                        style={{
                            left: `${p.left}%`, top: `${p.top}%`,
                            width: p.size, height: p.size,
                            backgroundColor: p.color
                        }}
                        initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
                        animate={{ y: p.dy, x: p.dx, opacity: [1, 1, 0], rotate: p.rotate }}
                        transition={{ duration: 2.0 + Math.random() * 0.8, ease: 'easeOut', delay: p.delay }}
                    />
                ))}
            </div>

            {/* Modal Card */}
            <motion.div
                initial={{ y: 80, scale: 0.88, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 135, damping: 16, delay: 0.1 }}
                className="relative bg-white rounded-t-3xl sm:rounded-3xl p-7 w-full max-w-sm shadow-2xl z-[52] max-h-[92vh] overflow-y-auto"
            >
                {/* Decorative top gradient */}
                <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-brand-50 to-transparent rounded-t-3xl pointer-events-none" />

                <div className="relative">
                    {/* Header */}
                    <div className="text-center mb-5">
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="text-2xl font-extrabold text-slate-900"
                        >
                            Sessão Concluída! 🎉
                        </motion.p>
                        <p className="text-sm text-slate-500 mt-1">Continue praticando para manter o ritmo!</p>
                    </div>

                    {/* Stars */}
                    <div className="flex justify-center items-end gap-4 mb-7">
                        {[0, 1, 2].map((i) => {
                            const earned = i < earnedStars;
                            const isCenter = i === 1;
                            return (
                                <motion.span
                                    key={i}
                                    custom={i}
                                    variants={starVariants}
                                    initial="initial"
                                    animate={earned ? 'animate' : 'initial'}
                                    className={`drop-shadow-md select-none ${isCenter ? 'text-5xl' : 'text-4xl'} ${earned ? '' : 'opacity-20'}`}
                                >
                                    {earned ? '⭐' : '☆'}
                                </motion.span>
                            );
                        })}
                    </div>

                    {/* Accuracy + Time */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-brand-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-extrabold text-brand-600">{accuracy}%</div>
                            <div className="text-xs text-slate-500 mt-0.5 font-medium">Acurácia</div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-extrabold text-slate-700">
                                {mins}:{String(secs).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 font-medium">Tempo total</div>
                        </div>
                    </div>

                    {/* Stats list */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-5 divide-y divide-slate-200">
                        {[
                            { icon: '✅', label: 'Acertos', value: `${sessionStats.correctAnswers}/${totalQuestions}` },
                            { icon: '❌', label: 'Erros', value: `${sessionStats.incorrectAnswers}/${totalQuestions}` },
                            { icon: '🔥', label: 'Streak máximo', value: String(sessionStats.maxStreak) },
                        ].map(row => (
                            <div key={row.label} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0 text-sm">
                                <span className="text-slate-600">{row.icon} {row.label}</span>
                                <span className="font-bold text-slate-900">{row.value}</span>
                            </div>
                        ))}
                        <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.5 }}
                            className="flex justify-between items-center py-2.5 last:pb-0"
                        >
                            <span className="text-sm font-medium text-slate-600">⚡ XP ganho</span>
                            <span className="font-extrabold text-brand-600 text-base">+{xpGained} XP</span>
                        </motion.div>
                    </div>

                    {/* CTA */}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onRestart}
                        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors"
                        style={{ boxShadow: '0 4px 18px rgba(5, 150, 105, 0.32)' }}
                    >
                        <RotateCcw size={17} />
                        Praticar Novamente
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ══════════════════════════════════════════════
//  SWIPE CARD
// ══════════════════════════════════════════════

interface SwipeCardProps {
    question: any;
    isGerman: boolean;
    onSelfAssess: (correct: boolean) => void;
    playingId: string | null;
    speak: (text: string, lang: any, id: string) => void;
    stop: () => void;
    audioId: string;
}

const SwipeCard: React.FC<SwipeCardProps> = ({ question, isGerman, onSelfAssess, playingId, speak, stop, audioId }) => {
    const [isRevealed, setIsRevealed] = useState(false);
    const [answered, setAnswered] = useState<'correct' | 'wrong' | null>(null);

    const dragX = useMotionValue(0);
    const cardBg = useTransform(dragX, [-160, 0, 160], ['#fef2f2', '#ffffff', '#f0fdf4']);
    const rotate = useTransform(dragX, [-220, 220], [-13, 13]);
    const leftOpacity = useTransform(dragX, [-160, -40, 0], [1, 0.3, 0]);
    const rightOpacity = useTransform(dragX, [0, 40, 160], [0, 0.3, 1]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (!isRevealed || answered) return;
        const THRESHOLD = 80;
        if (info.offset.x > THRESHOLD || info.velocity.x > 500) {
            setAnswered('correct');
            onSelfAssess(true);
        } else if (info.offset.x < -THRESHOLD || info.velocity.x < -500) {
            setAnswered('wrong');
            onSelfAssess(false);
        }
    };

    const parts = question.sentence?.includes(question.word)
        ? question.sentence.split(question.word)
        : [question.sentence || '', ''];

    return (
        <div className="relative w-full select-none">
            {/* Side hint overlays */}
            <motion.div
                style={{ opacity: leftOpacity }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-red-100 text-red-600 font-bold text-sm px-3 py-1.5 rounded-xl pointer-events-none shadow-sm"
            >
                ✗ Não soube
            </motion.div>
            <motion.div
                style={{ opacity: rightOpacity }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-green-100 text-green-600 font-bold text-sm px-3 py-1.5 rounded-xl pointer-events-none shadow-sm"
            >
                ✓ Acertei
            </motion.div>

            {/* Draggable card */}
            <motion.div
                drag={isRevealed && !answered ? 'x' : false}
                dragConstraints={{ left: -230, right: 230 }}
                dragElastic={0.12}
                onDragEnd={handleDragEnd}
                style={{ background: cardBg, rotate, x: dragX }}
                className={`relative rounded-2xl border-2 p-6 min-h-[270px] flex flex-col justify-between shadow-sm transition-colors ${
                    answered === 'correct' ? 'border-brand-400' :
                    answered === 'wrong'   ? 'border-red-300' :
                    isRevealed ? 'border-brand-200 cursor-grab active:cursor-grabbing' : 'border-slate-200'
                }`}
            >
                {/* Question text */}
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Complete a frase</p>
                    <p className={`text-xl leading-relaxed ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                        {parts[0]}
                        <span className={`inline-block min-w-[48px] border-b-2 mx-1 text-center font-bold transition-all duration-300 ${
                            isRevealed ? 'text-brand-600 border-brand-500' : 'text-brand-500/60 border-brand-300'
                        }`}>
                            {isRevealed ? question.word : '____'}
                        </span>
                        {parts[1] || ''}
                    </p>

                    <AnimatePresence>
                        {isRevealed && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 space-y-1"
                            >
                                <p className="text-sm font-semibold text-brand-700">{question.wordMeaning}</p>
                                <p className="text-xs text-slate-400 italic">{question.translation}</p>
                                {question.pinyin && !isGerman && (
                                    <p className="text-xs text-slate-500">{question.pinyin}</p>
                                )}
                                {/* Audio button */}
                                <button
                                    onClick={() => playingId === audioId ? stop() : speak(question.sentence, (question.language || 'zh') as any, audioId)}
                                    className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-600 transition-colors"
                                >
                                    {playingId === audioId
                                        ? <><Square size={12} /> Parar</>
                                        : <><Volume2 size={12} /> Ouvir frase</>
                                    }
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom action */}
                <div className="mt-5">
                    {!isRevealed ? (
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setIsRevealed(true)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 text-brand-700 font-bold text-sm hover:bg-brand-100 transition-colors"
                        >
                            👁 Revelar Resposta
                        </motion.button>
                    ) : answered ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`py-3 rounded-xl text-center font-bold text-sm ${
                                answered === 'correct' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'
                            }`}
                        >
                            {answered === 'correct' ? '✓ Marcado como acerto!' : '✗ Marcado para revisar'}
                        </motion.div>
                    ) : (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-xs text-slate-400 font-medium py-2"
                        >
                            ← Não soube &nbsp;|&nbsp; Acertei →
                        </motion.p>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ══════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════

const PracticeView: React.FC<PracticeViewProps> = ({
    data, savedIds, onResult,
    activeFolderFilters = [], showOnlyErrors = false,
    wordCounts = {}, stats, updateFavoriteConfig
}) => {
    const { speak, stop, playingId } = usePuterSpeech();

    // ─── Game States ─────────────────────────
    const [currentIndex, setCurrentIndex]   = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResult, setShowResult]       = useState(false);
    const [isFinished, setIsFinished]       = useState(false);
    const [sessionKey, setSessionKey]       = useState(0);
    const [invertPractice, setInvertPractice] = useState(false);
    const [practiceMode, setPracticeMode]   = useState<'multiple-choice' | 'swipe'>('multiple-choice');
    const [cardAnimState, setCardAnimState] = useState<'animate' | 'shake' | 'bounce'>('animate');

    // ─── Combo & XP ──────────────────────────
    const [streak, setStreak]           = useState(0);
    const [sessionXP, setSessionXP]     = useState(0);
    const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([]);
    const floatingXPCounter             = useRef(0);

    // ─── Session Stats ───────────────────────
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        totalAttempts: 0, correctAnswers: 0, incorrectAnswers: 0,
        startTime: Date.now(), maxStreak: 0,
    });
    const sessionStartRef = useRef(Date.now());

    // ─── Favorites ──────────────────────────
    const [favoriteModalOpen, setFavoriteModalOpen]       = useState(false);
    const [activeFavoriteWord, setActiveFavoriteWord]     = useState<{ id: string; term: string } | null>(null);

    // ─── Data Snapshot ───────────────────────
    const dataSnapshotRef = useRef<{ data: StudyItem[]; savedIds: string[] } | null>(null);
    useEffect(() => { dataSnapshotRef.current = { data, savedIds }; }, [data, savedIds]);

    // ═══════════════════════════════════════
    //  UTILITIES
    // ═══════════════════════════════════════

    const cleanPunctuation = (text: string) =>
        text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´。，！？；：）】」』、]/g, '').trim();

    const filtersKey = useMemo(() => [...activeFolderFilters].sort().join(','), [activeFolderFilters]);

    const getComboMultiplier = (s: number) => s < 3 ? 1 : s < 5 ? 1.5 : s < 10 ? 2 : 3;

    // ═══════════════════════════════════════
    //  SAVED WORDS MAP (original logic preserved)
    // ═══════════════════════════════════════

    const savedWordsMap = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData    = snapshot.data;
        const currentSavedIds = snapshot.savedIds;

        const allowedWords = new Set<string>();
        if (activeFolderFilters.length > 0) {
            currentData.forEach(item => {
                if (item.type !== 'word') {
                    const inFolder = activeFolderFilters.some(filterPath => {
                        if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                        return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                    });
                    if (inFolder) {
                        item.tokens?.forEach(t => allowedWords.add(cleanPunctuation(t).toLowerCase()));
                        item.keywords?.forEach(k => allowedWords.add(cleanPunctuation(k.word).toLowerCase()));
                    }
                }
            });
        }

        const map = new Map<string, Keyword>();

        currentData.forEach(item => {
            let isVisible = false;
            if (activeFolderFilters.length === 0) {
                isVisible = true;
            } else {
                const explicitMatch = activeFolderFilters.some(filterPath => {
                    if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                    return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                });
                if (explicitMatch) isVisible = true;
                if (!isVisible && item.type === 'word' && allowedWords.has(cleanPunctuation(item.chinese).toLowerCase())) {
                    isVisible = true;
                }
            }
            if (!isVisible) return;

            item.keywords?.forEach(k => {
                if (currentSavedIds.includes(k.id)) {
                    if (showOnlyErrors && (wordCounts[k.word] || 0) <= 0) return;
                    map.set(k.word.toLowerCase().trim(), k);
                }
            });

            const isWordCard = item.type === 'word' || (item.tokens?.length === 1 && currentSavedIds.includes(item.id.toString()));
            if (isWordCard && currentSavedIds.includes(item.id.toString())) {
                const chinese = item.chinese || '';
                if (showOnlyErrors && (wordCounts[chinese] || 0) <= 0) return;
                map.set(chinese.toLowerCase().trim(), {
                    id: item.id.toString(), word: item.chinese,
                    pinyin: item.pinyin, meaning: item.translation,
                    language: item.language
                });
            }
        });

        // Injetar favoritos de frequência absoluta
        if (stats?.favoriteConfigs) {
            const now = Date.now();
            Object.values(stats.favoriteConfigs).forEach((config: any) => {
                if (config.mode === 'absolute' && config.absoluteIntervalDays) {
                    const elapsedMs = now - (config.lastReviewedAt || 0);
                    const isDue = elapsedMs >= (config.absoluteIntervalDays * 24 * 60 * 60 * 1000);
                    if (isDue) {
                        const originalWord = currentData.find(d => d.id.toString() === config.id);
                        if (originalWord && !map.has((originalWord.chinese || '').toLowerCase().trim())) {
                            map.set((originalWord.chinese || '').toLowerCase().trim(), {
                                id: originalWord.id.toString(), word: originalWord.chinese,
                                pinyin: originalWord.pinyin, meaning: originalWord.translation,
                                language: originalWord.language
                            });
                        }
                    }
                }
            });
        }

        return map;
    }, [sessionKey, filtersKey, showOnlyErrors, stats?.favoriteConfigs]);

    // ═══════════════════════════════════════
    //  QUESTIONS (original logic preserved)
    // ═══════════════════════════════════════

    const questions = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;
        const list: any[] = [];

        currentData.forEach(item => {
            if (item.type === 'word') return;
            if (!item.tokens || item.tokens.length === 0) return;
            const sentence = item.chinese;
            item.tokens.forEach(token => {
                const cleanToken = cleanPunctuation(token).toLowerCase();
                if (!cleanToken) return;
                const savedWord = savedWordsMap.get(cleanToken);
                if (savedWord) {
                    list.push({
                        id: savedWord.id, word: savedWord.word,
                        wordMeaning: savedWord.meaning, sentence,
                        translation: item.translation, pinyin: savedWord.pinyin,
                        language: item.language || savedWord.language
                    });
                }
            });
        });

        const withBoost = list.flatMap(q => {
            const config = stats?.favoriteConfigs?.[q.id] as any;
            if (!config) return [q];
            if (config.mode === 'relative' && config.relativeMultiplier) {
                return Array(config.relativeMultiplier).fill(0).map((_, i) =>
                    i === 0 ? q : { ...q, id: q.id + '-boost-' + i }
                );
            }
            return [q];
        });

        const shuffled = [...withBoost];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [sessionKey, savedWordsMap, filtersKey, stats?.favoriteConfigs]);

    // ═══════════════════════════════════════
    //  OPTIONS (original logic preserved)
    // ═══════════════════════════════════════

    const options = useMemo(() => {
        if (!questions[currentIndex]) return [];
        const correct = questions[currentIndex].word;
        const allWords = Array.from(savedWordsMap.values()).map(k => k.word);
        const distractors = allWords
            .filter(w => w !== correct)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        return [...distractors, correct].sort(() => 0.5 - Math.random());
    }, [questions, currentIndex, savedWordsMap]);

    // ═══════════════════════════════════════
    //  EFFECTS
    // ═══════════════════════════════════════

    useEffect(() => {
        if (questions.length === 0 && data.length > 0) {
            setSessionKey(prev => prev + 1);
        }
    }, [data.length]);

    // ═══════════════════════════════════════
    //  HANDLERS
    // ═══════════════════════════════════════

    const spawnFloatingXP = (value: number) => {
        const id = `xp-${floatingXPCounter.current++}`;
        setFloatingXPs(prev => [...prev, { id, value }]);
        setTimeout(() => setFloatingXPs(prev => prev.filter(x => x.id !== id)), 1400);
    };

    const recordResult = (isCorrect: boolean) => {
        if (isCorrect) {
            const newStreak = streak + 1;
            setStreak(newStreak);
            const multiplier = getComboMultiplier(newStreak);
            const xp = Math.round(10 * multiplier);
            setSessionXP(prev => prev + xp);
            spawnFloatingXP(xp);

            setCardAnimState('bounce');
            setTimeout(() => setCardAnimState('animate'), 560);
        } else {
            setStreak(0);
            setCardAnimState('shake');
            setTimeout(() => setCardAnimState('animate'), 500);
        }

        setSessionStats(prev => {
            const newCorrect = prev.correctAnswers + (isCorrect ? 1 : 0);
            const newTotal   = prev.totalAttempts + 1;
            const newMaxStreak = isCorrect ? Math.max(prev.maxStreak, streak + 1) : prev.maxStreak;
            return {
                ...prev,
                totalAttempts: newTotal,
                correctAnswers: newCorrect,
                incorrectAnswers: prev.incorrectAnswers + (isCorrect ? 0 : 1),
                maxStreak: newMaxStreak,
            };
        });
    };

    const handleAnswer = (option: string) => {
        if (showResult) return;
        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.word;
        setSelectedOption(option);
        setShowResult(true);
        onResult(isCorrect, currentQ.word);
        recordResult(isCorrect);
    };

    const handleSelfAssess = (correct: boolean) => {
        const currentQ = questions[currentIndex];
        onResult(correct, currentQ.word);
        recordResult(correct);
    };

    const finishSession = () => {
        const now = Date.now();
        const practicedIds = new Set(questions.map((q: any) => q.id));
        practicedIds.forEach(id => {
            const config = stats?.favoriteConfigs?.[id] as any;
            if (config?.mode === 'absolute') {
                updateFavoriteConfig?.({ ...config, lastReviewedAt: now });
            }
        });
        setSessionStats(prev => ({ ...prev, totalTimeMs: now - sessionStartRef.current }));
        setIsFinished(true);
    };

    const handleNext = () => {
        stop();
        setSelectedOption(null);
        setShowResult(false);
        setCardAnimState('animate');
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            finishSession();
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            stop();
            setSelectedOption(null);
            setShowResult(false);
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleRestart = () => {
        setIsFinished(false);
        setCurrentIndex(0);
        setSessionKey(prev => prev + 1);
        setStreak(0);
        setSessionXP(0);
        setFloatingXPs([]);
        setSessionStats({ totalAttempts: 0, correctAnswers: 0, incorrectAnswers: 0, startTime: Date.now(), maxStreak: 0 });
        sessionStartRef.current = Date.now();
    };

    // ═══════════════════════════════════════
    //  EMPTY STATE
    // ═══════════════════════════════════════

    if (questions.length < 4) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <EmptyState msg="Prática indisponível" icon="edit-3" />
                <p className="text-slate-400 text-sm mt-2">
                    Salve pelo menos 4 palavras com frases de contexto para liberar a prática.
                </p>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  COMPLETION SCREEN
    // ═══════════════════════════════════════

    if (isFinished) {
        return (
            <>
                <div className="h-full" />
                <CompletionScreen
                    sessionStats={sessionStats}
                    xpGained={sessionXP}
                    totalQuestions={questions.length}
                    onRestart={handleRestart}
                />
            </>
        );
    }

    // ═══════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════

    const currentQ        = questions[currentIndex];
    const isGerman        = currentQ.language === 'de';
    const progressPercent = (currentIndex / questions.length) * 100;
    const comboMultiplier = getComboMultiplier(streak);

    const sentenceParts = currentQ.sentence?.includes(currentQ.word)
        ? currentQ.sentence.split(currentQ.word)
        : [currentQ.sentence, ''];

    return (
        <div className="p-4 h-full flex flex-col max-w-md mx-auto pb-20 relative">

            {/* ══ HEADER ══ */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-700">Prática</span>
                    {practiceMode === 'swipe' && (
                        <span className="text-[9px] font-extrabold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                            Swipe
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* XP Badge */}
                    <motion.div
                        key={sessionXP}
                        initial={{ scale: 1.18 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-1 bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full text-xs font-extrabold"
                    >
                        <Zap size={11} className="fill-current" />
                        {sessionXP} XP
                    </motion.div>
                    {/* Mode Toggle */}
                    <button
                        onClick={() => { setPracticeMode(m => m === 'multiple-choice' ? 'swipe' : 'multiple-choice'); }}
                        title={practiceMode === 'multiple-choice' ? 'Ativar modo Swipe' : 'Ativar Múltipla Escolha'}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold border transition-colors ${
                            practiceMode === 'swipe'
                                ? 'bg-brand-100 text-brand-700 border-brand-200'
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <ArrowLeftRight size={12} />
                    </button>
                </div>
            </div>

            {/* ══ COMBO BAR ══ */}
            <AnimatePresence>
                {streak >= 2 && (
                    <motion.div
                        key="combo-bar"
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 10 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.28 }}
                        className="flex items-center justify-between bg-gradient-to-r from-amber-50 via-brand-50 to-brand-50 border border-brand-100 rounded-xl px-3 py-2 overflow-hidden flex-shrink-0"
                    >
                        <motion.div
                            key={streak}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.25 }}
                            className="flex items-center gap-1.5 text-sm font-extrabold text-amber-700"
                        >
                            <Flame size={15} className="fill-current text-amber-500" />
                            Combo {streak}x
                        </motion.div>
                        <span className="text-[11px] font-extrabold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                            {comboMultiplier}x XP
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══ PROGRESS BAR ══ */}
            <div className="mb-4 flex-shrink-0">
                <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            {invertPractice ? 'PT → ' + (isGerman ? 'DE' : 'ZH') : 'Complete a frase'}
                        </span>
                        {/* Invert toggle */}
                        <button
                            onClick={() => setInvertPractice(p => !p)}
                            className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                invertPractice
                                    ? 'bg-brand-100 text-brand-600 border-brand-200'
                                    : 'text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <ArrowLeftRight size={10} />
                        </button>
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-500 tabular-nums">
                        {currentIndex + 1} / {questions.length}
                    </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* ══ MAIN CONTENT ══ */}
            {practiceMode === 'multiple-choice' ? (

                /* ─── MULTIPLE CHOICE ─── */
                <>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`card-${currentIndex}`}
                            variants={questionCardVariants}
                            initial="initial"
                            animate={cardAnimState}
                            exit="exit"
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-3 flex-shrink-0"
                        >
                            {/* Inverted mode: show only Portuguese */}
                            {invertPractice && !showResult ? (
                                <div className="flex flex-col items-center justify-center py-3 min-h-[100px]">
                                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Traduza</p>
                                    <h3 className="text-lg font-bold text-slate-800 text-center leading-snug mb-2">
                                        {currentQ.translation}
                                    </h3>
                                    <div className="h-px w-12 bg-brand-200 my-2" />
                                    <p className="text-brand-600 font-semibold text-sm text-center">{currentQ.wordMeaning}</p>
                                    <p className="text-xs text-slate-400 italic mt-2">
                                        Selecione a palavra em {isGerman ? 'Alemão' : 'Chinês'}
                                    </p>
                                </div>
                            ) : (
                                /* Normal mode: sentence with blank */
                                <p className={`text-base text-slate-800 leading-relaxed ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                                    {sentenceParts[0]}
                                    {showResult ? (
                                        <motion.button
                                            initial={{ scale: 0.88 }}
                                            animate={{ scale: 1 }}
                                            onClick={() => {
                                                const aid = `practice-word-${currentIndex}`;
                                                playingId === aid ? stop() : speak(currentQ.word, (currentQ.language || 'zh') as any, aid);
                                            }}
                                            className={`inline-block min-w-[40px] border-b-2 mx-0.5 text-center font-bold cursor-pointer hover:opacity-75 active:scale-95 transition-all ${
                                                selectedOption === currentQ.word
                                                    ? 'text-green-600 border-green-500'
                                                    : 'text-red-500 border-red-400'
                                            } ${playingId === `practice-word-${currentIndex}` ? 'animate-pulse' : ''}`}
                                        >
                                            {currentQ.word}
                                        </motion.button>
                                    ) : (
                                        <span className="inline-block min-w-[40px] border-b-2 mx-0.5 text-center font-bold text-brand-600 border-brand-500">
                                            ____
                                        </span>
                                    )}
                                    {sentenceParts.length > 1 ? sentenceParts[1] : ''}
                                    {invertPractice && showResult && (
                                        <span className="block mt-1 text-xs text-green-600 font-bold text-center animate-in fade-in">
                                            Frase Original Revelada!
                                        </span>
                                    )}
                                </p>
                            )}

                            {/* Support info (audio + meanings) */}
                            {(!invertPractice || showResult) && (
                                <div className="mt-3 flex flex-col items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            const aid = `practice-sentence-${currentIndex}`;
                                            playingId === aid ? stop() : speak(currentQ.sentence, (currentQ.language || 'zh') as any, aid);
                                        }}
                                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-600 transition-colors"
                                    >
                                        {playingId === `practice-sentence-${currentIndex}`
                                            ? <><Square size={12} /> Parar</>
                                            : <><Volume2 size={12} /> Ouvir frase</>
                                        }
                                    </button>
                                    <p className="text-xs font-semibold text-brand-600">{currentQ.wordMeaning}</p>
                                    <p className="text-xs text-slate-400 italic">{currentQ.translation}</p>

                                    {/* Favorite button (visible after answering) */}
                                    <AnimatePresence>
                                        {showResult && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.82 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.82 }}
                                                onClick={() => {
                                                    setActiveFavoriteWord({ id: currentQ.id, term: currentQ.word });
                                                    setFavoriteModalOpen(true);
                                                }}
                                                className={`mt-0.5 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                                                    stats?.favoriteConfigs?.[currentQ.id]
                                                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                }`}
                                            >
                                                <Star className={`w-3 h-3 ${stats?.favoriteConfigs?.[currentQ.id] ? 'fill-current text-amber-500' : ''}`} />
                                                {stats?.favoriteConfigs?.[currentQ.id] ? 'Frequência ativa' : 'Frequência'}
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Answer Options — Grid 2×2 */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`options-${currentIndex}`}
                            variants={staggerContainerVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="grid grid-cols-2 gap-2.5 flex-1 mb-3"
                        >
                            {options.map((opt, i) => {
                                const isCorrectOpt  = showResult && opt === currentQ.word;
                                const isWrongOpt    = showResult && opt === selectedOption && opt !== currentQ.word;
                                const isDimmed      = showResult && !isCorrectOpt && !isWrongOpt;

                                return (
                                    <motion.button
                                        key={`${currentIndex}-${i}`}
                                        variants={staggerItemVariants}
                                        onClick={() => handleAnswer(opt)}
                                        disabled={showResult}
                                        whileTap={!showResult ? { scale: 0.95 } : {}}
                                        animate={
                                            isCorrectOpt ? {
                                                borderColor: '#22c55e', backgroundColor: '#f0fdf4',
                                                boxShadow: '0 4px 14px rgba(34,197,94,0.18)',
                                                scale: 1.02
                                            } : isWrongOpt ? {
                                                borderColor: '#f87171', backgroundColor: '#fef2f2',
                                                boxShadow: '0 0 0 rgba(0,0,0,0)'
                                            } : {}
                                        }
                                        className={`py-3 px-2 rounded-xl border-2 font-bold text-sm transition-colors min-h-[72px] flex items-center justify-center gap-1.5 ${
                                            isCorrectOpt  ? 'border-green-400 bg-green-50 text-green-700' :
                                            isWrongOpt    ? 'border-red-400 bg-red-50 text-red-700' :
                                            isDimmed      ? 'opacity-35 border-slate-200 bg-white text-slate-700 cursor-not-allowed' :
                                            'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                                        } ${isGerman ? 'font-sans' : 'font-chinese'}`}
                                    >
                                        <span className="text-[10px] font-extrabold text-slate-300 shrink-0">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <span className="text-center leading-tight">{opt}</span>
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                </>

            ) : (

                /* ─── SWIPE MODE ─── */
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`swipe-${currentIndex}`}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.28 }}
                        className="flex-1 flex flex-col gap-3 mb-3"
                    >
                        <SwipeCard
                            question={currentQ}
                            isGerman={isGerman}
                            onSelfAssess={handleSelfAssess}
                            playingId={playingId}
                            speak={speak}
                            stop={stop}
                            audioId={`swipe-${currentIndex}`}
                        />
                        {!isGerman && currentQ.pinyin && (
                            <p className="text-center text-xs text-slate-400">{currentQ.pinyin}</p>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}

            {/* ══ NAVIGATION ══ */}
            <div className="flex gap-2 flex-shrink-0">
                <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="px-3 py-2.5 font-extrabold bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-600"
                >
                    ←
                </button>
                <motion.button
                    onClick={handleNext}
                    disabled={!showResult && practiceMode === 'multiple-choice'}
                    whileTap={(showResult || practiceMode === 'swipe') ? { scale: 0.97 } : {}}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                        (showResult || practiceMode === 'swipe')
                            ? 'bg-brand-600 text-white hover:bg-brand-700'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    style={(showResult || practiceMode === 'swipe') ? { boxShadow: '0 4px 14px rgba(5,150,105,0.25)' } : {}}
                >
                    {currentIndex < questions.length - 1 ? 'Próximo' : 'Concluir'}
                    <ArrowRight size={15} />
                </motion.button>
            </div>

            {/* ══ FLOATING XP ══ */}
            <AnimatePresence>
                {floatingXPs.map(xp => (
                    <motion.div
                        key={xp.id}
                        variants={floatingXPVariants}
                        initial="initial"
                        animate="animate"
                        exit={{ opacity: 0 }}
                        className="fixed right-5 bottom-36 pointer-events-none z-50 flex items-center gap-1 text-brand-600 font-extrabold text-base"
                    >
                        <Zap size={14} className="fill-current text-brand-500" />
                        +{xp.value} XP
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* ══ FAVORITE MODAL ══ */}
            {activeFavoriteWord && (
                <FavoriteModal
                    isOpen={favoriteModalOpen}
                    onClose={() => { setFavoriteModalOpen(false); setActiveFavoriteWord(null); }}
                    wordId={activeFavoriteWord.id}
                    wordTerm={activeFavoriteWord.term}
                    currentConfig={stats?.favoriteConfigs?.[activeFavoriteWord.id]}
                    onSave={(config) => updateFavoriteConfig?.(config || { id: activeFavoriteWord.id, remove: true } as any)}
                />
            )}
        </div>
    );
};

export default PracticeView;
