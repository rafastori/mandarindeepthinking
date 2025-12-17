import React, { useState, useEffect } from 'react';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Icon from '../../components/Icon';
import { usePolyQuestRoom } from './hooks/usePolyQuestRoom';
import { createPlayerFromUser } from './utils';
import { useStudyItems } from '../../hooks/useStudyItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import { RoomList } from './components/RoomList';
import { CreateRoomModal } from './components/CreateRoomModal';
import { PolyQuestLobby } from './components/PolyQuestLobby';
import { ExplorationPhase } from './components/ExplorationPhase';
import { QuestPhase } from './components/QuestPhase';
import { IntruderChallenge } from './components/IntruderChallenge';
import { BossPhase } from './components/BossPhase';
import { VictoryPhase } from './components/VictoryPhase';

const PolyQuestView: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const {
        rooms,
        activeRoom,
        loading,
        setActiveRoom,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleReady,
        updateConfig,
        startGame,
        updateConfidence,
        toggleWordSelection,
        finishExploration,
        setEnigmas,
        submitAnswer,
        triggerIntruder,
        resolveIntruder,
        startBossPhase,
        submitBossDamage,
        addBossBlock,
        removeBossBlock,
        lockEnigma,
        unlockEnigma,
        requestHelp,
        provideHelp,
        reorderBossBlocks,
        savePlayerHistory
    } = usePolyQuestRoom(user?.uid);

    const { addItem } = useStudyItems(user?.uid);
    const { savedIds, updateFavorites } = useUserProfile(user?.uid);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Icon name="lock" size={48} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 mb-2">Login Necessário</h2>
                <p className="text-slate-500">Faça login para jogar PolyQuest</p>
            </div>
        );
    }

    const handleCreateRoom = async (
        roomName: string,
        sourceLang: string,
        targetLang: string,
        text: string
    ) => {
        const player = createPlayerFromUser(user);
        const roomId = await createRoom(
            roomName,
            {
                sourceLang,
                targetLang,
                originalText: text,
                minWords: 40,
            },
            player
        );

        if (roomId) {
            // Buscar a sala criada e definir como ativa
            const room = rooms.find(r => r.id === roomId);
            if (room) {
                setActiveRoom(room);
            }
        }
    };

    const handleJoinRoom = async (roomId: string) => {
        const player = createPlayerFromUser(user);
        const success = await joinRoom(roomId, player);

        if (success) {
            const room = rooms.find(r => r.id === roomId);
            if (room) {
                setActiveRoom(room);
            }
        }
    };

    const handleLeaveRoom = async () => {
        if (activeRoom) {
            await leaveRoom(activeRoom.id, user.uid);
        }
    };

    const handleToggleReady = async () => {
        if (!activeRoom) return;
        const currentPlayer = activeRoom.players.find(p => p.id === user.uid);
        if (currentPlayer) {
            await toggleReady(activeRoom.id, user.uid, !currentPlayer.isReady);
        }
    };

    const handleUpdateConfig = async (sourceLang: string, targetLang: string, text: string) => {
        if (!activeRoom) return;
        await updateConfig(activeRoom.id, {
            sourceLang,
            targetLang,
            originalText: text,
        });
    };

    const handleTriggerIntruder = async (word: string) => {
        if (!activeRoom) return;
        await triggerIntruder(activeRoom.id, word);
    };

    const handleSaveItems = async (enigmaIndices: number[]) => {
        if (!activeRoom || !user) return;
        const enigmasToSave = activeRoom.enigmas.filter((_, i) => enigmaIndices.includes(i));

        const newIds: string[] = [];

        for (const enigma of enigmasToSave) {
            // FIX: Ensure tokens and keywords are populated so ReadingView/Cards don't crash or hide it
            const newId = await addItem({
                chinese: enigma.word,
                translation: enigma.translation,
                pinyin: '', // Fallback empty
                tokens: [enigma.word], // Must be an array with the word itself
                keywords: [{
                    id: Date.now().toString() + Math.random().toString().slice(2), // Temp ID
                    word: enigma.word,
                    pinyin: '',
                    meaning: enigma.translation,
                    language: activeRoom.config.targetLang as any
                }],
                language: activeRoom.config.targetLang,
                type: 'word',
                originalSentence: `Projetos: PolyQuest`
            });

            if (newId) newIds.push(newId);
        }

        if (newIds.length > 0) {
            await updateFavorites([...savedIds, ...newIds]);
            // alert(`Salvo ${newIds.length} palavras nos Favoritos!`); // Optional feedback
        }
    };

    const handleSaveHistory = async (result: any) => {
        if (!activeRoom || !user) return;
        await savePlayerHistory(activeRoom.id, user.uid, result);
    };

    const handleStartGame = async () => {
        if (!activeRoom) return;
        await startGame(activeRoom.id);
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-emerald-50 to-slate-50">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm border-b">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                        <Icon name="sparkles" size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-slate-800">PolyQuest</h1>
                        <p className="text-xs text-slate-500">
                            {activeRoom ? `Sala: ${activeRoom.name}` : 'Aventura de Aprendizado Multiplayer'}
                        </p>
                    </div>
                    {activeRoom && (
                        <button
                            onClick={handleLeaveRoom}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors text-sm"
                        >
                            ← Voltar
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <Icon name="loader" size={48} className="text-emerald-600 animate-spin mx-auto mb-4" />
                                <p className="text-slate-600">Carregando...</p>
                            </div>
                        </div>
                    ) : activeRoom ? (
                        activeRoom.phase === 'lobby' ? (
                            <PolyQuestLobby
                                room={activeRoom}
                                isHost={activeRoom.hostId === user.uid}
                                currentUserId={user.uid}
                                onToggleReady={handleToggleReady}
                                onUpdateConfig={handleUpdateConfig}
                                onStartGame={handleStartGame}
                                onLeaveRoom={handleLeaveRoom}
                            />
                        ) : activeRoom.phase === 'exploration' ? (
                            <ExplorationPhase
                                room={activeRoom}
                                currentUserId={user.uid}
                                onToggleWord={(word) => toggleWordSelection(activeRoom.id, word)}
                                onFinishExploration={() => finishExploration(activeRoom.id)}
                            />
                        ) : activeRoom.phase === 'quest' ? (
                            <QuestPhase
                                room={activeRoom}
                                currentUserId={user.uid}
                                onSetEnigmas={(enigmas) => setEnigmas(activeRoom.id, enigmas)}
                                onAnswer={(idx, ans, correct) => submitAnswer(activeRoom.id, user.uid, idx, ans, correct)}
                                onUpdateConfidence={(delta) => updateConfidence(activeRoom.id, delta)}
                                onTriggerIntruder={(word) => triggerIntruder(activeRoom.id, word)}
                                onLockEnigma={(idx) => lockEnigma(activeRoom.id, idx, user.uid)}
                                onUnlockEnigma={(idx) => unlockEnigma(activeRoom.id, idx, user.uid)}
                                onRequestHelp={(idx) => requestHelp(activeRoom.id, idx, user.uid)}
                                onProvideHelp={(idx) => provideHelp(activeRoom.id, idx, user.uid)}
                            />
                        ) : activeRoom.phase === 'intruder' ? (
                            <IntruderChallenge
                                room={activeRoom}
                                currentUserId={user.uid}
                                onResolveIntruder={(word) => resolveIntruder(activeRoom.id, user.uid, word)}
                            />
                        ) : activeRoom.phase === 'boss' ? (
                            <BossPhase
                                room={activeRoom}
                                currentUserId={user.uid}
                                onStartBoss={(bossData) => startBossPhase(activeRoom.id, bossData)}
                                onDamage={(dmg, fatal) => submitBossDamage(activeRoom.id, dmg, fatal)}
                                onAddBlock={(text) => addBossBlock(activeRoom.id, text, user.uid)}
                                onRemoveBlock={(blockId) => removeBossBlock(activeRoom.id, blockId)}
                                onReorderBlocks={(order) => reorderBossBlocks(activeRoom.id, order)}
                            />
                        ) : activeRoom.phase === 'finished' ? (
                            <VictoryPhase
                                room={activeRoom}
                                currentUserId={user.uid}
                                onResetGame={handleLeaveRoom}
                                onSaveItems={handleSaveItems}
                                onSaveHistory={handleSaveHistory}
                            />
                        ) : (
                            <div className="text-center p-10">
                                <h3 className="text-xl font-bold mb-2">Fase em desenvolvimento: {activeRoom.phase}</h3>
                                <p>Em breve...</p>
                            </div>
                        )
                    ) : (
                        // Fora de sala - mostrar lista de salas
                        <RoomList
                            rooms={rooms}
                            onJoinRoom={handleJoinRoom}
                            onCreateRoom={() => setShowCreateModal(true)}
                        />
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <CreateRoomModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateRoom}
                />
            )}
        </div>
    );
};

export default PolyQuestView;
