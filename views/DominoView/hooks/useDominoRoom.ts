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
    Timestamp
} from 'firebase/firestore';
import {
    DominoRoom,
    DominoPlayer,
    DominoConfig,
    DominoPiece,
    Train,
    TermPair,
    DOMINO_CONSTANTS
} from '../types';
import { generateDominoTerms } from '../../../services/gemini';
import { calculateBotMove } from '../utils/botLogic';

/**
 * Gera as 91 peças de dominó a partir dos 13 pares
 */
const generateDeck = (termPairs: TermPair[]): DominoPiece[] => {
    const pieces: DominoPiece[] = [];

    // Gerar todas as 91 combinações (0-0, 0-1, ..., 12-12)
    for (let i = 0; i < 13; i++) {
        for (let j = i; j < 13; j++) {
            pieces.push({
                id: `piece-${i}-${j}`,
                leftIndex: i,
                rightIndex: j,
                leftText: termPairs[i].term,
                rightText: termPairs[j].definition,
                isHub: i === 12 && j === 12 // A peça 12-12 é o hub
            });
        }
    }

    // Embaralhar
    return pieces.sort(() => Math.random() - 0.5);
};

export const useDominoRoom = (userId?: string) => {
    const [rooms, setRooms] = useState<DominoRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<DominoRoom | null>(null);
    const [loading, setLoading] = useState(true);

    // Cleanup old rooms (>24h or finished >1h) - runs once on mount
    useEffect(() => {
        const cleanupOldRooms = async () => {
            try {
                const roomsRef = collection(db, 'dominoRooms');
                const unsubCleanup = onSnapshot(roomsRef, async (snap) => {
                    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

                    for (const roomDoc of snap.docs) {
                        const data = roomDoc.data();
                        const createdAt = data.createdAt?.toDate?.() || new Date(0);

                        const isOld = createdAt < twentyFourHoursAgo;
                        const isFinishedAndStale = data.phase === 'finished' && createdAt < oneHourAgo;

                        if (isOld || isFinishedAndStale) {
                            console.log(`🧹 Cleaning up old domino room: ${roomDoc.id}`);
                            await deleteDoc(doc(db, 'dominoRooms', roomDoc.id));
                        }
                    }
                });

                // Unsubscribe after one check
                setTimeout(() => unsubCleanup(), 200);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        };

        cleanupOldRooms();
    }, []);

    // Listener para salas
    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'dominoRooms'),
            (snapshot) => {
                const roomsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                    startedAt: doc.data().startedAt?.toDate(),
                    finishedAt: doc.data().finishedAt?.toDate(),
                } as DominoRoom));

                setRooms(roomsData);
                setLoading(false);

                if (activeRoom) {
                    const updated = roomsData.find(r => r.id === activeRoom.id);
                    if (updated) {
                        setActiveRoom(updated);

                        // Bot Logic Trigger (Host Only)
                        // If game is playing, it's a bot's turn, and I am the host => Make move
                        if (updated.phase === 'playing' && userId === updated.hostId) {
                            const currentPlayer = updated.players.find(p => p.id === updated.currentTurn);
                            if (currentPlayer && currentPlayer.isBot) {
                                // Add small delay for realism
                                const timer = setTimeout(async () => {
                                    const move = calculateBotMove(updated, currentPlayer.id);
                                    console.log(`🤖 Bot ${currentPlayer.name} chose:`, move);

                                    if (move.action === 'place' && move.pieceId && move.trainId) {
                                        await placePiece(updated.id, move.pieceId, move.trainId, move.flipped || false);
                                    } else if (move.action === 'draw') {
                                        const drawn = await drawPiece(updated.id, currentPlayer.id);
                                        // Optional: if drawn piece is playable, play immediately (recursive logic or next turn?)
                                        // Standard rules often say: draw 1. If playable, play. Else pass.
                                        // V1 Simplification: Bot draws. Next turn logic will see hand changed (or turn pass needed).
                                        // Actually, if we just draw, the turn stays with Bot? No, drawPiece doesn't pass turn.
                                        // So we need to Check if drawn piece is playable.

                                        if (drawn) {
                                            // Re-evaluate immediately with new hand?
                                            // For simplicity V1: Just draw. The Effect will trigger again?
                                            // No, unless we built-in a "post-draw" check.
                                            // Let's implement immediate pass if draw logic requires, OR let effect re-trigger if state changes?
                                            // If we draw, `updated` state might not reflect immediately in this closure. 
                                            // But drawing updates DB -> triggers snapshot -> triggers this Effect again.
                                            // So this is safe!
                                        } else {
                                            // Empty boneyard?
                                            await passTurn(updated.id, currentPlayer.id);
                                        }
                                    } else {
                                        await passTurn(updated.id, currentPlayer.id);
                                    }
                                }, 1500);
                                return () => clearTimeout(timer);
                            }
                        }
                    } else {
                        setActiveRoom(null);
                    }
                }
            },
            (error) => {
                console.error('Domino rooms error:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [activeRoom?.id, userId]); // Added userId dependency

    const createRoom = async (
        roomName: string,
        config: DominoConfig,
        player: DominoPlayer
    ): Promise<string | null> => {
        try {
            const newRoom: Omit<DominoRoom, 'id'> = {
                name: roomName,
                hostId: player.id,
                players: [player],
                phase: 'lobby',
                config,
                termPairs: [],
                boneyard: [],
                trains: [],
                currentTurn: '',
                consecutivePasses: 0,
                createdAt: new Date(),
            };

            const docRef = await addDoc(collection(db, 'dominoRooms'), {
                ...newRoom,
                createdAt: Timestamp.now(),
            });

            return docRef.id;
        } catch (error) {
            console.error('Error creating room:', error);
            return null;
        }
    };

    const joinRoom = async (roomId: string, player: DominoPlayer): Promise<boolean> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return false;

            const roomData = roomSnap.data() as DominoRoom;
            if (roomData.players.some(p => p.id === player.id)) return true;
            if (roomData.players.length >= DOMINO_CONSTANTS.MAX_PLAYERS) return false;

            await updateDoc(roomRef, { players: arrayUnion(player) });
            return true;
        } catch (error) {
            console.error('Error joining room:', error);
            return false;
        }
    };

    const leaveRoom = async (roomId: string, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;

            // If host leaves, we might want to end game or assign new host?
            // For now, if host leaves, bots stop.

            const updatedPlayers = roomData.players.filter(p => p.id !== playerId);

            await updateDoc(roomRef, { players: updatedPlayers });
            setActiveRoom(null);
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    };

    const addBot = async (roomId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;
            if (roomData.players.length >= DOMINO_CONSTANTS.MAX_PLAYERS) return;

            const botId = `bot-${Date.now()}`;
            const botNames = ['Roboto', 'DaVinci', 'Tesla', 'Curie', 'Einstein', 'Ada', 'Turing'];
            const existingNames = roomData.players.map(p => p.name);
            const availableNames = botNames.filter(n => !existingNames.includes(n));
            const botName = availableNames[Math.floor(Math.random() * availableNames.length)] || `Bot ${Math.floor(Math.random() * 100)}`;

            const botPlayer: DominoPlayer = {
                id: botId,
                name: botName,
                avatarUrl: '', // Could be a bot avatar URL
                hand: [],
                score: 0,
                isReady: true, // Bots are always ready
                isBot: true
            };

            await updateDoc(roomRef, { players: arrayUnion(botPlayer) });
        } catch (error) {
            console.error('Error adding bot:', error);
        }
    };

    const removeBot = async (roomId: string, botId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;
            const updatedPlayers = roomData.players.filter(p => p.id !== botId);

            await updateDoc(roomRef, { players: updatedPlayers });
        } catch (error) {
            console.error('Error removing bot:', error);
        }
    };

    const deleteRoom = async (roomId: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'dominoRooms', roomId));
            setActiveRoom(null);
        } catch (error) {
            console.error('Error deleting room:', error);
        }
    };

    const toggleReady = async (roomId: string, playerId: string, isReady: boolean): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;
            const updatedPlayers = roomData.players.map(p =>
                p.id === playerId ? { ...p, isReady } : p
            );

            await updateDoc(roomRef, { players: updatedPlayers });
        } catch (error) {
            console.error('Error toggling ready:', error);
        }
    };

    const updateConfig = async (roomId: string, config: Partial<DominoConfig>): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const currentConfig = (roomSnap.data() as DominoRoom).config;
            await updateDoc(roomRef, { config: { ...currentConfig, ...config } });
        } catch (error) {
            console.error('Error updating config:', error);
        }
    };

    const startGame = async (roomId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;

            // 1. Gerar 13 termos via IA
            const terms = await generateDominoTerms(roomData.config.context, {
                sourceLang: roomData.config.sourceLang,
                targetLang: roomData.config.targetLang,
                customTopic: roomData.config.customTopic,
                difficulty: roomData.config.difficulty
            });

            // 2. Criar termPairs com índices
            const termPairs: TermPair[] = terms.map((t, idx) => ({
                index: idx,
                term: t.term,
                definition: t.definition
            }));

            // 3. Gerar 91 peças
            let deck = generateDeck(termPairs);

            // 4. Separar hub (12-12)
            const hubIndex = deck.findIndex(p => p.isHub);
            const hubPiece = deck.splice(hubIndex, 1)[0];

            // 5. Distribuir peças
            const numPlayers = roomData.players.length;
            const piecesPerPlayer = numPlayers <= 4
                ? DOMINO_CONSTANTS.PIECES_2_4_PLAYERS
                : DOMINO_CONSTANTS.PIECES_5_6_PLAYERS;

            const updatedPlayers = roomData.players.map(player => ({
                ...player,
                hand: deck.splice(0, piecesPerPlayer),
                score: 0
            }));

            // 6. Inicializar trens
            const trains: Train[] = [];

            updatedPlayers.forEach(p => {
                trains.push({
                    id: `train-${p.id}`,
                    ownerId: p.id,
                    pieces: [],
                    isOpen: false,
                    openEndIndex: 12,
                    openEndText: termPairs[12].definition
                });
            });

            await updateDoc(roomRef, {
                termPairs,
                players: updatedPlayers,
                boneyard: deck,
                trains,
                hubPiece,
                phase: 'playing',
                currentTurn: roomData.hostId,
                consecutivePasses: 0,
                startedAt: Timestamp.now()
            });

        } catch (error) {
            console.error('Error starting game:', error);
        }
    };

    const placePiece = async (
        roomId: string,
        pieceId: string,
        trainId: string,
        flipped: boolean
    ): Promise<boolean> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return false;

            const roomData = roomSnap.data() as DominoRoom;
            const playerIndex = roomData.players.findIndex(p => p.id === roomData.currentTurn);
            const player = { ...roomData.players[playerIndex] };

            const pieceIndex = player.hand.findIndex(p => p.id === pieceId);
            if (pieceIndex === -1) return false;
            const piece = player.hand[pieceIndex];

            const trainIndex = roomData.trains.findIndex(t => t.id === trainId);
            if (trainIndex === -1) return false;
            const train = { ...roomData.trains[trainIndex] };

            // Validação: a peça deve conectar com a ponta aberta do trem
            const connectingIndex = flipped ? piece.rightIndex : piece.leftIndex;
            if (connectingIndex !== train.openEndIndex) {
                console.log(`Piece ${connectingIndex} doesn't match train end ${train.openEndIndex}`);
                return false;
            }

            // Atualizar mão do jogador
            player.hand = player.hand.filter((_, idx) => idx !== pieceIndex);

            // Atualizar trem
            train.pieces.push({
                piece,
                position: train.pieces.length,
                orientation: flipped ? 'flipped' : 'normal',
                placedBy: player.id
            });

            // Nova ponta aberta
            train.openEndIndex = flipped ? piece.leftIndex : piece.rightIndex;
            train.openEndText = flipped
                ? roomData.termPairs[piece.leftIndex].term
                : roomData.termPairs[piece.rightIndex].definition;

            // Se jogou no próprio trem, fecha
            if (train.ownerId === player.id) {
                train.isOpen = false;
            }

            const updatedPlayers = [...roomData.players];
            updatedPlayers[playerIndex] = player;

            const updatedTrains = [...roomData.trains];
            updatedTrains[trainIndex] = train;

            // Próximo jogador
            const nextPlayerIndex = (playerIndex + 1) % roomData.players.length;

            // Verificar vitória
            if (player.hand.length === 0) {
                await updateDoc(roomRef, {
                    phase: 'finished',
                    players: updatedPlayers,
                    trains: updatedTrains,
                    finishedAt: Timestamp.now()
                });
                return true;
            }

            await updateDoc(roomRef, {
                players: updatedPlayers,
                trains: updatedTrains,
                currentTurn: roomData.players[nextPlayerIndex].id,
                consecutivePasses: 0
            });

            return true;
        } catch (error) {
            console.error('Error placing piece:', error);
            return false;
        }
    };

    const drawPiece = async (roomId: string, playerId: string): Promise<DominoPiece | null> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return null;

            const roomData = roomSnap.data() as DominoRoom;
            if (roomData.boneyard.length === 0) return null;

            const deck = [...roomData.boneyard];
            const piece = deck.shift()!;

            const updatedPlayers = roomData.players.map(p => {
                if (p.id === playerId) {
                    return { ...p, hand: [...p.hand, piece] };
                }
                return p;
            });

            await updateDoc(roomRef, {
                boneyard: deck,
                players: updatedPlayers
            });

            return piece;
        } catch (error) {
            console.error('Error drawing piece:', error);
            return null;
        }
    };

    const passTurn = async (roomId: string, playerId: string): Promise<void> => {
        try {
            const roomRef = doc(db, 'dominoRooms', roomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) return;

            const roomData = roomSnap.data() as DominoRoom;
            const playerIndex = roomData.players.findIndex(p => p.id === playerId);
            const nextPlayerIndex = (playerIndex + 1) % roomData.players.length;

            // Abrir trem do jogador
            const updatedTrains = roomData.trains.map(t => {
                if (t.ownerId === playerId) return { ...t, isOpen: true };
                return t;
            });

            const newConsecutivePasses = roomData.consecutivePasses + 1;

            // Se todos passaram, termina o jogo
            if (newConsecutivePasses >= roomData.players.length) {
                await updateDoc(roomRef, {
                    phase: 'finished',
                    trains: updatedTrains,
                    finishedAt: Timestamp.now()
                });
                return;
            }

            await updateDoc(roomRef, {
                currentTurn: roomData.players[nextPlayerIndex].id,
                trains: updatedTrains,
                consecutivePasses: newConsecutivePasses
            });
        } catch (error) {
            console.error('Error passing turn:', error);
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
        placePiece,
        drawPiece,
        addBot,
        removeBot,
        passTurn
    };
};
