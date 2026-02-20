import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Icon from '../../components/Icon';
import { useDominoRoom } from './hooks/useDominoRoom';
import { useStudyItems } from '../../hooks/useStudyItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePuterSpeech } from '../../hooks/usePuterSpeech';
import { DominoPlayer, DominoConfig, DOMINO_CONSTANTS, TermPair, EmoteBroadcast } from './types';
import { DominoLobby } from './components/DominoLobby';
import { GameBoard } from './components/GameBoard';
import { useGameDataLoader } from '../../hooks/useGameDataLoader';

interface DominoViewProps {
    onBack?: () => void;
    onToggleFullscreen?: (isFullscreen: boolean) => void;
}

const DominoView: React.FC<DominoViewProps> = ({ onBack, onToggleFullscreen }) => {
    const [user, setUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [savedTerms, setSavedTerms] = useState<number[]>([]);
    const [roomName, setRoomName] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [config, setConfig] = useState<DominoConfig>({
        context: 'language',
        sourceLang: 'de',
        targetLang: 'pt',
        difficulty: 'Iniciante',
        selectedFolderIds: [] // Inicializa vazio
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
        removeBot,
        // Novas funções de persistência
        pausePlayer,
        resumePlayer,
        permanentLeave,
        findActiveRoomForUser,
        reorderPlayerHand,
        sendEmote
    } = useDominoRoom(userId);

    const { items } = useStudyItems(userId); // Extract items safely
    const { addItem } = useStudyItems(userId);
    const { savedIds, updateFavorites } = useUserProfile(userId);
    const { speakSequence } = usePuterSpeech();
    const gameEndTTSPlayed = useRef(false);

    // Pre-load external vocabulary for library games
    const { gamePairs } = useGameDataLoader({
        items: items,
        activeFolderIds: activeRoom?.config.selectedFolderIds || [],
        requireBothSides: true // Domino precisa de frente e verso
    });

    // Auto-rejoin: Verifica se tem sala ativa pendente ao montar
    useEffect(() => {
        if (userId && rooms.length > 0 && !activeRoom) {
            const pendingRoom = findActiveRoomForUser(rooms, userId);
            if (pendingRoom) {
                const player = pendingRoom.players.find(p => p.id === userId);
                if (player?.isPaused) {
                    // Tenta resumir o jogador pausado
                    resumePlayer(pendingRoom.id, userId).then(success => {
                        if (success) {
                            setActiveRoom(pendingRoom);
                        }
                    });
                } else {
                    // Jogador ativo na sala
                    setActiveRoom(pendingRoom);
                }
            }
        }
    }, [userId, rooms.length, activeRoom]);

    // Fullscreen functions
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => onToggleFullscreen?.(true))
                .catch(e => console.log(e));
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
                    .then(() => onToggleFullscreen?.(false))
                    .catch(e => console.log(e));
            }
        }
    };

    const enterFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => onToggleFullscreen?.(true))
                .catch(e => console.log(e));
        }
    };

    const exitFullscreen = () => {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen()
                .then(() => onToggleFullscreen?.(false))
                .catch(e => console.log(e));
        }
    };

    // Sync fullscreen state
    useEffect(() => {
        const handleFSChange = () => {
            const isFull = !!document.fullscreenElement;
            setIsFullscreen(isFull);
            onToggleFullscreen?.(isFull);
        };
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFSChange);
            onToggleFullscreen?.(false); // Reset on unmount
        };
    }, []);

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
            // Retorna ao fullscreen após criar (evita bug do teclado)
            setTimeout(() => enterFullscreen(), 100);
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

    const handleStartGame = async (configOverride?: Partial<DominoConfig>) => {
        if (activeRoom && isHost) {
            // Se for do tipo biblioteca, validamos se tem cartas suficientes
            const finalContext = configOverride?.context || activeRoom.config.context;

            if (finalContext === 'library') {
                if (gamePairs.length < 13) {
                    alert(`Sua seleção tem apenas ${gamePairs.length} cartas válidas. O dominó requer no mínimo 13 cartas de frente e verso.`);
                    return;
                }

                // Formato exigido pela engine (embora gamePairs já seja muito parecido, garantimos a tipagem)
                const genericPairs = gamePairs.map((p, idx) => ({
                    index: idx,
                    term: p.term,
                    definition: p.definition,
                    originalRefId: p.originalRefId
                }));

                await startGame(activeRoom.id, configOverride, genericPairs);
            } else {
                await startGame(activeRoom.id, configOverride);
            }
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
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Icon name="lock" size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Acesso Restrito</h2>
                <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                    Faça login para jogar Dominó Mexicano e competir com outros jogadores.
                </p>
            </div>
        );
    }

    // Loading
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full animate-in fade-in">
                <Icon name="loader" size={48} className="text-brand-500 animate-spin mb-4" />
                <p className="text-slate-400 font-medium">Conectando ao servidor...</p>
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
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                                <h2 className="text-xl font-bold text-slate-800 mb-2">Sair da Sala?</h2>
                                <p className="text-slate-600 mb-6">Você ainda poderá voltar depois.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmLeave}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors delay-75"
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
                        onReorderHand={(newOrder) => reorderPlayerHand(activeRoom.id, userId, newOrder)}
                        onSendEmote={(emote) => sendEmote(activeRoom.id, emote)}
                        onExit={() => setShowExitConfirm(true)}
                        onToggleFullscreen={toggleFullscreen}
                        isFullscreen={isFullscreen}
                    />
                    {showExitConfirm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon name="pause-circle" size={32} className="text-orange-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800 text-center mb-2">Sair do Jogo?</h2>
                                <p className="text-slate-500 text-center text-sm mb-6">
                                    Escolha como deseja sair da partida:
                                </p>

                                <div className="space-y-3">
                                    {/* Opção 1: Pausar */}
                                    <button
                                        onClick={async () => {
                                            await pausePlayer(activeRoom.id, userId);
                                            setShowExitConfirm(false);
                                            if (onBack) onBack();
                                        }}
                                        className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-3 shadow-lg"
                                    >
                                        <Icon name="pause" size={20} />
                                        <div className="text-left">
                                            <span className="block">Pausar Partida</span>
                                            <span className="text-xs font-normal opacity-80">Posso voltar em até 2 min</span>
                                        </div>
                                    </button>

                                    {/* Opção 2: Sair Permanentemente */}
                                    <button
                                        onClick={async () => {
                                            await permanentLeave(activeRoom.id, userId);
                                            setShowExitConfirm(false);
                                            if (onBack) onBack();
                                        }}
                                        className="w-full py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-3"
                                    >
                                        <Icon name="log-out" size={20} />
                                        <div className="text-left">
                                            <span className="block">Sair Permanentemente</span>
                                            <span className="text-xs font-normal opacity-80">Minhas cartas voltam ao baralho</span>
                                        </div>
                                    </button>

                                    {/* Cancelar */}
                                    <button
                                        onClick={() => setShowExitConfirm(false)}
                                        className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                                    >
                                        Continuar Jogando
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
                <div className="max-w-2xl mx-auto p-6 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-8 text-white shadow-2xl mb-8 text-center ring-4 ring-orange-200">
                        <Icon name="trophy" size={64} className="mx-auto mb-4 drop-shadow-md animate-bounce" />
                        <h2 className="text-3xl font-bold mb-2">Fim de Jogo!</h2>
                        <p className="text-xl opacity-90">
                            {winner.hand.length === 0
                                ? `${winner.name} venceu!`
                                : `${winner.name} tem menos peças!`}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Ranking Final</h3>
                        {sortedPlayers.map((p, idx) => (
                            <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl w-8 text-center">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    </span>
                                    <span className="font-medium text-slate-800">{p.name}</span>
                                </div>
                                <span className="text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded text-xs">{p.hand.length} peças</span>
                            </div>
                        ))}
                    </div>

                    {/* Salvar Termos */}
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <Icon name="bookmark" size={20} className="text-orange-500" />
                            Salvar Termos da Partida
                        </h3>
                        <p className="text-slate-500 text-sm mb-4">
                            Selecione os termos que deseja salvar no seu banco pessoal:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto mb-4 pr-1">
                            {activeRoom.termPairs?.map((term, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggleTermSave(idx)}
                                    className={`p-3 rounded-xl text-left text-sm transition-all border-2 ${savedTerms.includes(idx)
                                        ? 'bg-orange-50 border-orange-400 shadow-sm'
                                        : 'bg-white border-slate-100 hover:border-slate-300'
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
                                className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg hover:shadow-orange-500/30 active:scale-95"
                            >
                                Salvar {savedTerms.length} Termos
                            </button>
                        )}
                    </div>

                    <button
                        onClick={confirmLeave}
                        className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg"
                    >
                        Voltar ao Lobby
                    </button>
                </div>
            );
        }
    }

    // Lista de salas (Lobby View)
    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 shadow-2xl p-8 mb-10">
                <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none">
                    <Icon name="gamepad-2" size={300} className="text-white" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full transition-all text-white border border-white/30"
                                    title="Voltar aos Jogos"
                                >
                                    <Icon name="arrow-left" size={24} />
                                </button>
                            )}
                            <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                                Dominó Mexicano
                            </h1>
                        </div>
                        <p className="text-orange-100 text-lg max-w-lg leading-relaxed">
                            Conecte-se, aprenda e divirta-se. Jogue dominó enquanto expande seu vocabulário.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleFullscreen}
                            className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl transition-all text-white border border-white/30"
                            title={isFullscreen ? "Sair do Fullscreen" : "Modo Imersivo"}
                        >
                            <Icon name={isFullscreen ? "minimize-2" : "maximize-2"} size={24} />
                        </button>

                        <button
                            onClick={() => {
                                // Sai do fullscreen temporariamente para evitar bug visual do teclado no mobile
                                if (isFullscreen) exitFullscreen();
                                setShowCreateModal(true);
                            }}
                            className="px-8 py-4 bg-white text-orange-600 rounded-2xl font-bold flex items-center gap-3 hover:bg-orange-50 shadow-lg transform hover:scale-105 transition-all text-lg"
                        >
                            <Icon name="plus-circle" size={24} />
                            Criar Nova Sala
                        </button>
                    </div>
                </div>
            </div>

            {/* Room Filters/Header */}
            <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    Salas Disponíveis
                    <span className="text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        {rooms.filter(r => r.phase === 'lobby').length} online
                    </span>
                </h2>
            </div>

            {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <Icon name="layers" size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma sala encontrada</h3>
                    <p className="text-slate-500 mb-8 max-w-md text-center">
                        O lobby está vazio no momento. Que tal ser o primeiro a criar uma sala e convidar amigos?
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-md"
                    >
                        Criar Primeira Sala
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.filter(r => r.phase === 'lobby').map(room => (
                        <div
                            key={room.id}
                            className="group bg-white rounded-2xl p-1 shadow-sm border border-slate-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="bg-slate-50 rounded-xl p-5 h-full flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-orange-600 transition-colors">
                                            {room.name}
                                        </h3>
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            Aguardando Jogadores
                                        </span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                        <span className="text-xs font-bold text-slate-500 block text-center uppercase tracking-wider text-[10px]">
                                            Players
                                        </span>
                                        <span className="text-lg font-bold text-slate-800 block text-center leading-none mt-1">
                                            {room.players.length}<span className="text-slate-400 text-sm">/{DOMINO_CONSTANTS.MAX_PLAYERS}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="flex -space-x-2 overflow-hidden py-2 pl-1">
                                        {room.players.map((p, i) => (
                                            <div
                                                key={p.id}
                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm"
                                                title={p.name}
                                            >
                                                {p.avatarUrl ? (
                                                    <img src={p.avatarUrl} alt={p.name} className="h-full w-full rounded-full object-cover" />
                                                ) : (
                                                    p.name.charAt(0)
                                                )}
                                            </div>
                                        ))}
                                        {Array.from({ length: Math.max(0, DOMINO_CONSTANTS.MAX_PLAYERS - room.players.length) }).map((_, i) => (
                                            <div
                                                key={`empty-${i}`}
                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center"
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleJoinRoom(room.id)}
                                    disabled={room.players.length >= DOMINO_CONSTANTS.MAX_PLAYERS}
                                    className="w-full mt-4 py-3 bg-white text-slate-700 border-2 border-slate-200 rounded-xl font-bold hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-all disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-700"
                                >
                                    {room.players.length >= DOMINO_CONSTANTS.MAX_PLAYERS ? 'Sala Cheia' : 'Entrar na Sala'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Criar Sala */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <Icon name="plus-circle" className="text-orange-500" />
                                    Criar Nova Sala
                                </h2>
                                <p className="text-slate-500 mt-1">Configure sua sala e convide amigos.</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <Icon name="x" size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Sala</label>
                                <input
                                    type="text"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="Ex: Dominó dos Amigos"
                                    className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-6 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                disabled={!roomName.trim()}
                                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-orange-500/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                            >
                                Criar Sala
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DominoView;
