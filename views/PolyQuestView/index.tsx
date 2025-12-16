import React, { useState, useEffect } from 'react';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Icon from '../../components/Icon';
import { usePolyQuestRoom } from './hooks/usePolyQuestRoom';
import { createPlayerFromUser } from './utils';
import { RoomList } from './components/RoomList';
import { CreateRoomModal } from './components/CreateRoomModal';
import { PolyQuestLobby } from './components/PolyQuestLobby';

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
    } = usePolyQuestRoom(user?.uid);

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
                        // Dentro de uma sala - mostrar lobby
                        <PolyQuestLobby
                            room={activeRoom}
                            isHost={activeRoom.hostId === user.uid}
                            currentUserId={user.uid}
                            onToggleReady={handleToggleReady}
                            onUpdateConfig={handleUpdateConfig}
                            onStartGame={handleStartGame}
                            onLeaveRoom={handleLeaveRoom}
                        />
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
