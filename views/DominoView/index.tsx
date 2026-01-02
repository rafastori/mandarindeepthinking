import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Icon from '../../components/Icon';
import { useDominoRoom } from './hooks/useDominoRoom';
import { useStudyItems } from '../../hooks/useStudyItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePuterSpeech } from '../../hooks/usePuterSpeech';
import { DominoPlayer, DominoConfig, DOMINO_CONSTANTS, TermPair } from './types';
import { DominoLobby } from './components/DominoLobby';
import { GameBoard } from './components/GameBoard';

const DominoView: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [savedTerms, setSavedTerms] = useState<number[]>([]);
    const [roomName, setRoomName] = useState('');
    const [config, setConfig] = useState<DominoConfig>({
        context: 'language',
        sourceLang: 'de',
        targetLang: 'pt',
        difficulty: 'Iniciante'
    });

    // Auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    const userId = user?.uid || '';
    const userName = user?.displayName || 'Jogador';
    const userAvatar = user?.photoURL || '';

    const {
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
        passTurn,
        addBot,
        removeBot
    } = useDominoRoom(userId);

    const { addItem } = useStudyItems(userId);
    const { savedIds, updateFavorites } = useUserProfile(userId);
    const { speakSequence } = usePuterSpeech();
    const gameEndTTSPlayed = useRef(false);

    // TTS for game end announcement
    useEffect(() => {
        if (activeRoom?.phase === 'finished' && !gameEndTTSPlayed.current) {
            gameEndTTSPlayed.current = true;

            // Find winner
            const sortedPlayers = [...activeRoom.players].sort((a, b) => a.hand.length - b.hand.length);
            const winner = sortedPlayers[0];

            // Sequential announcements
            speakSequence([
                { text: `Fim de Jogo! ${winner.name} venceu! Parabéns!`, language: 'pt' },
                { text: 'Você pode salvar as palavras do jogo ou voltar ao Lobby', language: 'pt' }
            ]);
        }

        // Reset when game restarts
        if (activeRoom?.phase === 'lobby' || activeRoom?.phase === 'playing') {
            gameEndTTSPlayed.current = false;
        }
    }, [activeRoom?.phase]);

    // Navigation Guard - bloqueia saída acidental
    useEffect(() => {
        if (!activeRoom) return;

        const blockBack = () => {
            history.pushState(null, '', location.href);
            setShowExitConfirm(true);
        };

        history.pushState(null, '', location.href);
        window.addEventListener('popstate', blockBack);

        const blockReload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', blockReload);

        return () => {
            window.removeEventListener('popstate', blockBack);
            window.removeEventListener('beforeunload', blockReload);
        };
    }, [activeRoom]);

    const currentPlayer: DominoPlayer = {
        id: userId,
        name: userName,
        avatarUrl: userAvatar,
        hand: [],
        score: 0,
        isReady: false
    };

    const isHost = activeRoom?.hostId === userId;

    const handleCreateRoom = async () => {
        if (!roomName.trim()) return;
        const id = await createRoom(roomName, config, currentPlayer);
        if (id) {
            const room = rooms.find(r => r.id === id);
            if (room) setActiveRoom(room);
            setShowCreateModal(false);
            setRoomName('');
        }
    };

    const handleJoinRoom = async (roomId: string) => {
        const success = await joinRoom(roomId, currentPlayer);
        if (success) {
            const room = rooms.find(r => r.id === roomId);
            if (room) setActiveRoom(room);
        }
    };

    const handleLeaveRoom = () => {
        if (activeRoom) {
            setShowExitConfirm(true);
        }
    };

    const confirmLeave = async () => {
        if (activeRoom) {
            await leaveRoom(activeRoom.id, userId);
            setShowExitConfirm(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (activeRoom && isHost) {
            await deleteRoom(activeRoom.id);
            setShowExitConfirm(false);
        }
    };

    const handleStartGame = async () => {
        if (activeRoom && isHost) {
            await startGame(activeRoom.id);
        }
    };

    // Salvar termos no banco pessoal
    const handleSaveTerms = async (termsToSave: TermPair[]) => {
        if (!activeRoom || !user) return;

        const newIds: string[] = [];

        for (const term of termsToSave) {
            const newId = await addItem({
                chinese: term.term,
                translation: term.definition,
                pinyin: '',
                tokens: [term.term],
                keywords: [{
                    id: Date.now().toString() + Math.random().toString().slice(2),
                    word: term.term,
                    pinyin: '',
                    meaning: term.definition,
                    language: activeRoom.config.sourceLang as any
                }],
                language: activeRoom.config.sourceLang as any,
                type: 'word',
                originalSentence: ''
            });

            if (newId) newIds.push(newId);
        }

        if (newIds.length > 0) {
            await updateFavorites([...savedIds, ...newIds]);
        }
    };

    // Se não logado
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Icon name="lock" size={64} className="text-slate-300 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
                <p className="text-slate-500">Faça login para jogar Dominó Mexicano.</p>
            </div>
        );
    }

    // Loading
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Icon name="loader" size={48} className="text-brand-500 animate-spin" />
            </div>
        );
    }

    // Em uma sala
    if (activeRoom) {
        if (activeRoom.phase === 'lobby') {
            return (
                <>
                    <DominoLobby
                        room={activeRoom}
                        isHost={isHost}
                        currentUserId={userId}
                        onToggleReady={(ready) => toggleReady(activeRoom.id, userId, ready)}
                        onUpdateConfig={(cfg) => updateConfig(activeRoom.id, cfg)}
                        onStartGame={handleStartGame}
                        onLeaveRoom={handleLeaveRoom}
                        onDeleteRoom={handleDeleteRoom}
                        onAddBot={() => addBot(activeRoom.id)}
                        onRemoveBot={(botId) => removeBot(activeRoom.id, botId)}
                    />
                    {/* Exit Confirmation Modal */}
                    {showExitConfirm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                                <h2 className="text-xl font-bold text-slate-800 mb-2">Sair da Sala?</h2>
                                <p className="text-slate-600 mb-6">Você ainda poderá voltar depois.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmLeave}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold"
                                    >
                                        Sair
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            );
        }

        if (activeRoom.phase === 'playing') {
            return (
                <>
                    <GameBoard
                        room={activeRoom}
                        currentUserId={userId}
                        onPlacePiece={(pieceId, trainId, flipped) =>
                            placePiece(activeRoom.id, pieceId, trainId, flipped)
                        }
                        onDrawPiece={() => drawPiece(activeRoom.id, userId)}
                        onPassTurn={() => passTurn(activeRoom.id, userId)}
                    />
                    {showExitConfirm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                                <h2 className="text-xl font-bold text-red-600 mb-2">⚠️ Jogo em Andamento</h2>
                                <p className="text-slate-600 mb-6">Se sair agora, você perderá sua posição no jogo.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium"
                                    >
                                        Continuar Jogando
                                    </button>
                                    <button
                                        onClick={confirmLeave}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold"
                                    >
                                        Sair
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            );
        }

        if (activeRoom.phase === 'finished') {
            const sortedPlayers = [...activeRoom.players].sort((a, b) =>
                a.hand.length - b.hand.length
            );
            const winner = sortedPlayers[0];

            const toggleTermSave = (index: number) => {
                setSavedTerms(prev =>
                    prev.includes(index)
                        ? prev.filter(i => i !== index)
                        : [...prev, index]
                );
            };

            const handleSaveSelected = async () => {
                const termsToSave = savedTerms.map(i => activeRoom.termPairs[i]);
                await handleSaveTerms(termsToSave);
                alert(`${termsToSave.length} termos salvos!`);
                setSavedTerms([]);
            };

            return (
                <div className="max-w-2xl mx-auto p-6">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-8 text-white shadow-2xl mb-8 text-center">
                        <Icon name="trophy" size={64} className="mx-auto mb-4" />
                        <h2 className="text-3xl font-bold mb-2">Fim de Jogo!</h2>
                        <p className="text-xl opacity-90">
                            {winner.hand.length === 0
                                ? `${winner.name} venceu!`
                                : `${winner.name} tem menos peças!`}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow p-6 mb-6">
                        <h3 className="font-bold text-slate-700 mb-4">Ranking Final</h3>
                        {sortedPlayers.map((p, idx) => (
                            <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''}
                                    </span>
                                    <span className="font-medium">{p.name}</span>
                                </div>
                                <span className="text-slate-500">{p.hand.length} peças</span>
                            </div>
                        ))}
                    </div>

                    {/* Salvar Termos */}
                    <div className="bg-white rounded-xl shadow p-6 mb-6">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Icon name="bookmark" size={20} className="text-orange-500" />
                            Salvar Termos
                        </h3>
                        <p className="text-slate-500 text-sm mb-4">
                            Selecione os termos que deseja salvar no seu banco pessoal:
                        </p>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto mb-4">
                            {activeRoom.termPairs?.map((term, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggleTermSave(idx)}
                                    className={`p-3 rounded-lg text-left text-sm transition-all ${savedTerms.includes(idx)
                                        ? 'bg-orange-100 border-2 border-orange-500'
                                        : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                        }`}
                                >
                                    <p className="font-bold text-slate-800 truncate">{term.term}</p>
                                    <p className="text-slate-500 truncate">{term.definition}</p>
                                </button>
                            ))}
                        </div>
                        {savedTerms.length > 0 && (
                            <button
                                onClick={handleSaveSelected}
                                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold"
                            >
                                Salvar {savedTerms.length} Termos
                            </button>
                        )}
                    </div>

                    <button
                        onClick={confirmLeave}
                        className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700"
                    >
                        Voltar ao Lobby
                    </button>
                </div>
            );
        }
    }

    // Lista de salas
    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    🎲 Dominó Mexicano
                </h1>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-700"
                >
                    <Icon name="plus" size={18} />
                    Criar Sala
                </button>
            </div>

            {rooms.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="inbox" size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Nenhuma sala disponível.</p>
                    <p className="text-sm">Crie uma nova sala para começar!</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {rooms.filter(r => r.phase === 'lobby').map(room => (
                        <div
                            key={room.id}
                            className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-shadow"
                        >
                            <div>
                                <h3 className="font-bold text-slate-800">{room.name}</h3>
                                <p className="text-sm text-slate-500">
                                    {room.players.length}/{DOMINO_CONSTANTS.MAX_PLAYERS} jogadores
                                </p>
                            </div>
                            <button
                                onClick={() => handleJoinRoom(room.id)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
                            >
                                Entrar
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Criar Sala */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Nova Sala</h2>

                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="Nome da sala"
                            className="w-full p-3 border rounded-xl mb-4"
                        />

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                disabled={!roomName.trim()}
                                className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DominoView;
