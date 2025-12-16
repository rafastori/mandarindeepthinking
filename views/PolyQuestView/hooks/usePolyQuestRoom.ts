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
    };
};
