import { useState, useEffect } from 'react';
import { db } from '../../../services/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    arrayUnion,
    arrayRemove,
    Timestamp
} from 'firebase/firestore';
import { PolyQuestRoom, PolyQuestPlayer, GameConfig, GAME_CONSTANTS } from '../types';

/**
 * Hook para gerenciar salas do PolyQuest
 * Similar ao sistema de salas do LingoArena
 */
export const usePolyQuestRoom = (userId?: string) => {
    const [rooms, setRooms] = useState<PolyQuestRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<PolyQuestRoom | null>(null);
    const [loading, setLoading] = useState(true);

    // Listener para todas as salas
    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'polyquestRooms'),
            (snapshot) => {
                const roomsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate() || new Date(),
                        startedAt: data.startedAt?.toDate(),
                        finishedAt: data.finishedAt?.toDate(),
                    } as PolyQuestRoom;
                });
                setRooms(roomsData);
                setLoading(false);

                // Atualizar sala ativa se estiver nela
                if (activeRoom) {
                    const updated = roomsData.find(r => r.id === activeRoom.id);
                    if (updated) {
                        setActiveRoom(updated);
                    } else {
                        setActiveRoom(null); // Sala foi deletada
                    }
                }
            },
            (error) => {
                console.error('Error listening to rooms:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [activeRoom?.id]);

    /**
     * Criar nova sala
     */
    const createRoom = async (
        roomName: string,
        config: GameConfig,
        player: PolyQuestPlayer
    ): Promise<string | null> => {
        try {
            const newRoom: Omit<PolyQuestRoom, 'id'> = {
                name: roomName,
                hostId: player.id,
                players: [player],
                phase: 'lobby',
                config,
                confidence: GAME_CONSTANTS.INITIAL_CONFIDENCE,
                selectedWords: [],
                enigmas: [],
                currentEnigmaIndex: 0,
                comboMultiplier: 1.0,
                createdAt: new Date(),
            };

            const docRef = await addDoc(collection(db, 'polyquestRooms'), {
                ...newRoom,
                createdAt: Timestamp.now(),
            });

            return docRef.id;
        } catch (error) {
            console.error('Error creating room:', error);
            return null;
        }
    };

    /**
     * Entrar em sala existente
     */
    const joinRoom = async (roomId: string, player: PolyQuestPlayer): Promise<boolean> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                console.error('Room not found');
                return false;
            }

            const roomData = roomSnap.data() as PolyQuestRoom;

            // Verificar se já está na sala
            if (roomData.players.some(p => p.id === player.id)) {
                return true; // Já está na sala
            }

            // Adicionar jogador
            await updateDoc(roomRef, {
                players: arrayUnion(player)
            });

            return true;
        } catch (error) {
            console.error('Error joining room:', error);
            return false;
        }
    };

    /**
     * Sair da sala
     */
    const leaveRoom = async (roomId: string, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const updatedPlayers = roomData.players.filter(p => p.id !== playerId);

            if (updatedPlayers.length === 0) {
                // Última pessoa saiu, deletar sala
                await deleteDoc(roomRef);
            } else {
                // Atualizar lista de jogadores
                await updateDoc(roomRef, {
                    players: updatedPlayers
                });
            }

            setActiveRoom(null);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    };

    /**
     * Deletar sala (apenas host)
     */
    const deleteRoom = async (roomId: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'polyquestRooms', roomId));
            setActiveRoom(null);
        } catch (error) {
            console.error('Error deleting room:', error);
        }
    };

    /**
     * Atualizar estado de "pronto" do jogador
     */
    const toggleReady = async (roomId: string, playerId: string, isReady: boolean): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const updatedPlayers = roomData.players.map(p =>
                p.id === playerId ? { ...p, isReady } : p
            );

            await updateDoc(roomRef, {
                players: updatedPlayers
            });
        } catch (error) {
            console.error('Error toggling ready:', error);
        }
    };

    /**
     * Atualizar configuração da sala (apenas host)
     */
    const updateConfig = async (roomId: string, config: Partial<GameConfig>): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, {
                config
            });
        } catch (error) {
            console.error('Error updating config:', error);
        }
    };

    /**
     * Iniciar jogo (transição para fase de exploração)
     */
    const startGame = async (roomId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, {
                phase: 'exploration',
                startedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error starting game:', error);
        }
    };

    /**
     * Atualizar fase do jogo
     */
    const updatePhase = async (roomId: string, phase: PolyQuestRoom['phase']): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, { phase });
        } catch (error) {
            console.error('Error updating phase:', error);
        }
    };

    /**
     * Atualizar confiança (barra de vida)
     */
    const updateConfidence = async (roomId: string, delta: number): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const newConfidence = Math.max(0, Math.min(100, roomData.confidence + delta));

            await updateDoc(roomRef, {
                confidence: newConfidence
            });

            // Se confiança chegou a 0, game over
            if (newConfidence <= 0) {
                await updateDoc(roomRef, {
                    phase: 'finished',
                    finishedAt: Timestamp.now()
                });
            }
        } catch (error) {
            console.error('Error updating confidence:', error);
        }
    };

    /**
     * Alternar seleção de palavra na fase de exploração
     */
    const toggleWordSelection = async (roomId: string, word: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const selectedWords = roomData.selectedWords || [];

            let newSelectedWords;
            if (selectedWords.includes(word)) {
                newSelectedWords = selectedWords.filter(w => w !== word);
            } else {
                newSelectedWords = [...selectedWords, word];
            }

            await updateDoc(roomRef, {
                selectedWords: newSelectedWords
            });
        } catch (error) {
            console.error('Error toggling word selection:', error);
        }
    };

    const finishExploration = async (roomId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, {
                phase: 'quest',
                currentEnigmaIndex: 0
            });
        } catch (error) {
            console.error('Error finishing exploration:', error);
        }
    };

    /**
     * Salvar enigmas gerados
     */
    const setEnigmas = async (roomId: string, enigmas: any[]): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, { enigmas });
        } catch (error) {
            console.error('Error setting enigmas:', error);
        }
    };

    /**
     * Submeter resposta para um enigma
     */
    const submitAnswer = async (roomId: string, playerId: string, enigmaIndex: number, answer: string, isCorrect: boolean): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const enigmas = [...roomData.enigmas];

            if (!enigmas[enigmaIndex]) return;
            const enigma = enigmas[enigmaIndex];

            const players = [...roomData.players];
            const playerIndex = players.findIndex(p => p.id === playerId);
            if (playerIndex >= 0) {
                const player = players[playerIndex];

                if (isCorrect) {
                    // Calculate points status
                    const wasHelped = !!enigmas[enigmaIndex].helpedBy;
                    const points = wasHelped ? GAME_CONSTANTS.HELP_RECEIVED_POINTS : GAME_CONSTANTS.CORRECT_POINTS;

                    // Update player stats
                    if (playerIndex !== -1) {
                        players[playerIndex].score += points;
                        players[playerIndex].consecutiveCorrect += 1;

                        // Fatigue logic (simplified/removed for grid, but keeping stats)
                        if (players[playerIndex].consecutiveCorrect >= GAME_CONSTANTS.FATIGUE_THRESHOLD) {
                            players[playerIndex].isFatigued = true;
                            players[playerIndex].fatigueEndsAt = Date.now() + GAME_CONSTANTS.FATIGUE_DURATION;
                        }

                        // Add game action
                        // (Optional)
                    }
                    players[playerIndex] = player;
                } else {
                    player.consecutiveCorrect = 0;
                }
                players[playerIndex] = player;
            }

            enigma.attempts = (enigma.attempts || 0) + 1;

            if (isCorrect) {
                enigma.isDiscovered = true;
                enigma.discoveredBy = playerId;

                const discoveredCount = enigmas.filter(e => e.isDiscovered).length + 1; // +1 pois este acabou de ser descoberto
                const totalEnigmas = enigmas.length;
                const progressPercent = discoveredCount / totalEnigmas;

                // TRIGGER INTRUDER: Se chegou em 50% E ainda não teve intruso
                if (progressPercent >= GAME_CONSTANTS.INTRUDER_TRIGGER_PERCENT && !roomData.intruderFound && roomData.intruderWord) {
                    // Nota: A palavra intrusa precisa ser gerada antes ou agora. 
                    // Simplificação: Se já temos uma definida (ex: no setup), usamos. 
                    // Se não, o componente QuestPhase deve chamar a geração e depois o trigger.
                    // Vamos deixar o QuestPhase lidar com o trigger para poder chamar a AI.
                }

                await updateDoc(roomRef, {
                    players,
                    enigmas,
                    currentEnigmaIndex: Math.min(roomData.currentEnigmaIndex + 1, enigmas.length),
                    lastCorrectBy: playerId
                });

                // Check for Boss Phase (All enigmas found)
                const allDiscovered = enigmas.every(e => e.isDiscovered);
                if (allDiscovered) {
                    await updateDoc(roomRef, {
                        phase: 'boss',
                        // Boss generation will happen in UI component, or we can trigger it here if we had the text.
                        // Ideally, QuestPhase detects "All solved" and calls startBossPhase similar to Intruder.
                    });
                }
            } else {
                const newConfidence = Math.max(0, roomData.confidence - GAME_CONSTANTS.ERROR_PENALTY);
                if (newConfidence <= 0) {
                    await updateDoc(roomRef, {
                        confidence: newConfidence,
                        players,
                        enigmas,
                        phase: 'finished',
                        finishedAt: Timestamp.now()
                    });
                } else {
                    await updateDoc(roomRef, {
                        confidence: newConfidence,
                        players,
                        enigmas
                    });
                }
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
        }
    };

    const triggerIntruder = async (roomId: string, intruderWord: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, {
                phase: 'intruder',
                intruderWord,
                intruderFound: false,
                intruderFoundBy: null
            });
        } catch (error) {
            console.error('Error triggering intruder:', error);
        }
    };

    const resolveIntruder = async (roomId: string, playerId: string, selectedWord: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;
            const roomData = roomSnap.data() as PolyQuestRoom;

            if (selectedWord.toLowerCase() === roomData.intruderWord?.toLowerCase()) {
                // Sucesso!
                const players = [...roomData.players];
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex >= 0) {
                    players[playerIndex].score += GAME_CONSTANTS.INTRUDER_POINTS;
                }

                await updateDoc(roomRef, {
                    phase: 'quest', // Volta para a quest
                    intruderFound: true,
                    intruderFoundBy: playerId,
                    confidence: Math.min(100, (roomData.confidence || 0) + 10), // Bônus de vida
                    players
                });
            } else {
                // Erro no Intruso: Penalidade?
                const newConfidence = Math.max(0, (roomData.confidence || 0) - GAME_CONSTANTS.ERROR_PENALTY);
                await updateDoc(roomRef, { confidence: newConfidence });
            }
        } catch (error) {
            console.error('Error resolving intruder:', error);
        }
    };

    const lockEnigma = async (roomId: string, enigmaIndex: number, playerId: string): Promise<boolean> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return false;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const enigmas = [...roomData.enigmas];

            // Check if already locked by someone else
            if (enigmas[enigmaIndex].activeSolver && enigmas[enigmaIndex].activeSolver !== playerId) {
                return false;
            }

            enigmas[enigmaIndex].activeSolver = playerId;

            await updateDoc(roomRef, { enigmas });
            return true;
        } catch (error) {
            console.error("Lock error", error);
            return false;
        }
    };

    const unlockEnigma = async (roomId: string, enigmaIndex: number, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const enigmas = [...roomData.enigmas];

            // Only unlock if locked by this player
            if (enigmas[enigmaIndex].activeSolver === playerId) {
                delete enigmas[enigmaIndex].activeSolver;
                await updateDoc(roomRef, { enigmas });
            }
        } catch (error) {
            console.error("Unlock error", error);
        }
    };

    const requestHelp = async (roomId: string, enigmaIndex: number, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const enigmas = [...roomData.enigmas];

            // Toggle help needed
            if (!enigmas[enigmaIndex].needsHelp) {
                enigmas[enigmaIndex].needsHelp = true;
                enigmas[enigmaIndex].helpRequestedBy = playerId;

                // UNLOCK for others to help
                delete enigmas[enigmaIndex].activeSolver;
            }

            await updateDoc(roomRef, { enigmas });
        } catch (error) {
            console.error("Request help error", error);
        }
    };

    const provideHelp = async (roomId: string, enigmaIndex: number, helperId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const enigmas = [...roomData.enigmas];
            const players = [...roomData.players];

            const enigma = enigmas[enigmaIndex];
            if (!enigma.needsHelp) return;

            // 1. Mark as helped
            enigma.needsHelp = false;
            enigma.helpedBy = helperId;

            // 2. Return lock to original requester
            enigma.activeSolver = enigma.helpRequestedBy;

            // 3. Reward Helper
            const helperIndex = players.findIndex(p => p.id === helperId);
            if (helperIndex !== -1) {
                players[helperIndex].score += GAME_CONSTANTS.HELP_GIVEN_POINTS;
                players[helperIndex].helpCount = (players[helperIndex].helpCount || 0) + 1;
            }

            await updateDoc(roomRef, { enigmas, players });
        } catch (error) {
            console.error("Provide help error", error);
        }
    };

    const startBossPhase = async (roomId: string, bossData: any): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            await updateDoc(roomRef, {
                phase: 'boss',
                bossLevel: bossData,
                bossState: { placedBlocks: [] }
            });
        } catch (error) {
            console.error('Error starting boss phase:', error);
        }
    };

    const addBossBlock = async (roomId: string, text: string, userId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;
            const roomData = roomSnap.data() as PolyQuestRoom;

            const newBlock = {
                id: crypto.randomUUID(),
                text,
                placedBy: userId,
                placedAt: Date.now()
            };

            const currentBlocks = roomData.bossState?.placedBlocks || [];

            await updateDoc(roomRef, {
                "bossState.placedBlocks": [...currentBlocks, newBlock]
            });
        } catch (error) {
            console.error('Error adding boss block:', error);
        }
    };

    const removeBossBlock = async (roomId: string, blockId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;
            const roomData = roomSnap.data() as PolyQuestRoom;

            const currentBlocks = roomData.bossState?.placedBlocks || [];
            const newBlocks = currentBlocks.filter((b: any) => b.id !== blockId);

            await updateDoc(roomRef, {
                "bossState.placedBlocks": newBlocks
            });
        } catch (error) {
            console.error('Error removing boss block:', error);
        }
    };

    const submitBossDamage = async (roomId: string, damage: number, isFatal: boolean): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;
            const roomData = roomSnap.data() as PolyQuestRoom;

            if (isFatal) {
                // Win!
                await updateDoc(roomRef, {
                    phase: 'finished',
                    finishedAt: Timestamp.now(),
                    // Bonus score can be calculated here
                });
            } else {
                // Damage to Team Confidence
                const newConfidence = Math.max(0, (roomData.confidence || 0) - damage);

                await updateDoc(roomRef, {
                    confidence: newConfidence
                });

                if (newConfidence <= 0) {
                    await updateDoc(roomRef, {
                        phase: 'finished',
                        finishedAt: Timestamp.now()
                    });
                }
            }
        } catch (error) {
            console.error('Error dealing boss damage:', error);
        }
    };

    /**
     * Limpar fadiga do jogador (chamado automaticamente ou manualmente)
     */
    const clearFatigue = async (roomId: string, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'polyquestRooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as PolyQuestRoom;
            const players = [...roomData.players];
            const playerIndex = players.findIndex(p => p.id === playerId);

            if (playerIndex >= 0 && players[playerIndex].isFatigued) {
                players[playerIndex].isFatigued = false;
                players[playerIndex].fatigueEndsAt = undefined;
                players[playerIndex].consecutiveCorrect = 0; // Resetar contador ao sair da fadiga? Regra diz "evitar domínio", então sim.

                await updateDoc(roomRef, {
                    players
                });
            }
        } catch (error) {
            console.error('Error clearing fatigue:', error);
        }
    };

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
        updateConfig,
        startGame,
        updatePhase,
        updateConfidence,
        toggleWordSelection,
        finishExploration,
        setEnigmas,
        submitAnswer,
        clearFatigue,
        triggerIntruder,
        resolveIntruder,
        startBossPhase,
        submitBossDamage,
        addBossBlock,
        removeBossBlock,
        lockEnigma,
        unlockEnigma,
        requestHelp,
        provideHelp
    };
};
