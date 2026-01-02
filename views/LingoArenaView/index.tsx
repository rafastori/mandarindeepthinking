import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, arrayUnion, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { GameRoom, Player, SupportedLanguage } from '../../types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { generateGameDeck } from '../../services/gemini';
import Icon from '../../components/Icon';
import { useStudyItems } from '../../hooks/useStudyItems';
import { useUserProfile } from '../../hooks/useUserProfile';

// Sub-componentes
import { RoomList } from './RoomList';
import { Lobby, TOPICS } from './Lobby';
import { ReviewPhase } from './ReviewPhase';
import { ActiveGame } from './ActiveGame';
import { GameOver } from './GameOver';

// Utils
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const LingoArenaView: React.FC = () => {
    const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [user, setUser] = useState<User | null>(null);

    // Config States
    const [selectedTopics, setSelectedTopics] = useState<string[]>([TOPICS[0]]);
    const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('zh');
    const [selectedDiff, setSelectedDiff] = useState('Iniciante');
    const [targetScore, setTargetScore] = useState(20);
    const [loadingDeck, setLoadingDeck] = useState(false);

    // Hooks for saving words
    const { addItem } = useStudyItems(user?.uid);
    const { savedIds, updateFavorites } = useUserProfile(user?.uid);

    const updateTimeoutRef = useRef<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Fullscreen functions
    const enterFullscreen = () => {
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            }
        } catch (e) {
            console.warn('Fullscreen not supported');
        }
    };

    const exitFullscreen = () => {
        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
            setIsFullscreen(false);
        } catch (e) {
            console.warn('Exit fullscreen failed');
        }
    };

    // Detect fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Auth & Listeners
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    // Cleanup old rooms (>24h) - runs once on mount
    useEffect(() => {
        const cleanupOldRooms = async () => {
            const snapshot = await getDoc(doc(db, '_meta', 'lastCleanup'));
            const lastCleanup = snapshot.exists() ? snapshot.data()?.time?.toDate?.() : null;
            const now = new Date();

            // Only run cleanup once per hour
            if (lastCleanup && (now.getTime() - lastCleanup.getTime()) < 3600000) return;

            const roomsSnapshot = await onSnapshot(collection(db, 'gameRooms'), async (snap) => {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

                for (const roomDoc of snap.docs) {
                    const data = roomDoc.data() as GameRoom;
                    const createdAt = data.createdAt?.toDate?.() || new Date(0);

                    // Delete if older than 24h OR if finished and older than 1h
                    const isOld = createdAt < twentyFourHoursAgo;
                    const isFinishedAndStale = data.status === 'finished' &&
                        createdAt < new Date(Date.now() - 60 * 60 * 1000);

                    if (isOld || isFinishedAndStale) {
                        console.log(`🧹 Cleaning up old room: ${roomDoc.id}`);
                        await deleteDoc(doc(db, 'gameRooms', roomDoc.id));
                    }
                }
            });

            // Unsubscribe immediately - we just wanted one check
            setTimeout(() => roomsSnapshot(), 100);
        };

        cleanupOldRooms().catch(console.error);
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'gameRooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRoom));
            setGameRooms(rooms);

            if (activeRoom) {
                const updated = rooms.find(r => r.id === activeRoom.id);
                if (!updated) setActiveRoom(null);
                else {
                    setActiveRoom(updated);
                    // Sync Guest Configs
                    if (updated.hostId !== user?.uid && updated.config) {
                        if (updated.config.topic) setSelectedTopics(updated.config.topic.split(', '));
                        if (updated.config.lang) setSelectedLang(updated.config.lang);
                        if (updated.config.diff) setSelectedDiff(updated.config.diff);
                        if (updated.targetScore) setTargetScore(updated.targetScore);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [activeRoom?.id, user?.uid]);

    // Host Sync Config
    useEffect(() => {
        if (!activeRoom || !user || activeRoom.hostId !== user.uid || activeRoom.status !== 'lobby') return;
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(async () => {
            await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
                config: { topic: selectedTopics.join(', '), lang: selectedLang, diff: selectedDiff },
                targetScore: targetScore
            });
        }, 500);
        return () => clearTimeout(updateTimeoutRef.current);
    }, [selectedTopics, selectedLang, selectedDiff, targetScore, activeRoom?.id]);

    // --- ACTIONS ---

    const toggleTopic = (topic: string) => {
        if (selectedTopics.includes(topic)) {
            if (selectedTopics.length > 1) setSelectedTopics(prev => prev.filter(t => t !== topic));
        } else {
            setSelectedTopics(prev => [...prev, topic]);
        }
    };

    const createRoom = async () => {
        if (!user || !newRoomName) return;
        const newPlayer: Player = { id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '', score: 0 };
        const newRoomData: Omit<GameRoom, 'id'> = {
            name: newRoomName, hostId: user.uid, players: [newPlayer], createdAt: new Date(),
            status: 'lobby', deck: [], cardQueue: [], activeHands: {},
            config: { topic: selectedTopics.join(', '), lang: selectedLang, diff: selectedDiff },
            targetScore: targetScore, teamScore: 0 // Começa com 0
        };
        const ref = await addDoc(collection(db, 'gameRooms'), newRoomData);
        setActiveRoom({ id: ref.id, ...newRoomData } as GameRoom);
        setNewRoomName('');
    };

    const joinRoom = async (roomId: string) => {
        if (!user) return;
        const ref = doc(db, 'gameRooms', roomId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as GameRoom;
            if (!data.players.some(p => p.id === user.uid)) {
                const newPlayer: Player = { id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '', score: 0 };
                await updateDoc(ref, { players: arrayUnion(newPlayer) });
            }
            setActiveRoom({ id: snap.id, ...data } as GameRoom);
        }
    };

    // BOT Names pool
    const BOT_NAMES = ['Ada', 'Tesla', 'Newton', 'Darwin', 'Curie', 'Einstein', 'Turing', 'Lovelace'];

    const addBot = async () => {
        if (!activeRoom || activeRoom.players.length >= 4) return;

        // Pick a random name not already used
        const usedNames = activeRoom.players.filter(p => p.isBot).map(p => p.name.replace('Bot ', ''));
        const availableNames = BOT_NAMES.filter(n => !usedNames.includes(n));
        const botName = availableNames.length > 0
            ? availableNames[Math.floor(Math.random() * availableNames.length)]
            : `Bot${Date.now().toString().slice(-4)}`;

        const newBot: Player = {
            id: `bot_${Date.now()}`,
            name: `Bot ${botName}`,
            score: 0,
            isBot: true
        };

        await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
            players: arrayUnion(newBot)
        });
    };

    const removeBot = async (botId: string) => {
        if (!activeRoom) return;
        const ref = doc(db, 'gameRooms', activeRoom.id);
        const updatedPlayers = activeRoom.players.filter(p => p.id !== botId);
        await updateDoc(ref, { players: updatedPlayers });
    };

    const restartGame = async () => {
        if (!activeRoom || !window.confirm("Reiniciar partida?")) return;
        const resetPlayers = activeRoom.players.map(p => ({ ...p, score: 0 }));
        await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
            status: 'lobby', deck: [], cardQueue: [], activeHands: {}, teamScore: 0, players: resetPlayers
        });
    };

    const handleGenerateCards = async (isRefill = false) => {
        if (!activeRoom || !user) return;
        if (!isRefill) setLoadingDeck(true);
        try {
            const topic = activeRoom.config?.topic || selectedTopics.join(', ');
            const currentDeck = activeRoom.deck || [];
            const excludeList = currentDeck.map(c => c.word);

            const newCards = await generateGameDeck(
                topic,
                activeRoom.config?.diff || selectedDiff,
                activeRoom.config?.lang || selectedLang,
                excludeList
            );

            const ref = doc(db, 'gameRooms', activeRoom.id);

            if (isRefill) {
                // REFILL: Adiciona novas cartas ao deck E à fila (queue)
                // Precisamos calcular os índices das novas cartas
                const startIndex = currentDeck.length;
                const newIndices = newCards.map((_, i) => startIndex + i);

                await updateDoc(ref, {
                    deck: [...currentDeck, ...newCards],
                    cardQueue: [...(activeRoom.cardQueue || []), ...newIndices], // Adiciona ao fim da fila
                    status: 'playing'
                });
            } else {
                // SETUP INICIAL
                await updateDoc(ref, { deck: newCards, status: 'review' });
            }
        } catch (e) { console.error(e); alert("Erro ao gerar."); }
        finally { setLoadingDeck(false); }
    };

    // Inicializa a fila de cartas ao começar
    const startGame = async () => {
        if (!activeRoom) return;

        // Enter fullscreen when game starts
        enterFullscreen();

        // Cria array de índices [0, 1, 2...] e embaralha
        const indices = Array.from({ length: activeRoom.deck.length }, (_, i) => i);
        const shuffledQueue = shuffleArray(indices);

        await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
            status: 'playing',
            cardQueue: shuffledQueue,
            activeHands: {}, // Ninguém tem carta ainda
            teamScore: 0, // Começa com 0
            roundsPlayed: 0 // Reset rounds counter
        });
    };

    const handleCancelReview = async () => {
        if (!activeRoom) return;
        await updateDoc(doc(db, 'gameRooms', activeRoom.id), { status: 'lobby', deck: [] });
    };

    const deleteRoom = async (id: string) => {
        if (window.confirm("Excluir?")) {
            await deleteDoc(doc(db, 'gameRooms', id));
            setActiveRoom(null);
        }
    };

    const leaveRoom = async (id: string) => {
        if (!user) return;
        const ref = doc(db, 'gameRooms', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as GameRoom;
            const updated = data.players.filter(p => p.id !== user.uid);
            if (updated.length === 0) await deleteDoc(ref);
            else {
                // Se sair, devolve a carta para a fila? Opcional. Vamos simplificar e descartar.
                // Mas precisamos limpar a mão dele no activeHands
                const newHands = { ...data.activeHands };
                delete newHands[user.uid];
                await updateDoc(ref, { players: updated, activeHands: newHands });
            }
        }
        setActiveRoom(null);
    };

    // --- NOVA LÓGICA DE JOGO ASSÍNCRONO ---

    const handleGameAction = async (result: 'CORRECT' | 'WRONG' | 'PASS' | 'GRAB') => {
        if (!activeRoom || !user) return;
        const ref = doc(db, 'gameRooms', activeRoom.id);

        let newTeamScore = activeRoom.teamScore || 0;
        const currentHands = { ...(activeRoom.activeHands || {}) };
        let currentQueue = [...(activeRoom.cardQueue || [])];
        const currentCardIndex = currentHands[user.uid]; // Carta atual do user

        // Atualiza Players (Score Individual)
        const updatePlayerScore = (points: number) => {
            return activeRoom.players.map(p => p.id === user.uid ? { ...p, score: (p.score || 0) + points } : p);
        };
        let updatedPlayers = activeRoom.players;

        // Lógica de Ação
        if (result === 'GRAB') {
            // Usa transação para garantir que apenas um jogador pegue a carta
            try {
                await runTransaction(db, async (transaction) => {
                    const roomSnap = await transaction.get(ref);
                    if (!roomSnap.exists()) return;

                    const roomData = roomSnap.data() as GameRoom;
                    const freshQueue = [...(roomData.cardQueue || [])];
                    const freshHands = { ...(roomData.activeHands || {}) };

                    // Se o usuário já tem carta, não faz nada
                    if (freshHands[user.uid] !== undefined) return;

                    // Se não há cartas na fila, não faz nada
                    if (freshQueue.length === 0) return;

                    // Pega a próxima carta disponível
                    const nextCard = freshQueue.shift();
                    if (nextCard !== undefined) {
                        freshHands[user.uid] = nextCard;
                    }

                    transaction.update(ref, {
                        cardQueue: freshQueue,
                        activeHands: freshHands
                    });
                });
            } catch (e) {
                console.warn('Transaction failed, card may already be taken');
            }
            return; // GRAB é tratado completamente na transação
        }
        else {
            // Processa resultado da carta atual
            if (currentCardIndex === undefined) return; // Segurança

            if (result === 'CORRECT') {
                newTeamScore += 1;
                updatedPlayers = updatePlayerScore(1);
                // Carta é descartada (não volta pra fila)
            } else if (result === 'WRONG') {
                newTeamScore -= 3;
                updatedPlayers = updatePlayerScore(-3);
                // Carta volta pro final da fila
                currentQueue.push(currentCardIndex);
            } else if (result === 'PASS') {
                // Sem mudança de pontos
                // Carta volta pro final da fila
                currentQueue.push(currentCardIndex);
            }

            // Remove a carta atual da mão
            delete currentHands[user.uid];

            // AUTO-PULL: Já tenta pegar a próxima imediatamente para fluidez
            if (currentQueue.length > 0) {
                const nextCard = currentQueue.shift();
                if (nextCard !== undefined) currentHands[user.uid] = nextCard;
            }
        }

        // Checagem de Fim de Jogo ou Refill
        const isWin = newTeamScore >= (activeRoom.targetScore || 20);
        const roundsPlayed = (activeRoom.roundsPlayed || 0) + (result === 'CORRECT' || result === 'WRONG' ? 1 : 0);
        // Game over por score negativo só ocorre após 4 rodadas
        const isGameOverLoss = newTeamScore <= 0 && result === 'WRONG' && roundsPlayed >= 4;

        // Checagem de Refill (Se fila vazia e deck pequeno)
        // Se a fila está vazia e alguém tentou pegar carta (GRAB ou Auto-Pull falhou)
        const needsRefill = currentQueue.length === 0;

        if (isWin) {
            await updateDoc(ref, { status: 'finished', teamScore: newTeamScore, players: updatedPlayers, activeHands: {}, cardQueue: [], roundsPlayed });
        } else if (isGameOverLoss) {
            await updateDoc(ref, { status: 'finished', teamScore: newTeamScore, players: updatedPlayers, activeHands: {}, cardQueue: [], roundsPlayed });
        } else if (needsRefill && activeRoom.status !== 'regenerating') {
            // Entra em modo refill, salva estado atual
            await updateDoc(ref, {
                status: 'regenerating',
                teamScore: newTeamScore,
                players: updatedPlayers,
                activeHands: currentHands,
                cardQueue: currentQueue,
                roundsPlayed
            });
            // Dispara geração
            setTimeout(() => handleGenerateCards(true), 100);
        } else {
            // Segue o jogo
            await updateDoc(ref, {
                teamScore: newTeamScore,
                players: updatedPlayers,
                activeHands: currentHands,
                cardQueue: currentQueue,
                roundsPlayed
            });
        }
    };

    // --- BOT AUTO-PLAY LOGIC ---
    const botPlayRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to execute BOT action
    const executeBotAction = async (botId: string, action: 'CORRECT' | 'WRONG' | 'PASS' | 'GRAB') => {
        if (!activeRoom) return;
        const ref = doc(db, 'gameRooms', activeRoom.id);

        let newTeamScore = activeRoom.teamScore || 0;
        const currentHands = { ...(activeRoom.activeHands || {}) };
        let currentQueue = [...(activeRoom.cardQueue || [])];
        const currentCardIndex = currentHands[botId];

        const updatePlayerScore = (points: number) => {
            return activeRoom.players.map(p => p.id === botId ? { ...p, score: (p.score || 0) + points } : p);
        };
        let updatedPlayers = activeRoom.players;

        if (action === 'GRAB') {
            // BOT também usa transação para garantir atomicidade
            try {
                await runTransaction(db, async (transaction) => {
                    const roomSnap = await transaction.get(ref);
                    if (!roomSnap.exists()) return;

                    const roomData = roomSnap.data() as GameRoom;
                    const freshQueue = [...(roomData.cardQueue || [])];
                    const freshHands = { ...(roomData.activeHands || {}) };

                    // Se o bot já tem carta, não faz nada
                    if (freshHands[botId] !== undefined) return;

                    // Se não há cartas na fila, não faz nada
                    if (freshQueue.length === 0) return;

                    // Pega a próxima carta disponível
                    const nextCard = freshQueue.shift();
                    if (nextCard !== undefined) {
                        freshHands[botId] = nextCard;
                    }

                    transaction.update(ref, {
                        cardQueue: freshQueue,
                        activeHands: freshHands
                    });
                });
            } catch (e) {
                console.warn('Bot transaction failed');
            }
            return; // GRAB tratado na transação
        } else {
            if (currentCardIndex === undefined) return;

            if (action === 'CORRECT') {
                newTeamScore += 1;
                updatedPlayers = updatePlayerScore(1);
            } else if (action === 'WRONG') {
                newTeamScore -= 3;
                updatedPlayers = updatePlayerScore(-3);
                currentQueue.push(currentCardIndex);
            }

            delete currentHands[botId];
            if (currentQueue.length > 0) {
                const nextCard = currentQueue.shift();
                if (nextCard !== undefined) currentHands[botId] = nextCard;
            }
        }

        const isWin = newTeamScore >= (activeRoom.targetScore || 20);
        const isGameOverLoss = newTeamScore <= 0 && action === 'WRONG';

        if (isWin || isGameOverLoss) {
            await updateDoc(ref, { status: 'finished', teamScore: newTeamScore, players: updatedPlayers, activeHands: {}, cardQueue: [] });
        } else {
            await updateDoc(ref, { teamScore: newTeamScore, players: updatedPlayers, activeHands: currentHands, cardQueue: currentQueue });
        }
    };

    // Effect to trigger BOT actions
    useEffect(() => {
        if (!activeRoom || activeRoom.status !== 'playing' || !user) return;
        if (activeRoom.hostId !== user.uid) return; // Only host runs bot logic

        // Find bots that need to act
        const bots = activeRoom.players.filter(p => p.isBot);
        if (bots.length === 0) return;

        // Clear existing timeout
        if (botPlayRef.current) clearTimeout(botPlayRef.current);

        // For each bot, check if they need to act
        for (const bot of bots) {
            const botHasCard = activeRoom.activeHands?.[bot.id] !== undefined;
            const queueHasCards = (activeRoom.cardQueue?.length || 0) > 0;

            if (!botHasCard && queueHasCards) {
                // Bot needs to grab a card
                botPlayRef.current = setTimeout(() => {
                    executeBotAction(bot.id, 'GRAB');
                }, 1500 + Math.random() * 1000); // 1.5-2.5s delay
            } else if (botHasCard) {
                // Bot has a card, needs to answer
                botPlayRef.current = setTimeout(() => {
                    // 95% accuracy (improved from 70%)
                    const isCorrect = Math.random() < 0.95;
                    executeBotAction(bot.id, isCorrect ? 'CORRECT' : 'WRONG');
                }, 2500 + Math.random() * 2000); // 2.5-4.5s delay
            }
        }

        return () => {
            if (botPlayRef.current) clearTimeout(botPlayRef.current);
        };
    }, [activeRoom?.activeHands, activeRoom?.cardQueue, activeRoom?.status]);

    if (!user) return <div className="p-10 text-center text-slate-400">Faça login para jogar.</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            {activeRoom && (
                <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center z-20">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="users" size={20} className="text-brand-600" /> {activeRoom.name}
                        </h2>
                        {activeRoom.status === 'lobby' ? <span className="text-xs text-slate-400">Lobby</span> :
                            <div className="flex items-center gap-2 mt-1">
                                <div className="h-2 w-24 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${activeRoom.teamScore < 0 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, Math.max(0, ((activeRoom.teamScore || 0) / (activeRoom.targetScore || 20)) * 100))}%` }} />
                                </div>
                            </div>
                        }
                    </div>
                    <div className="flex gap-2">
                        {/* Fullscreen toggle button */}
                        <button
                            onClick={() => isFullscreen ? exitFullscreen() : enterFullscreen()}
                            className="p-2 text-slate-400 hover:text-brand-600 bg-slate-50 rounded-lg"
                            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                        >
                            <Icon name={isFullscreen ? 'minimize-2' : 'maximize-2'} size={18} />
                        </button>
                        {activeRoom.hostId === user.uid && activeRoom.status !== 'lobby' && (
                            <button onClick={restartGame} className="p-2 text-slate-400 hover:text-orange-500 bg-slate-50 rounded-lg"><Icon name="rotate-ccw" size={18} /></button>
                        )}
                        <button onClick={() => { exitFullscreen(); leaveRoom(activeRoom.id); }} className="text-red-500 font-bold text-sm bg-red-50 px-3 py-1 rounded-lg">Sair</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {!activeRoom && (
                    <RoomList rooms={gameRooms} newRoomName={newRoomName} setNewRoomName={setNewRoomName} onCreateRoom={createRoom} onJoinRoom={joinRoom} />
                )}

                {activeRoom && activeRoom.status !== 'lobby' && activeRoom.status !== 'finished' && (
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-3 justify-center">
                        {activeRoom.players.map(p => (
                            <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${activeRoom.activeHands?.[p.id] !== undefined ? 'bg-brand-50 border-brand-200' : 'bg-slate-50 border-slate-100'}`}>
                                {p.avatarUrl && <img src={p.avatarUrl} alt={p.name} className="w-5 h-5 rounded-full" />}
                                <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                <span className="text-xs bg-white px-1.5 rounded border border-slate-200 text-slate-500">{p.score || 0}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeRoom?.status === 'lobby' && (
                    <Lobby
                        room={activeRoom} isHost={activeRoom.hostId === user.uid}
                        selectedTopics={selectedTopics} selectedLang={selectedLang} selectedDiff={selectedDiff} targetScore={targetScore} loadingDeck={loadingDeck}
                        onToggleTopic={toggleTopic} setLang={setSelectedLang} setDiff={setSelectedDiff} setTargetScore={setTargetScore}
                        onStart={() => handleGenerateCards(false)}
                        onAddBot={addBot}
                        onRemoveBot={removeBot}
                    />
                )}

                {activeRoom?.status === 'review' && (
                    <ReviewPhase deck={activeRoom.deck} isHost={activeRoom.hostId === user.uid} onCancel={handleCancelReview} onStartGame={startGame} />
                )}

                {(activeRoom?.status === 'playing' || activeRoom?.status === 'regenerating') && (
                    <ActiveGame room={activeRoom} user={user} onResult={handleGameAction} />
                )}

                {activeRoom?.status === 'finished' && (
                    <GameOver
                        room={activeRoom}
                        isHost={activeRoom.hostId === user.uid}
                        onRestart={restartGame}
                        onDelete={() => deleteRoom(activeRoom.id)}
                        onSaveWords={async (words) => {
                            if (!activeRoom || !user) return;
                            const newIds: string[] = [];

                            for (const w of words) {
                                const newId = await addItem({
                                    chinese: w.word,
                                    translation: w.meaning,
                                    pinyin: w.pinyin || '',
                                    tokens: [w.word],
                                    keywords: [{
                                        id: Date.now().toString() + Math.random().toString().slice(2),
                                        word: w.word,
                                        pinyin: w.pinyin || '',
                                        meaning: w.meaning,
                                        language: activeRoom.config?.lang
                                    }],
                                    language: activeRoom.config?.lang,
                                    type: 'word',
                                    originalSentence: ''
                                });
                                if (newId) newIds.push(newId);
                            }

                            if (newIds.length > 0 && savedIds) {
                                await updateFavorites([...savedIds, ...newIds]);
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default LingoArenaView;