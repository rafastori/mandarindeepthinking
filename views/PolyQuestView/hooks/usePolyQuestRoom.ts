import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../../services/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDoc,
    query,
    where,
    getDocs,
    increment,
    serverTimestamp,
    Timestamp,
    runTransaction,
} from 'firebase/firestore';
import {
    PolyQuestRoom,
    PolyQuestPlayer,
    GameConfig,
    WordEnigma,
    BossState,
    BossDef,
    PlayerClass,
    GamePhase,
} from '../types';
import { RULES, calculateBossHP, comboMultiplierFor, pickRandomBoss } from '../rules';

/**
 * usePolyQuestRoom — schema v2
 *
 * Reescrito do zero para corrigir:
 *  - Race em submitAnswer (sobrescrita de player)
 *  - Host transfer ao sair (líder some, sala morre)
 *  - activeRoom race ao criar/entrar (closure stale)
 *  - Cleanup setTimeout(unsub, 200) brittle
 *  - Intruder split CJK quebrado
 *  - Boss victory points nunca pagos
 *  - requestHelp não cancelável
 *
 * Novas mecânicas:
 *  - Combo da PARTY (acertos consecutivos com timeout)
 *  - Boss com HP, ataques temporizados, 4 sprites
 *  - Classes (mage/bard/warrior) com perks ativos
 *  - Intruder integrado (não mais comentado)
 */

export const usePolyQuestRoom = (userId?: string) => {
    const [rooms, setRooms] = useState<PolyQuestRoom[]>([]);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [activeRoom, setActiveRoomState] = useState<PolyQuestRoom | null>(null);
    const [loading, setLoading] = useState(true);
    const cleanupRanRef = useRef(false);

    // ─── Cleanup de salas antigas ────────────────────────────────
    // Faz UMA query pontual em vez de listener com setTimeout. Sem leak.
    useEffect(() => {
        if (cleanupRanRef.current) return;
        cleanupRanRef.current = true;
        (async () => {
            try {
                const cutoff24h = Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000);
                const stale = await getDocs(query(
                    collection(db, 'polyquestRooms'),
                    where('createdAt', '<', cutoff24h)
                ));
                for (const d of stale.docs) {
                    await deleteDoc(d.ref).catch(() => {});
                }
            } catch (e) {
                console.warn('[PolyQuest] cleanup error:', e);
            }
        })();
    }, []);

    // ─── Listener global de salas ────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'polyquestRooms'),
            (snapshot) => {
                const data = snapshot.docs.map(d => {
                    const raw = d.data();
                    return {
                        id: d.id,
                        ...raw,
                        createdAt: raw.createdAt?.toDate?.() || new Date(),
                        startedAt: raw.startedAt?.toDate?.(),
                        finishedAt: raw.finishedAt?.toDate?.(),
                        updatedAt: raw.updatedAt?.toDate?.(),
                    } as PolyQuestRoom;
                });
                setRooms(data);
                setLoading(false);
            },
            (error) => {
                console.error('[PolyQuest] rooms listener error:', error);
                setLoading(false);
            },
        );
        return () => unsub();
    }, []);

    // ─── Listener focado na sala ativa (low-latency) ─────────────
    useEffect(() => {
        if (!activeRoomId) {
            setActiveRoomState(null);
            return;
        }
        const unsub = onSnapshot(
            doc(db, 'polyquestRooms', activeRoomId),
            (snap) => {
                if (!snap.exists()) {
                    setActiveRoomState(null);
                    setActiveRoomId(null);
                    return;
                }
                const raw = snap.data();
                setActiveRoomState({
                    id: snap.id,
                    ...raw,
                    createdAt: raw.createdAt?.toDate?.() || new Date(),
                    startedAt: raw.startedAt?.toDate?.(),
                    finishedAt: raw.finishedAt?.toDate?.(),
                    updatedAt: raw.updatedAt?.toDate?.(),
                } as PolyQuestRoom);
            },
        );
        return () => unsub();
    }, [activeRoomId]);

    /** Define a sala ativa por ID — sem race com closure stale */
    const setActiveRoom = useCallback((roomOrId: PolyQuestRoom | string | null) => {
        if (roomOrId === null) {
            setActiveRoomId(null);
            setActiveRoomState(null);
        } else if (typeof roomOrId === 'string') {
            setActiveRoomId(roomOrId);
        } else {
            setActiveRoomId(roomOrId.id);
            setActiveRoomState(roomOrId);
        }
    }, []);

    // ─── CRUD de sala ────────────────────────────────────────────

    const createRoom = useCallback(async (
        roomName: string,
        config: GameConfig,
        player: PolyQuestPlayer,
    ): Promise<string | null> => {
        try {
            const newRoom: Omit<PolyQuestRoom, 'id' | 'createdAt'> = {
                name: roomName,
                hostId: player.id,
                players: [player],
                phase: 'lobby',
                config,
                partyHP: RULES.PARTY_INITIAL_HP,
                maxPartyHP: RULES.PARTY_MAX_HP,
                selectedWords: [],
                enigmas: [],
                combo: { count: 0, multiplier: 1.0, lastCorrectAt: 0, lastCorrectBy: '' },
                boss: null,
                intruder: null,
                intruderTriggered: false,
            };
            const docRef = await addDoc(collection(db, 'polyquestRooms'), {
                ...newRoom,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            setActiveRoomId(docRef.id);
            return docRef.id;
        } catch (e) {
            console.error('[PolyQuest] createRoom error:', e);
            return null;
        }
    }, []);

    const joinRoom = useCallback(async (roomId: string, player: PolyQuestPlayer): Promise<boolean> => {
        try {
            const ok = await runTransaction(db, async (tx) => {
                const ref = doc(db, 'polyquestRooms', roomId);
                const snap = await tx.get(ref);
                if (!snap.exists()) return false;
                const data = snap.data() as PolyQuestRoom;
                if (data.players.some(p => p.id === player.id)) return true;
                tx.update(ref, {
                    players: [...data.players, player],
                    updatedAt: Timestamp.now(),
                });
                return true;
            });
            if (ok) setActiveRoomId(roomId);
            return ok;
        } catch (e) {
            console.error('[PolyQuest] joinRoom error:', e);
            return false;
        }
    }, []);

    const leaveRoom = useCallback(async (roomId: string, playerId: string): Promise<void> => {
        try {
            await runTransaction(db, async (tx) => {
                const ref = doc(db, 'polyquestRooms', roomId);
                const snap = await tx.get(ref);
                if (!snap.exists()) return;
                const data = snap.data() as PolyQuestRoom;
                const remaining = data.players.filter(p => p.id !== playerId);
                if (remaining.length === 0) {
                    tx.delete(ref);
                    return;
                }
                // Host transfer: se quem saiu era o host, passa pra próxima pessoa
                const newHostId = data.hostId === playerId ? remaining[0].id : data.hostId;
                tx.update(ref, {
                    players: remaining,
                    hostId: newHostId,
                    updatedAt: Timestamp.now(),
                });
            });
            setActiveRoomId(null);
        } catch (e) {
            console.error('[PolyQuest] leaveRoom error:', e);
        }
    }, []);

    const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'polyquestRooms', roomId));
            setActiveRoomId(null);
        } catch (e) {
            console.error('[PolyQuest] deleteRoom error:', e);
        }
    }, []);

    // ─── Lobby ────────────────────────────────────────────────────

    const toggleReady = useCallback(async (roomId: string, playerId: string, isReady: boolean) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const players = data.players.map(p => p.id === playerId ? { ...p, isReady } : p);
            tx.update(ref, { players, updatedAt: Timestamp.now() });
        }).catch(e => console.error('[PolyQuest] toggleReady:', e));
    }, []);

    const setPlayerClass = useCallback(async (roomId: string, playerId: string, cls: PlayerClass) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const players = data.players.map(p => p.id === playerId ? { ...p, cls } : p);
            tx.update(ref, { players, updatedAt: Timestamp.now() });
        }).catch(e => console.error('[PolyQuest] setPlayerClass:', e));
    }, []);

    const updateConfig = useCallback(async (roomId: string, config: Partial<GameConfig>) => {
        try {
            const ref = doc(db, 'polyquestRooms', roomId);
            const updates: Record<string, any> = { updatedAt: Timestamp.now() };
            for (const [k, v] of Object.entries(config)) {
                updates[`config.${k}`] = v;
            }
            await updateDoc(ref, updates);
        } catch (e) {
            console.error('[PolyQuest] updateConfig:', e);
        }
    }, []);

    const startGame = useCallback(async (roomId: string) => {
        try {
            await updateDoc(doc(db, 'polyquestRooms', roomId), {
                phase: 'exploration' as GamePhase,
                startedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] startGame:', e);
        }
    }, []);

    // ─── Exploration ──────────────────────────────────────────────

    const toggleWordSelection = useCallback(async (roomId: string, word: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const sel = data.selectedWords || [];
            const next = sel.includes(word) ? sel.filter(w => w !== word) : [...sel, word];
            tx.update(ref, { selectedWords: next, updatedAt: Timestamp.now() });
        }).catch(e => console.error('[PolyQuest] toggleWord:', e));
    }, []);

    const finishExploration = useCallback(async (roomId: string) => {
        try {
            await updateDoc(doc(db, 'polyquestRooms', roomId), {
                phase: 'quest' as GamePhase,
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] finishExploration:', e);
        }
    }, []);

    // ─── Quest ────────────────────────────────────────────────────

    const setEnigmas = useCallback(async (roomId: string, enigmas: WordEnigma[]) => {
        try {
            await updateDoc(doc(db, 'polyquestRooms', roomId), {
                enigmas,
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] setEnigmas:', e);
        }
    }, []);

    const lockEnigma = useCallback(async (roomId: string, enigmaIndex: number, playerId: string): Promise<boolean> => {
        try {
            return await runTransaction(db, async (tx) => {
                const ref = doc(db, 'polyquestRooms', roomId);
                const snap = await tx.get(ref);
                if (!snap.exists()) return false;
                const data = snap.data() as PolyQuestRoom;
                const enigmas = [...data.enigmas];
                const e = enigmas[enigmaIndex];
                if (!e || e.isDiscovered) return false;
                if (e.activeSolver && e.activeSolver !== playerId) return false;
                enigmas[enigmaIndex] = { ...e, activeSolver: playerId };
                tx.update(ref, { enigmas, updatedAt: Timestamp.now() });
                return true;
            });
        } catch (e) {
            console.error('[PolyQuest] lockEnigma:', e);
            return false;
        }
    }, []);

    const unlockEnigma = useCallback(async (roomId: string, enigmaIndex: number, playerId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const enigmas = [...data.enigmas];
            const e = enigmas[enigmaIndex];
            if (e && e.activeSolver === playerId) {
                const { activeSolver, ...rest } = e;
                enigmas[enigmaIndex] = rest;
                tx.update(ref, { enigmas, updatedAt: Timestamp.now() });
            }
        }).catch(e => console.error('[PolyQuest] unlockEnigma:', e));
    }, []);

    /** Resposta do jogador. Atômica, sem race, com combo + classes. */
    const submitAnswer = useCallback(async (
        roomId: string,
        playerId: string,
        enigmaIndex: number,
        _answer: string,
        isCorrect: boolean,
    ): Promise<{ awarded: number; comboCount: number; comboMult: number; allDone: boolean } | null> => {
        try {
            return await runTransaction(db, async (tx) => {
                const ref = doc(db, 'polyquestRooms', roomId);
                const snap = await tx.get(ref);
                if (!snap.exists()) return null;
                const data = snap.data() as PolyQuestRoom;
                const enigmas = [...data.enigmas];
                const e = enigmas[enigmaIndex];
                if (!e) return null;

                const players = data.players.map(p => ({ ...p }));
                const playerIdx = players.findIndex(p => p.id === playerId);
                const player = playerIdx >= 0 ? players[playerIdx] : null;

                let awarded = 0;
                let comboCount = data.combo?.count || 0;
                let comboMult = data.combo?.multiplier || 1.0;
                let partyHP = data.partyHP;
                let phase: GamePhase = data.phase;
                let allDone = false;

                e.attempts = (e.attempts || 0) + 1;

                if (isCorrect) {
                    // Atualiza o combo da PARTY
                    const now = Date.now();
                    const lastAt = data.combo?.lastCorrectAt || 0;
                    const stillHot = lastAt > 0 && (now - lastAt) <= RULES.COMBO_TIMEOUT_MS;
                    comboCount = stillHot ? comboCount + 1 : 1;
                    comboMult = comboMultiplierFor(comboCount);

                    // Bardo buff (2x na próxima resposta correta)
                    let bardBonus = 1;
                    if (player?.bardBuffActive) {
                        bardBonus = RULES.BARD_BUFF_MULTIPLIER;
                        player.bardBuffActive = false;
                    }

                    const wasHelped = !!e.helpedBy;
                    const base = wasHelped ? RULES.HELP_RECEIVED_POINTS : RULES.CORRECT_POINTS;
                    awarded = Math.round(base * comboMult * bardBonus);

                    e.isDiscovered = true;
                    e.discoveredBy = playerId;
                    delete e.activeSolver;
                    delete e.needsHelp;

                    if (player) {
                        player.score += awarded;
                        player.consecutiveCorrect = (player.consecutiveCorrect || 0) + 1;
                        if (playerIdx >= 0) players[playerIdx] = player;
                    }

                    allDone = enigmas.every(en => en.isDiscovered);
                    if (allDone) phase = 'boss';

                    tx.update(ref, {
                        enigmas,
                        players,
                        combo: { count: comboCount, multiplier: comboMult, lastCorrectAt: now, lastCorrectBy: playerId },
                        ...(phase !== data.phase ? { phase } : {}),
                        updatedAt: Timestamp.now(),
                    });
                } else {
                    // Erro — reseta combo, bate na party
                    partyHP = Math.max(0, partyHP - RULES.WRONG_DAMAGE);
                    if (player) {
                        player.consecutiveCorrect = 0;
                        if (playerIdx >= 0) players[playerIdx] = player;
                    }
                    delete e.activeSolver;

                    if (partyHP <= 0) {
                        phase = 'defeat';
                    }

                    tx.update(ref, {
                        enigmas,
                        players,
                        partyHP,
                        combo: { count: 0, multiplier: 1.0, lastCorrectAt: 0, lastCorrectBy: '' },
                        ...(phase !== data.phase ? { phase, finishedAt: Timestamp.now() } : {}),
                        updatedAt: Timestamp.now(),
                    });
                }

                return { awarded, comboCount, comboMult, allDone };
            });
        } catch (e) {
            console.error('[PolyQuest] submitAnswer:', e);
            return null;
        }
    }, []);

    // ─── Help / SOS ───────────────────────────────────────────────

    const requestHelp = useCallback(async (roomId: string, enigmaIndex: number, playerId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const enigmas = [...data.enigmas];
            const e = enigmas[enigmaIndex];
            if (!e) return;
            // Toggle: se já é dele, cancela; senão, marca
            if (e.needsHelp && e.helpRequestedBy === playerId) {
                delete e.needsHelp;
                delete e.helpRequestedBy;
            } else {
                e.needsHelp = true;
                e.helpRequestedBy = playerId;
                delete e.activeSolver;
            }
            tx.update(ref, { enigmas, updatedAt: Timestamp.now() });
        }).catch(err => console.error('[PolyQuest] requestHelp:', err));
    }, []);

    const provideHelp = useCallback(async (roomId: string, enigmaIndex: number, helperId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const enigmas = [...data.enigmas];
            const players = data.players.map(p => ({ ...p }));
            const e = enigmas[enigmaIndex];
            if (!e || !e.needsHelp) return;
            e.needsHelp = false;
            e.helpedBy = helperId;
            e.activeSolver = e.helpRequestedBy;
            const helperIdx = players.findIndex(p => p.id === helperId);
            if (helperIdx >= 0) {
                players[helperIdx].score += RULES.HELP_GIVEN_POINTS;
                players[helperIdx].helpCount = (players[helperIdx].helpCount || 0) + 1;
            }
            tx.update(ref, { enigmas, players, updatedAt: Timestamp.now() });
        }).catch(err => console.error('[PolyQuest] provideHelp:', err));
    }, []);

    // ─── Class Perks ──────────────────────────────────────────────

    /** Mago: revela inicial da resposta correta */
    const usePerkMage = useCallback(async (roomId: string, enigmaIndex: number, playerId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const players = data.players.map(p => ({ ...p }));
            const idx = players.findIndex(p => p.id === playerId);
            const enigmas = [...data.enigmas];
            const e = enigmas[enigmaIndex];
            if (!e || idx < 0) return;
            const now = Date.now();
            const last = players[idx].perkUsedAt || 0;
            const cd = 45_000;
            if (now - last < cd) return;
            players[idx].perkUsedAt = now;
            e.revealedInitial = true;
            tx.update(ref, { enigmas, players, updatedAt: Timestamp.now() });
        }).catch(err => console.error('[PolyQuest] perkMage:', err));
    }, []);

    /** Bardo: próximo acerto da party vale 2x */
    const usePerkBard = useCallback(async (roomId: string, playerId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            const players = data.players.map(p => ({ ...p }));
            const idx = players.findIndex(p => p.id === playerId);
            if (idx < 0) return;
            const now = Date.now();
            const last = players[idx].perkUsedAt || 0;
            const cd = 60_000;
            if (now - last < cd) return;
            players[idx].perkUsedAt = now;
            // Aplica buff em TODOS (qualquer um da party que acertar próximo ganha 2x)
            players.forEach(p => { p.bardBuffActive = true; });
            tx.update(ref, { players, updatedAt: Timestamp.now() });
        }).catch(err => console.error('[PolyQuest] perkBard:', err));
    }, []);

    /** Guerreiro: causa 25 de dano direto ao boss */
    const usePerkWarrior = useCallback(async (roomId: string, playerId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.boss || data.phase !== 'boss') return;
            const players = data.players.map(p => ({ ...p }));
            const idx = players.findIndex(p => p.id === playerId);
            if (idx < 0) return;
            const now = Date.now();
            const last = players[idx].perkUsedAt || 0;
            const cd = 35_000;
            if (now - last < cd) return;
            players[idx].perkUsedAt = now;
            const boss = { ...data.boss };
            boss.hp = Math.max(0, boss.hp - RULES.WARRIOR_DIRECT_DAMAGE);
            boss.lastDamageAt = now;
            if (boss.hp <= 0) boss.state = 'dead';
            else if (boss.hp < boss.maxHp * 0.4) boss.state = 'wounded';
            const update: any = { players, boss, updatedAt: Timestamp.now() };
            if (boss.hp <= 0) {
                update.phase = 'victory';
                update.finishedAt = Timestamp.now();
                // Recompensa por matar o boss
                players.forEach(p => { p.score += RULES.BOSS_VICTORY_POINTS; });
                update.players = players;
            }
            tx.update(ref, update);
        }).catch(err => console.error('[PolyQuest] perkWarrior:', err));
    }, []);

    // ─── Intruder ─────────────────────────────────────────────────

    /** Inicia o desafio do intruso (chamado pelo QuestPhase quando bate 50% e ainda não disparou) */
    const startIntruder = useCallback(async (
        roomId: string,
        fakeWord: string,
        insertedAt: number,
    ) => {
        try {
            await updateDoc(doc(db, 'polyquestRooms', roomId), {
                phase: 'intruder' as GamePhase,
                intruderTriggered: true,
                intruder: {
                    fakeWord,
                    insertedAtIndex: insertedAt,
                    startedAt: Date.now(),
                    timeoutMs: RULES.INTRUDER_TIMEOUT_MS,
                    resolved: false,
                },
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] startIntruder:', e);
        }
    }, []);

    const resolveIntruder = useCallback(async (roomId: string, playerId: string, selectedWord: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.intruder || data.intruder.resolved) return;
            const players = data.players.map(p => ({ ...p }));
            const idx = players.findIndex(p => p.id === playerId);
            const success = selectedWord.toLowerCase() === data.intruder.fakeWord.toLowerCase();
            let partyHP = data.partyHP;
            if (success && idx >= 0) {
                players[idx].score += RULES.INTRUDER_POINTS;
                partyHP = Math.min(data.maxPartyHP, partyHP + RULES.INTRUDER_HEAL);
            } else if (!success) {
                partyHP = Math.max(0, partyHP - RULES.INTRUDER_FAIL_DAMAGE);
            }
            const intruder = { ...data.intruder, resolved: true, resolvedBy: playerId, success };
            const update: any = {
                intruder,
                players,
                partyHP,
                phase: 'quest' as GamePhase,
                updatedAt: Timestamp.now(),
            };
            if (partyHP <= 0) {
                update.phase = 'defeat';
                update.finishedAt = Timestamp.now();
            }
            tx.update(ref, update);
        }).catch(e => console.error('[PolyQuest] resolveIntruder:', e));
    }, []);

    /** Timeout do intruso (não respondido em N segundos) — penaliza levemente e volta */
    const timeoutIntruder = useCallback(async (roomId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.intruder || data.intruder.resolved) return;
            const partyHP = Math.max(0, data.partyHP - RULES.INTRUDER_FAIL_DAMAGE);
            const intruder = { ...data.intruder, resolved: true, success: false };
            const update: any = {
                intruder,
                partyHP,
                phase: 'quest' as GamePhase,
                updatedAt: Timestamp.now(),
            };
            if (partyHP <= 0) {
                update.phase = 'defeat';
                update.finishedAt = Timestamp.now();
            }
            tx.update(ref, update);
        }).catch(e => console.error('[PolyQuest] timeoutIntruder:', e));
    }, []);

    // ─── Boss ─────────────────────────────────────────────────────

    const startBoss = useCallback(async (
        roomId: string,
        targetSentence: string,
        blocks: string[],
        bossDef?: BossDef,
    ) => {
        try {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (data.boss) return; // Já iniciado
            const def = bossDef || pickRandomBoss();
            const bossHP = calculateBossHP(data.players.length);
            const boss: BossState = {
                def,
                hp: bossHP,
                maxHp: bossHP,
                targetSentence,
                blocks,
                placedBlocks: [],
                nextAttackAt: Date.now() + RULES.BOSS_ATTACK_INTERVAL_MS,
                attackPower: RULES.BOSS_ATTACK_DAMAGE,
                attackIntervalMs: RULES.BOSS_ATTACK_INTERVAL_MS,
                attemptCount: 0,
                state: 'idle',
            };
            await updateDoc(ref, {
                boss,
                phase: 'boss' as GamePhase,
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] startBoss:', e);
        }
    }, []);

    const addBossBlock = useCallback(async (roomId: string, text: string, placedBy: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.boss) return;
            const placed = [...data.boss.placedBlocks, {
                id: crypto.randomUUID(),
                text,
                placedBy,
                placedAt: Date.now(),
            }];
            tx.update(ref, { 'boss.placedBlocks': placed, updatedAt: Timestamp.now() });
        }).catch(e => console.error('[PolyQuest] addBossBlock:', e));
    }, []);

    const removeBossBlock = useCallback(async (roomId: string, blockId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.boss) return;
            const placed = data.boss.placedBlocks.filter(b => b.id !== blockId);
            tx.update(ref, { 'boss.placedBlocks': placed, updatedAt: Timestamp.now() });
        }).catch(e => console.error('[PolyQuest] removeBossBlock:', e));
    }, []);

    const reorderBossBlocks = useCallback(async (roomId: string, newOrder: any[]) => {
        try {
            await updateDoc(doc(db, 'polyquestRooms', roomId), {
                'boss.placedBlocks': newOrder,
                updatedAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[PolyQuest] reorderBossBlocks:', e);
        }
    }, []);

    /** Tentativa de atacar o boss (verificar frase) */
    const attackBoss = useCallback(async (roomId: string): Promise<{ damage: number; killed: boolean } | null> => {
        try {
            return await runTransaction(db, async (tx) => {
                const ref = doc(db, 'polyquestRooms', roomId);
                const snap = await tx.get(ref);
                if (!snap.exists()) return null;
                const data = snap.data() as PolyQuestRoom;
                if (!data.boss) return null;
                const boss = { ...data.boss };

                // Normaliza pra comparar (strip pontuação + lowercase)
                const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
                const constructed = norm(boss.placedBlocks.map(b => b.text).join(''));
                const target = norm(boss.targetSentence);

                boss.attemptCount += 1;
                let damage = 0;
                let killed = false;

                if (constructed === target) {
                    // Acerto perfeito = mata o boss
                    damage = boss.hp;
                    boss.hp = 0;
                    boss.state = 'dead';
                    boss.lastDamageAt = Date.now();
                    killed = true;
                } else {
                    // Calcula similaridade simples por tokens corretos na ordem
                    let correctTokens = 0;
                    const targetTokens = target.split('');
                    const builtTokens = constructed.split('');
                    const len = Math.min(targetTokens.length, builtTokens.length);
                    for (let i = 0; i < len; i++) {
                        if (targetTokens[i] === builtTokens[i]) correctTokens++;
                    }
                    const similarity = targetTokens.length > 0 ? correctTokens / targetTokens.length : 0;
                    // Erro: causa pequeno dano ao boss proporcional + pega dano de volta
                    damage = Math.round(15 * similarity);
                    boss.hp = Math.max(0, boss.hp - damage);
                    boss.lastDamageAt = Date.now();
                    if (boss.hp <= 0) { boss.state = 'dead'; killed = true; }
                    else if (boss.hp < boss.maxHp * 0.4) boss.state = 'wounded';
                }

                const update: any = { boss, updatedAt: Timestamp.now() };
                let players = data.players;
                let partyHP = data.partyHP;
                let phase: GamePhase = data.phase;

                if (killed) {
                    players = players.map(p => ({ ...p, score: p.score + RULES.BOSS_VICTORY_POINTS }));
                    update.players = players;
                    phase = 'victory';
                    update.phase = phase;
                    update.finishedAt = Timestamp.now();
                } else {
                    partyHP = Math.max(0, partyHP - RULES.BOSS_FAIL_DAMAGE);
                    update.partyHP = partyHP;
                    if (partyHP <= 0) {
                        phase = 'defeat';
                        update.phase = phase;
                        update.finishedAt = Timestamp.now();
                    }
                }

                tx.update(ref, update);
                return { damage, killed };
            });
        } catch (e) {
            console.error('[PolyQuest] attackBoss:', e);
            return null;
        }
    }, []);

    /** Boss ataca a party (chamado pelo cliente "host" via timer) */
    const bossAttacks = useCallback(async (roomId: string) => {
        await runTransaction(db, async (tx) => {
            const ref = doc(db, 'polyquestRooms', roomId);
            const snap = await tx.get(ref);
            if (!snap.exists()) return;
            const data = snap.data() as PolyQuestRoom;
            if (!data.boss || data.boss.hp <= 0) return;
            if (data.phase !== 'boss') return;
            const now = Date.now();
            if (now < data.boss.nextAttackAt) return;

            const partyHP = Math.max(0, data.partyHP - data.boss.attackPower);
            const boss = { ...data.boss, nextAttackAt: now + data.boss.attackIntervalMs };
            const update: any = { boss, partyHP, updatedAt: Timestamp.now() };
            if (partyHP <= 0) {
                update.phase = 'defeat';
                update.finishedAt = Timestamp.now();
            }
            tx.update(ref, update);
        }).catch(e => console.error('[PolyQuest] bossAttacks:', e));
    }, []);

    // ─── Persistência de histórico ────────────────────────────────

    const savePlayerHistory = useCallback(async (roomId: string, uid: string, result: any) => {
        try {
            const historyRef = collection(db, 'users', uid, 'gameHistory');
            await addDoc(historyRef, {
                roomId,
                ...result,
                playedAt: serverTimestamp(),
            });
            await setDoc(doc(db, 'users', uid), {
                totalScore: increment(result.score || 0),
                gamesPlayed: increment(1),
                lastPlayedAt: serverTimestamp(),
            }, { merge: true });
        } catch (e) {
            console.error('[PolyQuest] savePlayerHistory:', e);
        }
    }, []);

    return {
        rooms,
        activeRoom,
        loading,
        setActiveRoom,
        createRoom,
        joinRoom,
        leaveRoom,
        deleteRoom,
        toggleReady,
        setPlayerClass,
        updateConfig,
        startGame,
        toggleWordSelection,
        finishExploration,
        setEnigmas,
        lockEnigma,
        unlockEnigma,
        submitAnswer,
        requestHelp,
        provideHelp,
        usePerkMage,
        usePerkBard,
        usePerkWarrior,
        startIntruder,
        resolveIntruder,
        timeoutIntruder,
        startBoss,
        addBossBlock,
        removeBossBlock,
        reorderBossBlocks,
        attackBoss,
        bossAttacks,
        savePlayerHistory,
    };
};
