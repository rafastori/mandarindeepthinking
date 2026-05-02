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
 *
 * Versão robusta:
 *  - Usa refs para `room` e `api` — sem closure stale entre re-renders
 *  - Cleanup nunca aborta callbacks pendentes; eles sempre limpam o busyRef
 *    e destravam a carta para evitar locks fantasmas
 *  - Effect com deps mínimas (só `isHost`) — não re-monta a cada snapshot
 */
export function useBotDriver(
    room: PolyQuestRoom | null,
    isHost: boolean,
    currentUserId: string,
    api: BotDriverApi,
) {
    const roomRef = useRef(room);
    const apiRef = useRef(api);
    const busyRef = useRef<Set<string>>(new Set());
    const pendingTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    // Manter refs atualizados
    useEffect(() => { roomRef.current = room; }, [room]);
    useEffect(() => { apiRef.current = api; }, [api]);

    useEffect(() => {
        if (!isHost) return;

        const tick = async () => {
            const r = roomRef.current;
            const a = apiRef.current;
            if (!r) return;
            const bots = r.players.filter(p => p.isBot);
            if (bots.length === 0) return;

            // ─── EXPLORATION ───
            if (r.phase === 'exploration') {
                const target = Math.min(12, Math.max(6, (r.config.tokens?.length || 0) / 6));
                if (r.selectedWords.length < target) {
                    const tokens = (r.config.tokens || []).filter(t => {
                        const trimmed = t.trim();
                        return trimmed.length > 1
                            && !/^[\s.,!?;:()。，！？；：、]+$/.test(trimmed)
                            && /[\p{L}\p{N}]/u.test(trimmed)
                            && !r.selectedWords.includes(trimmed);
                    });
                    if (tokens.length > 0) {
                        const idle = bots.find(b => !busyRef.current.has(b.id));
                        if (idle) {
                            busyRef.current.add(idle.id);
                            const word = tokens[Math.floor(Math.random() * tokens.length)].trim();
                            try { await a.toggleWordSelection(r.id, word); } catch {}
                            const t = setTimeout(() => {
                                busyRef.current.delete(idle.id);
                                pendingTimers.current.delete(t);
                            }, 1500);
                            pendingTimers.current.add(t);
                        }
                    }
                }
                return;
            }

            // ─── QUEST ───
            if (r.phase === 'quest') {
                for (const bot of bots) {
                    if (busyRef.current.has(bot.id)) continue;
                    const idx = r.enigmas.findIndex(e =>
                        !e.isDiscovered && !e.activeSolver && !e.needsHelp
                    );
                    if (idx === -1) continue;

                    busyRef.current.add(bot.id);
                    const cfg = BOT_LEVEL_CONFIG[bot.botLevel || 'medium'];
                    const delay = cfg.minDelayMs + Math.random() * (cfg.maxDelayMs - cfg.minDelayMs);

                    let locked = false;
                    try {
                        locked = await a.lockEnigma(r.id, idx, bot.id);
                    } catch {
                        busyRef.current.delete(bot.id);
                        return;
                    }
                    if (!locked) {
                        busyRef.current.delete(bot.id);
                        return;
                    }

                    const t = setTimeout(async () => {
                        pendingTimers.current.delete(t);
                        // SEMPRE limpa busyRef no fim, sem early-return
                        try {
                            const cur = roomRef.current;
                            const apiCur = apiRef.current;
                            if (!cur || !apiCur) return;
                            const enigma = cur.enigmas[idx];
                            if (!enigma || enigma.isDiscovered) {
                                // Já resolvido por outro — destrava se ainda for nosso
                                if (enigma?.activeSolver === bot.id) {
                                    try { await apiCur.unlockEnigma(cur.id, idx, bot.id); } catch {}
                                }
                                return;
                            }
                            const willGetRight = Math.random() < cfg.accuracy;
                            const answer = willGetRight ? enigma.translation : (enigma.alternatives[0] || enigma.translation);
                            try { await apiCur.unlockEnigma(cur.id, idx, bot.id); } catch {}
                            try { await apiCur.submitAnswer(cur.id, bot.id, idx, answer, willGetRight); } catch {}
                        } finally {
                            busyRef.current.delete(bot.id);
                        }
                    }, delay);
                    pendingTimers.current.add(t);
                    return; // Um bot por tick
                }
                return;
            }

            // ─── BOSS ───
            if (r.phase === 'boss' && r.boss) {
                const placed = r.boss.placedBlocks;
                const expected = r.boss.blocks;
                const placedCorrectSoFar = placed.length <= expected.length
                    && placed.every((b, i) => b.text === expected[i]);
                if (placedCorrectSoFar && placed.length < expected.length) {
                    const nextWord = expected[placed.length];
                    const idle = bots.find(b => !busyRef.current.has(b.id));
                    if (idle) {
                        busyRef.current.add(idle.id);
                        const cfg = BOT_LEVEL_CONFIG[idle.botLevel || 'medium'];
                        const willGetRight = Math.random() < cfg.accuracy;
                        const blockToPlace = willGetRight
                            ? nextWord
                            : expected[Math.floor(Math.random() * expected.length)];
                        const t = setTimeout(async () => {
                            pendingTimers.current.delete(t);
                            try {
                                const cur = roomRef.current;
                                const apiCur = apiRef.current;
                                if (!cur || !apiCur) return;
                                try { await apiCur.addBossBlock(cur.id, blockToPlace, idle.id); } catch {}
                            } finally {
                                busyRef.current.delete(idle.id);
                            }
                        }, 2000 + Math.random() * 3000);
                        pendingTimers.current.add(t);
                    }
                }
                return;
            }

            // ─── INTRUDER ───
            if (r.phase === 'intruder' && r.intruder && !r.intruder.resolved) {
                const cfg = BOT_LEVEL_CONFIG[bots[0].botLevel || 'medium'];
                if (Math.random() < cfg.accuracy * 0.3) {
                    const luckyBot = bots[Math.floor(Math.random() * bots.length)];
                    if (!busyRef.current.has(luckyBot.id)) {
                        busyRef.current.add(luckyBot.id);
                        const t = setTimeout(async () => {
                            pendingTimers.current.delete(t);
                            try {
                                const cur = roomRef.current;
                                const apiCur = apiRef.current;
                                if (!cur || !apiCur || !cur.intruder) return;
                                try { await apiCur.resolveIntruder(cur.id, luckyBot.id, cur.intruder.fakeWord); } catch {}
                            } finally {
                                busyRef.current.delete(luckyBot.id);
                            }
                        }, 2000 + Math.random() * 4000);
                        pendingTimers.current.add(t);
                    }
                }
                return;
            }
        };

        const interval = setInterval(tick, 1500);

        return () => {
            clearInterval(interval);
            // Cancela timers pendentes (e tenta destravar cartas dos bots)
            for (const t of pendingTimers.current) clearTimeout(t);
            pendingTimers.current.clear();

            const r = roomRef.current;
            const a = apiRef.current;
            if (r && a) {
                // Destrava cartas que ainda estejam com bots travando
                for (const bot of r.players.filter(p => p.isBot)) {
                    const heldIdx = r.enigmas.findIndex(e => e.activeSolver === bot.id && !e.isDiscovered);
                    if (heldIdx >= 0) {
                        a.unlockEnigma(r.id, heldIdx, bot.id).catch(() => {});
                    }
                }
            }
            busyRef.current.clear();
        };
    }, [isHost]);
}
