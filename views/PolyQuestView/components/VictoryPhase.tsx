import React, { useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, SUPPORTED_LANGUAGES, PLAYER_CLASSES } from '../types';
import { THEME, getPlayerColor } from '../theme';
import { audio } from '../audio';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onResetGame: () => void;
    onSaveItems: (items: { word: string; translation: string; context: string }[]) => Promise<void>;
    onSaveHistory: (result: any) => Promise<void>;
}

/** Tela de vitória — fanfarra, podium, save da biblioteca. */
export const VictoryPhase: React.FC<Props> = ({ room, currentUserId, onResetGame, onSaveItems, onSaveHistory }) => {
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [historySaved, setHistorySaved] = useState(false);

    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.id === currentUserId) + 1;
    const me = room.players.find(p => p.id === currentUserId);
    const langName = SUPPORTED_LANGUAGES.find(l => l.code === room.config.sourceLang)?.name || room.config.sourceLang;

    useEffect(() => {
        audio.victory();
    }, []);

    useEffect(() => {
        if (!historySaved && me) {
            onSaveHistory({
                score: me.score,
                rank: myRank,
                totalPlayers: room.players.length,
                won: true,
                bossDefeated: !!room.boss && room.boss.hp <= 0,
                wordsLearned: room.enigmas.filter(e => e.isDiscovered).length,
                helpsGiven: me.helpCount || 0,
            }).then(() => setHistorySaved(true));
        }
    }, [historySaved, currentUserId]);

    const getContext = (word: string) => {
        const sentences = room.config.originalText.split(/[.!?]/);
        const m = sentences.find(s => s.toLowerCase().includes(word.toLowerCase()));
        return m ? m.trim() + '.' : `... ${word} ...`;
    };

    const handleSave = async () => {
        if (saving || selected.size === 0) return;
        setSaving(true);
        try {
            const items = Array.from(selected).map(i => {
                const e = room.enigmas[i];
                return { word: e.word, translation: e.translation, context: getContext(e.word) };
            });
            await onSaveItems(items);
            alert(`✓ Salvou ${selected.size} palavras na biblioteca!`);
        } catch (e) {
            alert('Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const toggleAll = () => {
        if (selected.size === room.enigmas.length) setSelected(new Set());
        else setSelected(new Set(room.enigmas.map((_, i) => i)));
    };

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-4 md:p-6 text-white`}>
            <div className="max-w-3xl mx-auto space-y-4 pb-12">
                {/* Splash de vitória */}
                <div className={`${THEME.bgPanel} rounded-3xl p-6 ${THEME.borderGlow} border-2 border-amber-400 text-center relative overflow-hidden`}>
                    {/* Sparkles ao fundo */}
                    <div className="absolute inset-0 pointer-events-none">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <span
                                key={i}
                                className="absolute text-amber-300 text-xl animate-twinkle"
                                style={{
                                    left: `${10 + (i * 7) % 80}%`,
                                    top: `${10 + (i * 11) % 80}%`,
                                    animationDelay: `${i * 0.2}s`,
                                }}
                            >✦</span>
                        ))}
                    </div>

                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/50 animate-bounce">
                        <Icon name="crown" size={40} className="text-amber-900" />
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black text-amber-300 mb-1 tracking-tight">VITÓRIA!</h1>
                    <p className="text-white/70 text-sm">
                        A party derrotou o boss e dominou o <span className="font-bold text-amber-200">{langName}</span>.
                    </p>

                    {/* Podium 3-2-1 */}
                    <div className="flex items-end justify-center gap-2 mt-6 h-44">
                        {sorted[1] && (
                            <PodiumColumn player={sorted[1]} place={2} height="h-24" />
                        )}
                        {sorted[0] && (
                            <PodiumColumn player={sorted[0]} place={1} height="h-32" highlight />
                        )}
                        {sorted[2] && (
                            <PodiumColumn player={sorted[2]} place={3} height="h-20" />
                        )}
                    </div>

                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-black/30 rounded-full border border-white/15">
                        <Icon name="trophy" size={16} className="text-amber-300" />
                        <span className="text-sm">
                            Você ficou em <span className="font-black text-amber-300">#{myRank}</span> com <span className="font-black text-amber-300">{me?.score || 0} pts</span>
                        </span>
                    </div>
                </div>

                {/* Biblioteca */}
                <div className={`${THEME.bgPanelSolid} rounded-2xl ${THEME.borderGlow} border overflow-hidden`}>
                    <div className="p-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-black text-amber-300 flex items-center gap-2">
                                <Icon name="book-open" size={20} /> Biblioteca da Missão
                            </h2>
                            <p className="text-xs text-white/60">Selecione palavras para salvar nos seus estudos</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={toggleAll} className="text-xs font-bold text-white/70 px-3 py-2 rounded-lg hover:bg-white/10">
                                {selected.size === room.enigmas.length ? 'Desmarcar' : 'Marcar todas'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={selected.size === 0 || saving}
                                className="bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                <Icon name="save" size={16} />
                                Salvar ({selected.size})
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                        {room.enigmas.map((e, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    const next = new Set(selected);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    setSelected(next);
                                }}
                                className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 ${selected.has(i) ? 'bg-amber-500/10' : ''}`}
                            >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected.has(i) ? 'bg-amber-400 border-amber-400' : 'border-white/30'}`}>
                                    {selected.has(i) && <Icon name="check" size={12} className="text-slate-900" />}
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-amber-200">{e.word}</span>
                                    <span className="text-white/50 mx-2">→</span>
                                    <span className="text-emerald-300 font-medium">{e.translation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={onResetGame}
                    className="w-full py-3 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30"
                >
                    <Icon name="rotate-ccw" size={20} />
                    Nova Aventura
                </button>
            </div>
            <style>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0; transform: scale(0.5); }
                    50% { opacity: 1; transform: scale(1); }
                }
                .animate-twinkle { animation: twinkle 1.6s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

const PodiumColumn: React.FC<{ player: any; place: number; height: string; highlight?: boolean }> = ({ player, place, height, highlight }) => {
    const color = getPlayerColor(player.id);
    const cls = player.cls ? PLAYER_CLASSES.find(c => c.id === player.cls) : null;
    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-white border-4 shadow-lg ${highlight ? 'animate-bounce' : ''}`}
                style={{ backgroundColor: color.hex, borderColor: highlight ? '#FCD34D' : 'rgba(255,255,255,0.2)' }}
            >
                {player.avatarUrl ? (
                    <img src={player.avatarUrl} className="w-full h-full rounded-full" />
                ) : player.name[0]}
                {place === 1 && (
                    <div className="absolute -top-5 text-amber-400 text-2xl drop-shadow-lg">👑</div>
                )}
            </div>
            <div className={`${height} w-20 rounded-t-xl flex flex-col items-center justify-center ${highlight ? 'bg-gradient-to-b from-amber-400/40 to-amber-600/30 border border-amber-400' : 'bg-white/10 border border-white/20'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-amber-200' : 'text-white/60'}`}>#{place}</span>
                <span className="font-black text-lg text-white">{player.score}</span>
                <span className="text-[9px] text-white/60 truncate max-w-[70px]">
                    {cls && <span className="mr-1">{cls.icon}</span>}
                    {player.name.split(' ')[0]}
                </span>
            </div>
        </div>
    );
};
