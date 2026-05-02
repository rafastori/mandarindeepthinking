import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, PLAYER_CLASSES } from '../types';
import { RULES, pickRandomBoss } from '../rules';
import { generateBossLevel } from '../../../services/gemini';
import { useStudyItems } from '../../../hooks/useStudyItems';
import { useGameDataLoader } from '../../../hooks/useGameDataLoader';
import { THEME, getPlayerColor } from '../theme';
import HPBar from './HPBar';
import BossSprite from './BossSprite';
import PlayerHud from './PlayerHud';
import AudioToggle from './AudioToggle';
import { audio } from '../audio';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onStartBoss: (target: string, blocks: string[]) => Promise<void>;
    onAddBlock: (text: string) => Promise<void>;
    onRemoveBlock: (id: string) => Promise<void>;
    onReorderBlocks: (newOrder: any[]) => Promise<void>;
    onAttack: () => Promise<{ damage: number; killed: boolean } | null>;
    onUsePerkWarrior: () => Promise<void>;
    onBossAttacks: () => Promise<void>;
}

export const BossPhase: React.FC<Props> = ({
    room, currentUserId, onStartBoss, onAddBlock, onRemoveBlock,
    onReorderBlocks, onAttack, onUsePerkWarrior, onBossAttacks,
}) => {
    const isHost = room.hostId === currentUserId;
    const [generating, setGenerating] = useState(false);
    const [feedback, setFeedback] = useState<'success' | 'fail' | null>(null);
    const [attacking, setAttacking] = useState(false);
    const [bossHit, setBossHit] = useState(false);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [taunt, setTaunt] = useState<string | null>(null);
    const [, force] = useState(0);

    const { items } = useStudyItems(currentUserId);
    const { gamePairs } = useGameDataLoader({
        items,
        activeFolderIds: room.config.context === 'library' ? room.config.selectedFolderIds || [] : [],
        requireBothSides: true,
    });

    const me = room.players.find(p => p.id === currentUserId);
    const myCls = me?.cls ? PLAYER_CLASSES.find(c => c.id === me.cls) : null;
    const perkRemain = me?.perkUsedAt && myCls ? Math.max(0, myCls.perkCooldownMs - (Date.now() - me.perkUsedAt)) : 0;

    // Re-render para cooldowns + boss timer + ataques
    useEffect(() => {
        const id = setInterval(() => force(x => x + 1), 500);
        return () => clearInterval(id);
    }, []);

    // Geração do desafio do boss (host only)
    useEffect(() => {
        if (room.boss) return;
        if (!isHost) return;
        if (room.config.context === 'library' && gamePairs.length === 0) return;
        const generate = async () => {
            setGenerating(true);
            try {
                let target = '';
                let blocks: string[] = [];
                if (room.config.context === 'library') {
                    const itemsWithSentences = items.filter(i => {
                        const isSel = (room.config.selectedFolderIds || []).some(p => {
                            if (p === '__uncategorized__' && !i.folderPath) return true;
                            return i.folderPath === p || i.folderPath?.startsWith(p + '/');
                        });
                        return isSel && i.originalSentence && i.originalSentence.length > 5;
                    });
                    if (itemsWithSentences.length > 0) {
                        const random = itemsWithSentences[Math.floor(Math.random() * itemsWithSentences.length)];
                        target = random.originalSentence!;
                        const isCJK = ['zh', 'ja', 'ko'].includes(room.config.sourceLang);
                        blocks = isCJK
                            ? target.split(/(\s+|[.,!?;:()]|[　-〿぀-ゟ゠-ヿ一-龯]+)/).filter(t => t.trim().length > 0)
                            : target.split(/\s+/).filter(t => t.length > 0);
                    } else {
                        const shuffled = [...gamePairs].sort(() => 0.5 - Math.random()).slice(0, 5);
                        target = shuffled.map(p => p.term).join(' ');
                        blocks = shuffled.map(p => p.term);
                    }
                } else {
                    const data = await generateBossLevel(room.config.originalText, room.config.sourceLang, room.config.difficulty);
                    target = data.originalSentence;
                    blocks = data.blocks;
                }
                await onStartBoss(target, blocks);
            } catch (e) {
                console.error('[Boss gen] fail:', e);
                await onStartBoss('Erro ao gerar desafio', ['Erro', 'ao', 'gerar']);
            } finally {
                setGenerating(false);
            }
        };
        generate();
    }, [room.boss, isHost, gamePairs.length]);

    // Loop de ataque do boss (todos os clientes — race blindada por nextAttackAt no servidor)
    useEffect(() => {
        if (!room.boss || room.boss.hp <= 0) return;
        const tick = () => {
            if (room.boss && Date.now() >= room.boss.nextAttackAt) {
                audio.bossAttack();
                onBossAttacks();
            }
        };
        const id = setInterval(tick, 1500);
        return () => clearInterval(id);
    }, [room.boss?.nextAttackAt, onBossAttacks]);

    // Taunt aleatório do boss
    useEffect(() => {
        if (!room.boss || room.boss.hp <= 0) return;
        const id = setInterval(() => {
            if (Math.random() < 0.4 && room.boss) {
                const t = room.boss.def.taunts[Math.floor(Math.random() * room.boss.def.taunts.length)];
                setTaunt(t);
                setTimeout(() => setTaunt(null), 4500);
            }
        }, 12000);
        return () => clearInterval(id);
    }, [room.boss?.def?.id]);

    // Animar dano no sprite
    useEffect(() => {
        if (!room.boss?.lastDamageAt) return;
        if (Date.now() - room.boss.lastDamageAt < 1500) {
            setBossHit(true);
            const t = setTimeout(() => setBossHit(false), 600);
            return () => clearTimeout(t);
        }
    }, [room.boss?.lastDamageAt]);

    const placedBlocks = room.boss?.placedBlocks || [];

    const availableBlocks = useMemo(() => {
        if (!room.boss) return [];
        const result: { text: string; idx: number }[] = [];
        room.boss.blocks.forEach((b, i) => {
            const used = placedBlocks.filter(p => p.text === b).length;
            const total = room.boss!.blocks.filter(ob => ob === b).length;
            if (used < total) result.push({ text: b, idx: i });
        });
        return result;
    }, [room.boss, placedBlocks]);

    const handleAttack = async () => {
        if (!room.boss || attacking) return;
        setAttacking(true);
        const result = await onAttack();
        setAttacking(false);
        if (result?.killed) {
            audio.bossDefeat();
            setFeedback('success');
            setTimeout(() => setFeedback(null), 1500);
        } else {
            audio.bossHit();
            setFeedback('fail');
            setTimeout(() => setFeedback(null), 1500);
        }
    };

    const handleDragStart = (e: React.DragEvent, idx: number) => {
        setDraggedIdx(idx);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDrop = async (e: React.DragEvent, target: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === target) return;
        const next = [...placedBlocks];
        const [moved] = next.splice(draggedIdx, 1);
        next.splice(target, 0, moved);
        await onReorderBlocks(next);
        setDraggedIdx(null);
    };

    const handlePerk = async () => {
        if (perkRemain > 0 || !myCls) return;
        if (myCls.id === 'warrior') {
            audio.classPerk();
            audio.bossHit();
            await onUsePerkWarrior();
        } else {
            alert('Sua habilidade não funciona aqui no Boss.');
        }
    };

    if (generating || !room.boss) {
        return (
            <div className={`min-h-full ${THEME.bg} -m-6 p-6 flex flex-col items-center justify-center text-white`}>
                <Icon name="skull" size={64} className="text-violet-400 animate-pulse mb-4" />
                <h2 className="text-2xl font-black mb-2">O Chefe Final desperta…</h2>
                <p className="text-white/60 text-sm animate-pulse">Aguarde a batalha começar.</p>
            </div>
        );
    }

    const boss = room.boss;
    const nextAttackIn = Math.max(0, Math.ceil((boss.nextAttackAt - Date.now()) / 1000));

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-4 md:p-6 text-white relative`}>
            <div className="max-w-4xl mx-auto">
                {/* Top HUD */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                        {room.players.map(p => (
                            <PlayerHud key={p.id} player={p} isMe={p.id === currentUserId} isHost={p.id === room.hostId} />
                        ))}
                    </div>
                    <AudioToggle />
                </div>

                {/* Boss arena */}
                <div className={`${THEME.bgPanel} rounded-3xl p-4 md:p-6 mb-3 ${THEME.borderGlow} border relative overflow-hidden`}>
                    {/* Background atmosphere */}
                    <div
                        className="absolute inset-0 opacity-20 -z-10"
                        style={{
                            background: `radial-gradient(circle at 50% 30%, ${boss.def.color}88 0%, transparent 60%)`,
                        }}
                    />

                    {/* Boss header info */}
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-amber-300 font-black">Boss Final</p>
                            <h2 className="text-xl md:text-2xl font-black text-white">{boss.def.name}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-rose-300 font-bold">Próximo ataque</p>
                            <p className={`font-mono text-2xl font-black ${nextAttackIn <= 5 ? 'text-rose-400 animate-pulse' : 'text-white/80'}`}>
                                {nextAttackIn}s
                            </p>
                        </div>
                    </div>

                    {/* Sprite + HP */}
                    <div className="flex flex-col items-center my-2">
                        <BossSprite
                            boss={boss.def}
                            state={boss.state}
                            isHit={bossHit}
                            isAttacking={nextAttackIn === 0}
                            size={180}
                        />
                        {taunt && (
                            <div className="mt-1 px-3 py-1.5 bg-black/60 border border-white/20 rounded-xl text-sm italic text-white/90 max-w-md text-center animate-in fade-in zoom-in">
                                "{taunt}"
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <HPBar current={boss.hp} max={boss.maxHp} label="🐉 HP do Boss" color="boss" height="lg" />
                        <HPBar current={room.partyHP} max={room.maxPartyHP} label="❤ HP da Party" />
                    </div>
                </div>

                {/* Construção da frase */}
                <div className={`bg-black/30 rounded-2xl p-4 mb-3 border-2 transition-colors ${
                    feedback === 'success' ? 'border-emerald-400 bg-emerald-500/15' :
                    feedback === 'fail' ? 'border-rose-500 bg-rose-500/15' :
                    'border-white/15'
                }`}>
                    <p className="text-xs uppercase tracking-widest text-amber-300 font-black mb-2">Reconstruam a frase</p>
                    <div className="min-h-[80px] flex flex-wrap items-center gap-2 p-2">
                        {placedBlocks.length === 0 && (
                            <p className="w-full text-center text-white/40 italic text-sm">
                                Cliquem nos blocos abaixo para montar a frase…
                            </p>
                        )}
                        {placedBlocks.map((b, i) => {
                            const color = getPlayerColor(b.placedBy);
                            return (
                                <div
                                    key={b.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, i)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, i)}
                                    className={`group relative px-3 py-1.5 rounded-lg font-bold text-sm shadow-md cursor-move animate-in zoom-in border-2 ${draggedIdx === i ? 'opacity-50' : ''}`}
                                    style={{
                                        backgroundColor: `${color.hex}33`,
                                        borderColor: color.hex,
                                        color: 'white',
                                    }}
                                >
                                    {b.text}
                                    <button
                                        onClick={(ev) => { ev.stopPropagation(); onRemoveBlock(b.id); }}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Controles */}
                <div className="flex gap-2 items-center mb-3">
                    {myCls?.id === 'warrior' && (
                        <button
                            onClick={handlePerk}
                            disabled={perkRemain > 0}
                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 ${perkRemain > 0
                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/40 active:scale-95'
                            }`}
                            title={`Investida: -${RULES.WARRIOR_DIRECT_DAMAGE} HP do boss`}
                        >
                            <Icon name="sword" size={16} />
                            {perkRemain > 0 ? `Investida (${Math.ceil(perkRemain / 1000)}s)` : `Investida -${RULES.WARRIOR_DIRECT_DAMAGE}`}
                        </button>
                    )}

                    <button
                        onClick={handleAttack}
                        disabled={placedBlocks.length === 0 || attacking}
                        className={`flex-1 px-5 py-3 rounded-xl font-black text-base shadow-lg flex items-center justify-center gap-2 transition-all ${placedBlocks.length === 0 || attacking
                            ? 'bg-white/10 text-white/30 cursor-not-allowed'
                            : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-amber-500/30 hover:shadow-amber-500/60 active:scale-95'
                        }`}
                    >
                        <Icon name="sword" size={20} />
                        ATACAR
                    </button>
                </div>

                {/* Blocos disponíveis */}
                <div className={`${THEME.bgPanelSolid} rounded-2xl p-3 ${THEME.borderGlow} border`}>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">Blocos disponíveis</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availableBlocks.length === 0 && (
                            <p className="col-span-full text-center text-emerald-300 text-sm font-bold py-2">
                                ✓ Todos os blocos foram usados
                            </p>
                        )}
                        {availableBlocks.map(({ text, idx }) => (
                            <button
                                key={`${text}-${idx}`}
                                onClick={() => { audio.pickUp(); onAddBlock(text); }}
                                className="bg-white/10 hover:bg-amber-400/20 hover:border-amber-400 border-2 border-white/15 px-3 py-2 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
