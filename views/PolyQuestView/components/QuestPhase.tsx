import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, WordEnigma, PLAYER_CLASSES } from '../types';
import { RULES } from '../rules';
import { generateEnigmas, generateIntruder } from '../../../services/gemini';
import { shuffleArray } from '../utils';
import { usePuterSpeech } from '../../../hooks/usePuterSpeech';
import { useStudyItems } from '../../../hooks/useStudyItems';
import { useGameDataLoader } from '../../../hooks/useGameDataLoader';
import { THEME, getPlayerColor } from '../theme';
import { audio } from '../audio';
import HPBar from './HPBar';
import PlayerHud from './PlayerHud';
import ComboMeter from './ComboMeter';
import ScoreFloat, { FloatPoint } from './ScoreFloat';
import AudioToggle from './AudioToggle';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onSetEnigmas: (enigmas: WordEnigma[]) => void;
    onAnswer: (idx: number, ans: string, isCorrect: boolean) => Promise<{ awarded: number; comboCount: number; comboMult: number; allDone: boolean } | null>;
    onLockEnigma: (idx: number) => Promise<boolean>;
    onUnlockEnigma: (idx: number) => Promise<void>;
    onRequestHelp: (idx: number) => Promise<void>;
    onProvideHelp: (idx: number) => Promise<void>;
    onUpdatePartyHP?: (delta: number) => Promise<void>;
    onUsePerkMage: (idx: number) => Promise<void>;
    onUsePerkBard: () => Promise<void>;
    onTriggerIntruder: (fakeWord: string, insertedAt: number) => Promise<void>;
    onShowOriginalText?: () => void;
}

export const QuestPhase: React.FC<Props> = ({
    room, currentUserId, onSetEnigmas, onAnswer, onLockEnigma, onUnlockEnigma,
    onRequestHelp, onProvideHelp, onUsePerkMage, onUsePerkBard,
    onTriggerIntruder, onShowOriginalText,
}) => {
    const { speak } = usePuterSpeech();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [eliminated, setEliminated] = useState<string[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const [floats, setFloats] = useState<FloatPoint[]>([]);
    const intruderTriggeredRef = useRef(false);

    const { items } = useStudyItems(currentUserId);
    const { gameCards } = useGameDataLoader({
        items,
        activeFolderIds: room.config.context === 'library' ? room.config.selectedFolderIds || [] : [],
        requireBothSides: true,
    });

    const me = room.players.find(p => p.id === currentUserId);
    const myCls = me?.cls ? PLAYER_CLASSES.find(c => c.id === me.cls) : null;
    const perkCooldownRemain = me?.perkUsedAt && myCls ? Math.max(0, myCls.perkCooldownMs - (Date.now() - me.perkUsedAt)) : 0;
    const [, setRefresher] = useState(0);

    // Force re-render every second pra cooldown
    useEffect(() => {
        if (perkCooldownRemain <= 0) return;
        const id = setInterval(() => setRefresher(x => x + 1), 1000);
        return () => clearInterval(id);
    }, [perkCooldownRemain]);

    const progress = room.enigmas.length > 0
        ? (room.enigmas.filter(e => e.isDiscovered).length / room.enigmas.length) * 100
        : 0;

    // Geração inicial dos enigmas (host)
    useEffect(() => {
        const init = async () => {
            if (room.enigmas.length === 0 && room.selectedWords.length > 0 && room.hostId === currentUserId) {
                try {
                    setLoading(true); setError(null);
                    const data = await generateEnigmas(
                        room.selectedWords,
                        room.config.sourceLang,
                        room.config.targetLang,
                        room.config.difficulty,
                    );
                    const enigmas: WordEnigma[] = data.map(d => {
                        const cardMatch = gameCards.find(c => c.word === d.word);
                        return {
                            word: d.word,
                            translation: cardMatch ? cardMatch.meaning : d.translation,
                            alternatives: cardMatch && cardMatch.distractors.length > 0 ? cardMatch.distractors : d.alternatives,
                            synonym: cardMatch && cardMatch.pinyin ? cardMatch.pinyin : d.synonym,
                            isDiscovered: false,
                            attempts: 0,
                            needsHelp: false,
                        };
                    });
                    onSetEnigmas(enigmas);
                } catch (e) {
                    console.error(e);
                    setError('Erro ao gerar enigmas. Tente recarregar.');
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        init();
    }, [room.enigmas.length, room.selectedWords, room.config.context, gameCards.length, currentUserId, room.hostId]);

    // Trigger do Intruder (50% das palavras descobertas, ainda não disparou) — só host
    useEffect(() => {
        if (room.intruderTriggered || intruderTriggeredRef.current) return;
        if (room.hostId !== currentUserId) return;
        if (room.enigmas.length === 0) return;
        const discovered = room.enigmas.filter(e => e.isDiscovered).length;
        if (discovered / room.enigmas.length < RULES.INTRUDER_TRIGGER_PCT) return;
        intruderTriggeredRef.current = true;
        (async () => {
            try {
                const sample = room.enigmas.slice(0, Math.min(10, room.enigmas.length)).map(e => e.word);
                const data = await generateIntruder(sample, room.config.sourceLang, room.config.difficulty);
                const tokens = room.config.tokens || [];
                const insertedAt = Math.floor(tokens.length * (0.3 + Math.random() * 0.4));
                audio.intruderAlert();
                await onTriggerIntruder(data.word, insertedAt);
            } catch (e) {
                console.error('[Intruder] generate fail:', e);
                await onTriggerIntruder('Unicórnio', Math.floor((room.config.tokens?.length || 1) / 2));
            }
        })();
    }, [room.enigmas, room.intruderTriggered, room.hostId, currentUserId, room.config.sourceLang, room.config.tokens, room.config.difficulty, onTriggerIntruder]);

    const handleCardClick = async (idx: number) => {
        const e = room.enigmas[idx];
        if (e.isDiscovered) return;

        // Caso ajuda
        if (e.needsHelp && e.helpRequestedBy !== currentUserId) {
            audio.cardLock();
            setActiveIdx(idx);
            setShowHint(false);
            setEliminated([]);
            setOptions(shuffleArray([e.translation, ...e.alternatives]));
            return;
        }

        if (e.activeSolver && e.activeSolver !== currentUserId) return;

        const locked = await onLockEnigma(idx);
        if (locked) {
            audio.cardLock();
            setActiveIdx(idx);
            setShowHint(false);
            setEliminated([]);
            setOptions(shuffleArray([e.translation, ...e.alternatives]));
        }
    };

    const closeModal = async () => {
        if (activeIdx === null) return;
        const e = room.enigmas[activeIdx];
        if (e?.activeSolver === currentUserId) await onUnlockEnigma(activeIdx);
        setActiveIdx(null);
    };

    const submitAnswer = async (answer: string) => {
        if (activeIdx === null) return;
        const e = room.enigmas[activeIdx];
        const correct = answer.toLowerCase() === e.translation.toLowerCase();

        // Caso ajudante
        if (e.needsHelp && e.helpRequestedBy !== currentUserId) {
            if (correct) {
                audio.correct();
                await onProvideHelp(activeIdx);
                pushFloat(`+${RULES.HELP_GIVEN_POINTS}`, 'green');
                setActiveIdx(null);
            } else {
                audio.wrong();
            }
            return;
        }

        setActiveIdx(null);
        await onUnlockEnigma(activeIdx);
        const result = await onAnswer(activeIdx, answer, correct);
        if (correct) {
            audio.correct();
            const mult = result?.comboMult || 1;
            if (mult >= 1.5) audio.combo(Math.floor(mult * 2));
            pushFloat(`+${result?.awarded ?? RULES.CORRECT_POINTS}`, 'gold');
            if (result?.allDone) {
                setTimeout(() => audio.victory(), 200);
            }
        } else {
            audio.wrong();
            pushFloat(`-${RULES.WRONG_DAMAGE}`, 'red');
        }
    };

    const pushFloat = (text: string, color: FloatPoint['color']) => {
        const x = 30 + Math.random() * 40;
        const y = 30 + Math.random() * 30;
        setFloats(f => [...f, { id: `${Date.now()}-${Math.random()}`, x, y, text, color }]);
    };

    const dropFloat = useCallback((id: string) => {
        setFloats(f => f.filter(it => it.id !== id));
    }, []);

    const handleHint = async () => {
        if (room.partyHP <= RULES.HINT_COST || showHint) return;
        // Custo da dica é tratado client-side via PartyHP via ação genérica?
        // Para simplificar e não duplicar lógica, mostra apenas a dica visual aqui.
        setShowHint(true);
        audio.hint();
    };

    const handleEliminate = () => {
        if (room.partyHP <= RULES.ELIMINATE_COST || eliminated.length > 0 || activeIdx === null) return;
        const e = room.enigmas[activeIdx];
        setEliminated(shuffleArray(e.alternatives).slice(0, 2));
        audio.hint();
    };

    const handleSOS = async () => {
        if (activeIdx === null) return;
        await onRequestHelp(activeIdx);
        setActiveIdx(null);
    };

    const handlePerk = async () => {
        if (perkCooldownRemain > 0 || !myCls) return;
        if (myCls.id === 'mage') {
            if (activeIdx === null) {
                alert('Selecione uma carta primeiro pra usar este perk!');
                return;
            }
            audio.classPerk();
            await onUsePerkMage(activeIdx);
        } else if (myCls.id === 'bard') {
            audio.classPerk();
            await onUsePerkBard();
            pushFloat('×2 BUFF!', 'blue');
        } else if (myCls.id === 'warrior') {
            alert('Sua Investida só funciona contra o Boss.');
        }
    };

    if (loading) {
        return (
            <div className={`min-h-full ${THEME.bg} -m-6 p-6 flex items-center justify-center`}>
                <div className="text-center text-white">
                    <Icon name="loader" size={48} className="text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="font-bold text-lg">Conjurando enigmas…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`min-h-full ${THEME.bg} -m-6 p-6 flex items-center justify-center`}>
                <div className="text-center text-white max-w-md">
                    <Icon name="alert-circle" size={48} className="text-rose-400 mx-auto mb-4" />
                    <p className="font-bold text-lg mb-2">Algo deu errado</p>
                    <p className="text-white/60 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-4 md:p-6 text-white relative`}>
            <ScoreFloat items={floats} onDone={dropFloat} />

            <div className="max-w-5xl mx-auto">
                {/* Top HUD: HP + Combo + Players + Audio */}
                <div className={`${THEME.bgPanel} rounded-2xl p-3 mb-3 ${THEME.borderGlow} border sticky top-0 z-30`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1">
                            <HPBar current={room.partyHP} max={room.maxPartyHP} label="❤ Vida da Party" />
                        </div>
                        <div className="flex items-center gap-2">
                            <ComboMeter combo={room.combo} />
                            <div className="px-3 py-2 bg-amber-400/20 border border-amber-400/40 rounded-xl text-amber-300 font-black text-sm">
                                {room.enigmas.filter(e => e.isDiscovered).length}/{room.enigmas.length}
                            </div>
                            <AudioToggle />
                        </div>
                    </div>

                    {/* Player strip */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                        {room.players.map(p => (
                            <PlayerHud key={p.id} player={p} isMe={p.id === currentUserId} isHost={p.id === room.hostId} />
                        ))}
                    </div>

                    {/* Perk button (se tem classe) */}
                    {myCls && (
                        <div className="mt-2 flex items-center gap-2">
                            <button
                                onClick={handlePerk}
                                disabled={perkCooldownRemain > 0}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${perkCooldownRemain > 0
                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md hover:shadow-violet-500/50 active:scale-95'
                                }`}
                                title={myCls.perkDesc}
                            >
                                <span className="text-base">{myCls.icon}</span>
                                {perkCooldownRemain > 0
                                    ? `${myCls.perkName} (${Math.ceil(perkCooldownRemain / 1000)}s)`
                                    : myCls.perkName}
                            </button>
                            {onShowOriginalText && (
                                <button
                                    onClick={onShowOriginalText}
                                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-xs text-white/80 font-bold flex items-center gap-1.5"
                                    title="Ver texto original"
                                >
                                    <Icon name="book-open" size={14} /> Texto
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-12">
                    {room.enigmas.map((e, idx) => {
                        const activeUser = e.activeSolver ? room.players.find(p => p.id === e.activeSolver) : null;
                        const userColor = activeUser ? getPlayerColor(activeUser.id) : null;

                        return (
                            <button
                                key={idx}
                                onClick={() => handleCardClick(idx)}
                                disabled={e.isDiscovered || (!!e.activeSolver && e.activeSolver !== currentUserId && !e.needsHelp)}
                                className={`
                                    relative rounded-2xl border-2 transition-all duration-300 p-4 min-h-[140px] flex flex-col items-center justify-center gap-2 group
                                    ${e.isDiscovered
                                        ? 'bg-emerald-500/15 border-emerald-400/40 text-white'
                                        : e.needsHelp
                                            ? 'bg-rose-500/20 border-rose-400 border-dashed animate-pulse text-white'
                                            : activeUser
                                                ? 'border-2 backdrop-blur'
                                                : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-amber-400/50 text-white shadow-lg'
                                    }
                                `}
                                style={activeUser && !e.needsHelp ? {
                                    backgroundColor: `${userColor!.hex}20`,
                                    borderColor: userColor!.hex,
                                } : undefined}
                            >
                                {e.needsHelp && (
                                    <div className="absolute top-2 right-2 text-rose-300 animate-bounce">
                                        <Icon name="life-buoy" size={20} />
                                    </div>
                                )}

                                {e.isDiscovered ? (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-emerald-400/30 flex items-center justify-center mb-1">
                                            <Icon name="check" size={20} className="text-emerald-300" />
                                        </div>
                                        <span className="font-bold text-base">{e.word}</span>
                                        <span className="text-xs text-emerald-300 font-medium">{e.translation}</span>
                                    </>
                                ) : activeUser ? (
                                    <>
                                        {activeUser.avatarUrl ? (
                                            <img src={activeUser.avatarUrl} className="w-10 h-10 rounded-full ring-2 ring-white/30" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: userColor!.hex }}>
                                                {activeUser.name[0]}
                                            </div>
                                        )}
                                        <span className="text-xs font-bold opacity-70">
                                            {activeUser.id === currentUserId ? 'Você' : activeUser.name.split(' ')[0]}
                                        </span>
                                        <span className="text-[10px] text-white/50 italic">resolvendo…</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="lock" size={26} className="text-white/30 group-hover:text-amber-300 transition-colors mb-1" />
                                        <span className="font-bold text-base group-hover:text-amber-200">{e.word}</span>
                                        <span className="text-[10px] text-white/40 group-hover:text-amber-300 uppercase tracking-wider">Tocar</span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Modal de resposta */}
            {activeIdx !== null && (() => {
                const e = room.enigmas[activeIdx];
                const isHelping = e.needsHelp && e.helpRequestedBy !== currentUserId;
                const requester = e.helpRequestedBy ? room.players.find(p => p.id === e.helpRequestedBy) : null;
                const returnedAfterHelp = !!(e.helpedBy && !e.isDiscovered);

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className={`${THEME.bgPanelSolid} rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-2 animate-in zoom-in-95 ${isHelping ? 'border-emerald-400' : 'border-amber-400/40'}`}>
                            <div className={`p-3 flex justify-between items-center ${isHelping ? 'bg-emerald-500/20' : 'bg-amber-400/15'}`}>
                                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2 text-white">
                                    {isHelping ? (
                                        <><Icon name="life-buoy" size={16} className="text-emerald-300" />
                                            Ajudando {requester?.name || ''} (+{RULES.HELP_GIVEN_POINTS} pts)</>
                                    ) : (
                                        <><Icon name="lock-open" size={16} className="text-amber-300" />Decifre</>
                                    )}
                                </h3>
                                <button onClick={closeModal} className="text-white/60 hover:text-white">
                                    <Icon name="x" size={20} />
                                </button>
                            </div>

                            <div className="p-6 text-center space-y-4">
                                <div className="bg-black/30 rounded-2xl p-4 border border-white/10">
                                    {returnedAfterHelp && (
                                        <div className="mb-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl px-3 py-2">
                                            <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider">💡 Dica do parceiro</p>
                                            <p className="text-white italic">"{e.synonym}"</p>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Palavra Oculta</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <h2 className="text-3xl font-black text-amber-300">{e.word}</h2>
                                        <button
                                            onClick={(ev) => { ev.stopPropagation(); speak(e.word, (room.config.sourceLang || 'zh') as any); }}
                                            className="p-2 rounded-full text-white/40 hover:text-amber-300 hover:bg-white/10"
                                        >
                                            <Icon name="volume-2" size={20} />
                                        </button>
                                    </div>
                                    {e.revealedInitial && (
                                        <p className="text-xs text-violet-300 mt-2">
                                            🧙 Inicial: <span className="font-bold text-base">{e.translation[0].toUpperCase()}…</span>
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => submitAnswer(opt)}
                                            disabled={eliminated.includes(opt)}
                                            className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${eliminated.includes(opt)
                                                ? 'opacity-25 bg-white/5 border-white/10 cursor-not-allowed'
                                                : 'bg-white/5 border-white/15 hover:bg-amber-400/20 hover:border-amber-400 active:scale-95 text-white'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>

                                {!isHelping && (
                                    <div className="flex justify-center gap-2 pt-3 border-t border-white/10 text-xs">
                                        <button
                                            onClick={handleHint}
                                            disabled={showHint || room.partyHP <= RULES.HINT_COST}
                                            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 text-amber-300 font-bold disabled:opacity-50"
                                        >
                                            <Icon name="sun" size={12} /> Dica (-{RULES.HINT_COST} HP)
                                        </button>
                                        <button
                                            onClick={handleSOS}
                                            disabled={!!e.needsHelp}
                                            className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/15 text-rose-300 font-bold disabled:opacity-40"
                                        >
                                            <Icon name="life-buoy" size={12} /> SOS
                                        </button>
                                        {onShowOriginalText && (
                                            <button
                                                onClick={() => { setActiveIdx(null); onShowOriginalText(); }}
                                                className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 text-sky-300 font-bold"
                                            >
                                                <Icon name="book-open" size={12} /> Texto
                                            </button>
                                        )}
                                    </div>
                                )}

                                {showHint && e.synonym && !returnedAfterHelp && (
                                    <div className="text-sm text-sky-300 bg-sky-500/15 p-2 rounded-lg border border-sky-400/30">
                                        💡 "{e.synonym}"
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
