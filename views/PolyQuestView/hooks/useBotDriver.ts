import { useEffect, useRef } from 'react';
import { PolyQuestRoom, BOT_LEVEL_CONFIG } from '../types';

interface BotDriverApi {
    lockEnigma: (roomId: string, idx: number, playerId: string) => Promise<boolean>;
    unlockEnigma: (roomId: string, idx: number, playerId: string) => Promise<void>;
    submitAnswer: (roomId: string, playerId: string, idx: number, ans: string, ok: boolean) => Promise<any>;
    addBossBlock: (roomId: string, text: string, placedBy: string) => Promise<void>;
    attackBoss: (roomId: string) => Promise<{ damage: number; killed: boolean } | null>;
    resolveIntruder: (roomId: string, playerId: string, word: string) => Promise<void>;
    toggleWordSelection: (roomId: string, word: string) => Promise<void>;
    finishExploration: (roomId: string) => Promise<void>;
}

/**
 * useBotDriver — roda APENAS no host. Faz os bots agirem em ciclos.
 * Cada bot pega no máximo uma carta por vez. Probabilidade de acerto e delay
 * dependem do BotLevel (easy/medium/hard).
 */
export function useBotDriver(room: PolyQuestRoom | null, isHost: boolean, currentUserId: string, api: BotDriverApi) {
    // Estado por bot pra evitar duplas-ações enquanto está pensando
    const busyRef = useRef<Set<string>>(new Set());
    const explorationDoneRef = useRef(false);

    useEffect(() => {
        if (!room || !isHost) return;
        const bots = room.players.filter(p => p.isBot);
        if (bots.length === 0) return;

        let alive = true;

        const tick = async () => {
            if (!alive || !room) return;

            // ─── EXPLORATION: bots selecionam algumas palavras de tempos em tempos ───
            if (room.phase === 'exploration' && !explorationDoneRef.current) {
                // Cada bot pega 1 palavra por tick, até a sala ter umas 6-12 selecionadas
                const target = Math.min(12, Math.max(6, (room.config.tokens?.length || 0) / 6));
                if (room.selectedWords.length < target) {
                    const tokens = (room.config.tokens || []).filter(t => {
                        const trimmed = t.trim();
                        return trimmed.length > 1
                            && !/^[\s.,!?;:()。，！？；：、]+$/.test(trimmed)
                            && /[\p{L}\p{N}]/u.test(trimmed)
                            && !room.selectedWords.includes(trimmed);
                    });
                    if (tokens.length > 0) {
                        const idle = bots.find(b => !busyRef.current.has(b.id));
                        if (idle) {
                            busyRef.current.add(idle.id);
                            const word = tokens[Math.floor(Math.random() * tokens.length)].trim();
                            try { await api.toggleWordSelection(room.id, word); } catch {}
                            setTimeout(() => busyRef.current.delete(idle.id), 1500);
                        }
                    }
                }
                return;
            }

            // ─── QUEST ───
            if (room.phase === 'quest') {
                for (const bot of bots) {
                    if (busyRef.current.has(bot.id)) continue;
                    // Procura uma carta livre
                    const idx = room.enigmas.findIndex(e =>
                        !e.isDiscovered && !e.activeSolver && !e.needsHelp
                    );
                    if (idx === -1) continue;

                    busyRef.current.add(bot.id);
                    try {
                        const locked = await api.lockEnigma(room.id, idx, bot.id);
                        if (!locked) {
                            busyRef.current.delete(bot.id);
                            continue;
                        }
                        const cfg = BOT_LEVEL_CONFIG[bot.botLevel || 'medium'];
                        const delay = cfg.minDelayMs + Math.random() * (cfg.maxDelayMs - cfg.minDelayMs);
                        setTimeout(async () => {
                            if (!alive) { busyRef.current.delete(bot.id); return; }
                            const enigma = room.enigmas[idx];
                            if (!enigma || enigma.isDiscovered) { busyRef.current.delete(bot.id); return; }
                            const willGetRight = Math.random() < cfg.accuracy;
                            const answer = willGetRight ? enigma.translation : (enigma.alternatives[0] || enigma.translation);
                            try {
                                await api.unlockEnigma(room.id, idx, bot.id);
                                await api.submitAnswer(room.id, bot.id, idx, answer, willGetRight);
                            } catch {}
                            busyRef.current.delete(bot.id);
                        }, delay);
                    } catch {
                        busyRef.current.delete(bot.id);
                    }
                    // Um bot por tick pra distribuir as ações
                    return;
                }
                return;
            }

            // ─── BOSS: bots ajudam montando blocos (na ordem correta) ───
            if (room.phase === 'boss' && room.boss) {
                const placed = room.boss.placedBlocks;
                const expected = room.boss.blocks;
                const placedCorrectSoFar = placed.length <= expected.length
                    && placed.every((b, i) => b.text === expected[i]);
                // Bots adicionam o próximo bloco correto se a sequência atual está certa
                if (placedCorrectSoFar && placed.length < expected.length) {
                    const nextWord = expected[placed.length];
                    const idle = bots.find(b => !busyRef.current.has(b.id));
                    if (idle) {
                        busyRef.current.add(idle.id);
                        const cfg = BOT_LEVEL_CONFIG[idle.botLevel || 'medium'];
                        // Acurácia também afeta boss: às vezes coloca um bloco errado
                        const willGetRight = Math.random() < cfg.accuracy;
                        const blockToPlace = willGetRight
                            ? nextWord
                            : expected[Math.floor(Math.random() * expected.length)];
                        setTimeout(async () => {
                            if (!alive) { busyRef.current.delete(idle.id); return; }
                            try { await api.addBossBlock(room.id, blockToPlace, idle.id); } catch {}
                            busyRef.current.delete(idle.id);
                        }, 2000 + Math.random() * 3000);
                    }
                }
                return;
            }

            // ─── INTRUDER: bots têm chance de denunciar ───
            if (room.phase === 'intruder' && room.intruder && !room.intruder.resolved) {
                const cfg = BOT_LEVEL_CONFIG[bots[0].botLevel || 'medium'];
                if (Math.random() < cfg.accuracy * 0.3) { // chance pequena por tick
                    const luckyBot = bots[Math.floor(Math.random() * bots.length)];
                    if (!busyRef.current.has(luckyBot.id)) {
                        busyRef.current.add(luckyBot.id);
                        setTimeout(async () => {
                            try { await api.resolveIntruder(room.id, luckyBot.id, room.intruder!.fakeWord); } catch {}
                            busyRef.current.delete(luckyBot.id);
                        }, 2000 + Math.random() * 4000);
                    }
                }
                return;
            }
        };

        const id = setInterval(tick, 1500);
        return () => { alive = false; clearInterval(id); };
    }, [room?.phase, room?.enigmas, room?.selectedWords, room?.boss?.placedBlocks?.length, room?.intruder?.resolved, isHost]);
}
