import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, arrayUnion, getDoc, deleteDoc } from 'firebase/firestore';
import { GameRoom, Player } from '../../types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { generateGameDeck } from '../../services/gemini';
import Icon from '../../components/Icon';

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

const GameView: React.FC = () => {
    const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [user, setUser] = useState<User | null>(null);
    
    // Config States
    const [selectedTopics, setSelectedTopics] = useState<string[]>([TOPICS[0]]);
    const [selectedLang, setSelectedLang] = useState<'zh'|'de'>('zh');
    const [selectedDiff, setSelectedDiff] = useState('Iniciante');
    const [targetScore, setTargetScore] = useState(20); 
    const [loadingDeck, setLoadingDeck] = useState(false);

    const updateTimeoutRef = useRef<any>(null);

    // Auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    // Firestore Listener
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'gameRooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRoom));
            setGameRooms(rooms);
            
            if (activeRoom) {
                const updated = rooms.find(r => r.id === activeRoom.id);
                if (!updated) setActiveRoom(null);
                else {
                    setActiveRoom(updated);
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

    // Host Config Sync
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

    // Actions
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
            status: 'lobby', deck: [], config: { topic: selectedTopics.join(', '), lang: selectedLang, diff: selectedDiff },
            targetScore: targetScore, teamScore: 0, currentCardIndex: 0
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

    const deleteRoom = async (roomId: string) => {
        if (window.confirm("Excluir sala?")) {
            await deleteDoc(doc(db, 'gameRooms', roomId));
            setActiveRoom(null);
        }
    };

    const leaveRoom = async (roomId: string) => {
        if (!user) return;
        const ref = doc(db, 'gameRooms', roomId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data() as GameRoom;
            const updated = data.players.filter(p => p.id !== user.uid);
            if (updated.length === 0) await deleteDoc(ref);
            else {
                let newHostId = data.hostId === user.uid ? updated[0].id : data.hostId;
                await updateDoc(ref, { players: updated, hostId: newHostId });
            }
        }
        setActiveRoom(null);
    };

    const restartGame = async () => {
        if (!activeRoom || !window.confirm("Reiniciar partida?")) return;
        const resetPlayers = activeRoom.players.map(p => ({ ...p, score: 0 }));
        await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
            status: 'lobby', deck: [], currentCardIndex: 0, teamScore: 0, roundAnswers: {}, players: resetPlayers
        });
    };

    const handleGenerateCards = async (isRefill = false) => {
        if (!activeRoom || !user) return;
        if (!isRefill) setLoadingDeck(true);
        try {
            const topic = activeRoom.config?.topic || selectedTopics.join(', ');
            
            // Lógica de exclusão para evitar repetidas
            const currentDeck = activeRoom.deck || [];
            const excludeList = currentDeck.map(c => c.word);

            const newCards = await generateGameDeck(
                topic, 
                activeRoom.config?.diff || selectedDiff, 
                activeRoom.config?.lang || selectedLang,
                excludeList
            );
            
            const ref = doc(db, 'gameRooms', activeRoom.id);
            if (isRefill) await updateDoc(ref, { deck: [...currentDeck, ...newCards], status: 'playing' });
            else await updateDoc(ref, { deck: newCards, status: 'review' });
        } catch(e) { console.error(e); alert("Erro ao gerar."); }
        finally { setLoadingDeck(false); }
    };

    const startGame = async () => {
        if (!activeRoom) return;
        await updateDoc(doc(db, 'gameRooms', activeRoom.id), {
            status: 'playing', deck: shuffleArray(activeRoom.deck), currentCardIndex: 0, roundAnswers: {}, teamScore: 0
        });
    };

    const handleCancelReview = async () => {
        if (!activeRoom) return;
        await updateDoc(doc(db, 'gameRooms', activeRoom.id), { status: 'lobby', deck: [] });
    };

    // --- MUDANÇA CRÍTICA: Lógica de Resposta Sincronizada ---
    const submitAnswer = async (known: boolean) => {
        if (!activeRoom || !user) return;
        const ref = doc(db, 'gameRooms', activeRoom.id);
        const updatedAnswers = { ...(activeRoom.roundAnswers || {}), [user.uid]: known };
        
        // Verifica se TODOS responderam
        if (activeRoom.players.every(p => updatedAnswers[p.id] !== undefined)) {
            let roundScore = 0;
            const updatedPlayers = activeRoom.players.map(p => {
                const correct = updatedAnswers[p.id];
                if (correct) roundScore++;
                return correct ? { ...p, score: (p.score || 0) + 1 } : p;
            });
            
            const newTeamScore = (activeRoom.teamScore || 0) + roundScore;
            
            // MUDANÇA: Avança apenas 1 carta (pois todos viram a mesma)
            const nextIndex = (activeRoom.currentCardIndex || 0) + 1;
            
            const hasWon = newTeamScore >= (activeRoom.targetScore || 20);
            
            // MUDANÇA: Verifica se falta apenas 1 carta para acabar o deck (ou se já acabou)
            const cardsLeft = activeRoom.deck.length - nextIndex;
            const needsRefill = cardsLeft <= 1; // Recarrega quando sobrar 1 ou 0

            if (hasWon) {
                await updateDoc(ref, { players: updatedPlayers, teamScore: newTeamScore, roundAnswers: {}, status: 'finished' });
            } else if (needsRefill) {
                await updateDoc(ref, { 
                    players: updatedPlayers, 
                    teamScore: newTeamScore, 
                    roundAnswers: {}, 
                    currentCardIndex: nextIndex, 
                    status: 'regenerating' 
                });
                setTimeout(() => handleGenerateCards(true), 100);
            } else {
                await updateDoc(ref, { 
                    players: updatedPlayers, 
                    teamScore: newTeamScore, 
                    roundAnswers: {}, 
                    currentCardIndex: nextIndex 
                });
            }
        } else {
            await updateDoc(ref, { roundAnswers: updatedAnswers });
        }
    };

    if (!user) return <div className="p-10 text-center text-slate-400">Faça login para jogar.</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {activeRoom && (
                <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center z-20">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                             <Icon name="users" size={20} className="text-brand-600"/> {activeRoom.name}
                        </h2>
                        {activeRoom.status === 'lobby' ? (
                            <span className="text-xs text-slate-400">Lobby</span>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Equipe:</span>
                                <div className="h-2 w-24 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${Math.min(100, ((activeRoom.teamScore || 0) / (activeRoom.targetScore || 20)) * 100)}%` }} />
                                </div>
                                <span className="text-xs font-bold text-brand-700">{activeRoom.teamScore || 0}/{activeRoom.targetScore}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {activeRoom.hostId === user.uid && activeRoom.status !== 'lobby' && (
                            <button onClick={restartGame} className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"><Icon name="rotate-ccw" size={18} /></button>
                        )}
                        {activeRoom.hostId === user.uid && activeRoom.status === 'lobby' && (
                             <button onClick={() => deleteRoom(activeRoom.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icon name="trash-2" size={18} /></button>
                        )}
                        <button onClick={() => leaveRoom(activeRoom.id)} className="text-red-500 font-bold text-sm bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100">Sair</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {!activeRoom && (
                    <RoomList 
                        rooms={gameRooms} 
                        newRoomName={newRoomName} 
                        setNewRoomName={setNewRoomName} 
                        onCreateRoom={createRoom} 
                        onJoinRoom={joinRoom} 
                    />
                )}

                {activeRoom && activeRoom.status !== 'lobby' && activeRoom.status !== 'finished' && (
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-3 justify-center">
                        {activeRoom.players.map(player => {
                            const hasAnswered = activeRoom.roundAnswers?.[player.id] !== undefined;
                            return (
                                <div key={player.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${hasAnswered ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                                    {player.avatarUrl && <img src={player.avatarUrl} alt={player.name} className="w-5 h-5 rounded-full" />}
                                    <div className={`w-2 h-2 rounded-full ${activeRoom.status === 'playing' && !hasAnswered ? 'bg-orange-400 animate-pulse' : 'bg-slate-300'}`}></div>
                                    <span className="text-xs font-bold text-slate-700">{player.name}</span>
                                    <span className="text-xs bg-white px-1.5 rounded border border-slate-200 text-slate-500">{player.score || 0}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeRoom?.status === 'lobby' && (
                    <Lobby 
                        room={activeRoom}
                        isHost={activeRoom.hostId === user.uid}
                        selectedTopics={selectedTopics}
                        selectedLang={selectedLang}
                        selectedDiff={selectedDiff}
                        targetScore={targetScore}
                        loadingDeck={loadingDeck}
                        onToggleTopic={toggleTopic}
                        setLang={setSelectedLang}
                        setDiff={setSelectedDiff}
                        setTargetScore={setTargetScore}
                        onStart={() => handleGenerateCards(false)}
                    />
                )}

                {activeRoom?.status === 'review' && (
                    <ReviewPhase 
                        deck={activeRoom.deck}
                        isHost={activeRoom.hostId === user.uid}
                        onCancel={handleCancelReview}
                        onStartGame={startGame}
                    />
                )}

                {(activeRoom?.status === 'playing' || activeRoom?.status === 'regenerating') && (
                    <ActiveGame 
                        room={activeRoom}
                        user={user}
                        onSubmit={submitAnswer}
                    />
                )}

                {activeRoom?.status === 'finished' && (
                    <GameOver 
                        room={activeRoom}
                        isHost={activeRoom.hostId === user.uid}
                        onRestart={restartGame}
                        onDelete={() => deleteRoom(activeRoom.id)}
                    />
                )}
            </div>
        </div>
    );
};

export default GameView;