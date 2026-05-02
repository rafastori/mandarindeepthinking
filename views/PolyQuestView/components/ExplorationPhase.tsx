import React, { useMemo, useState, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';
import { usePuterSpeech } from '../../../hooks/usePuterSpeech';
import { tokenizeTextWithAI } from '../../../services/gemini';
import { THEME, getPlayerColor } from '../theme';
import HPBar from './HPBar';
import PlayerHud from './PlayerHud';
import AudioToggle from './AudioToggle';
import { audio } from '../audio';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onToggleWord: (word: string) => void;
    onFinishExploration: () => void;
    onUpdateConfig?: (cfg: Partial<{ tokens: string[] }>) => void;
}

export const ExplorationPhase: React.FC<Props> = ({
    room, currentUserId, onToggleWord, onFinishExploration, onUpdateConfig,
}) => {
    const { speak } = usePuterSpeech();
    const isHost = room.hostId === currentUserId;
    const [tokens, setTokens] = useState<string[]>([]);
    const [isTokenizing, setIsTokenizing] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    useEffect(() => {
        if (room.config.tokens && room.config.tokens.length > 0) {
            setTokens(room.config.tokens);
            return;
        }
        const isCJK = ['zh', 'ja', 'ko'].includes(room.config.sourceLang);
        if (!isCJK) {
            const local = room.config.originalText.split(/(\s+|[.,!?;:()])/).filter(t => t.length > 0);
            setTokens(local);
            if (isHost && onUpdateConfig && local.length > 0) onUpdateConfig({ tokens: local });
            return;
        }
        const generate = async () => {
            setIsTokenizing(true); setTokenError(null);
            try {
                const ai = await tokenizeTextWithAI(room.config.originalText, room.config.sourceLang);
                setTokens(ai);
                if (isHost && onUpdateConfig && ai.length > 0) onUpdateConfig({ tokens: ai });
            } catch (e) {
                setTokenError('Erro ao processar texto.');
                const fallback = room.config.originalText.split(/(\s+|[.,!?;:()]|[　-〿぀-ゟ゠-ヿ一-龯]+)/).filter(t => t.length > 0);
                setTokens(fallback);
            } finally {
                setIsTokenizing(false);
            }
        };
        generate();
    }, [room.config.tokens, room.config.originalText, room.config.sourceLang, isHost, onUpdateConfig]);

    const isWord = (token: string) => {
        const t = token.trim();
        if (t.length === 0) return false;
        if (/^[\s.,!?;:()]+$/.test(t)) return false;
        return /[\p{L}\p{N}]/u.test(t);
    };

    const handleClick = (token: string) => {
        if (!isWord(token)) return;
        audio.cardLock();
        onToggleWord(token.trim());
    };

    const uniqueSelected = useMemo(() => Array.from(new Set(room.selectedWords)), [room.selectedWords]);

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-4 md:p-6 text-white`}>
            <div className="max-w-5xl mx-auto">
                {/* Top HUD */}
                <div className={`${THEME.bgPanel} rounded-2xl p-3 mb-3 ${THEME.borderGlow} border flex items-center gap-3`}>
                    <div className="flex-1">
                        <HPBar current={room.partyHP} max={room.maxPartyHP} label="Vida da Party" />
                    </div>
                    <div className="hidden sm:flex gap-2 items-center">
                        {room.players.map(p => (
                            <PlayerHud key={p.id} player={p} isMe={p.id === currentUserId} isHost={p.id === room.hostId} />
                        ))}
                    </div>
                    <AudioToggle />
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Texto */}
                    <div className={`flex-1 ${THEME.bgPanelSolid} rounded-2xl p-5 ${THEME.borderGlow} border`}>
                        <div className="mb-4">
                            <h2 className="text-lg font-black text-amber-300 flex items-center gap-2 uppercase tracking-wider">
                                <Icon name="search" size={18} />
                                Fase 1 — Exploração
                            </h2>
                            <p className="text-xs text-white/60 mt-1">
                                Toquem nas palavras que <span className="font-bold text-white">não conhecem</span>. Elas viram cartas na próxima fase.
                            </p>
                        </div>

                        {isHost && (
                            <button
                                onClick={() => { audio.classPerk(); onFinishExploration(); }}
                                disabled={uniqueSelected.length === 0}
                                className="w-full mb-4 px-4 py-3 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                Iniciar Quest <Icon name="arrow-right" size={18} />
                            </button>
                        )}

                        <div className="bg-black/30 rounded-xl p-5 text-base leading-loose text-white/90">
                            {isTokenizing && (
                                <div className="flex flex-col items-center py-8">
                                    <Icon name="loader" size={36} className="text-amber-400 animate-spin mb-2" />
                                    <p className="text-white/70 text-sm">Decifrando o texto…</p>
                                </div>
                            )}
                            {tokenError && !isTokenizing && (
                                <p className="text-rose-300 text-sm">{tokenError}</p>
                            )}
                            {!isTokenizing && tokens.map((token, i) => {
                                const valid = isWord(token);
                                if (!valid) return <span key={i} className="whitespace-pre-wrap">{token}</span>;
                                const cleanT = token.trim();
                                const selected = room.selectedWords.includes(cleanT);
                                return (
                                    <span
                                        key={i}
                                        onClick={() => handleClick(cleanT)}
                                        className={`cursor-pointer px-1 py-0.5 rounded transition-all duration-200 inline-block ${selected
                                            ? 'bg-amber-400 text-slate-900 font-bold scale-105 shadow-md shadow-amber-500/30'
                                            : 'hover:bg-white/10 hover:text-amber-300'
                                        }`}
                                    >
                                        {token}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sidebar enigmas */}
                    <div className={`lg:w-72 ${THEME.bgPanelSolid} rounded-2xl p-4 ${THEME.borderGlow} border`}>
                        <h3 className="font-black text-amber-300 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icon name="lock" size={16} />
                            Enigmas ({uniqueSelected.length})
                        </h3>
                        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                            {uniqueSelected.length === 0 ? (
                                <p className="text-center text-white/40 py-6 text-xs italic">
                                    Selecione palavras no texto.
                                </p>
                            ) : (
                                uniqueSelected.map((w, i) => (
                                    <div
                                        key={i}
                                        className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-amber-400/30 flex items-center justify-between group"
                                    >
                                        <span className="font-bold text-sm text-amber-100 truncate">{w}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => speak(w, (room.config.sourceLang || 'zh') as any)}
                                                className="p-1 text-white/40 hover:text-amber-300"
                                                title="Ouvir"
                                            >
                                                <Icon name="volume-2" size={14} />
                                            </button>
                                            <button
                                                onClick={() => onToggleWord(w)}
                                                className="p-1 text-white/40 hover:text-rose-400 opacity-0 group-hover:opacity-100"
                                                title="Remover"
                                            >
                                                <Icon name="x" size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
