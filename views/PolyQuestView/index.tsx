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
import { usePuterSpeech } from '../../hooks/usePuterSpeech';
import { processTextWithGemini } from '../../services/gemini';

interface PolyQuestViewProps {
    onBack?: () => void;
}

const PolyQuestView: React.FC<PolyQuestViewProps> = ({ onBack }) => {
    const [user, setUser] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showOriginalText, setShowOriginalText] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [savingToReading, setSavingToReading] = useState(false);
    const { speak } = usePuterSpeech();

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
    const { savedIds, updateFavorites, totalScore } = useUserProfile(user?.uid);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return () => unsubscribe();
    }, []);

    // Trava de Navegação (Back Button / Refresh)
    useEffect(() => {
        if (!activeRoom) return;

        // 1. Bloqueia botão voltar do navegador/celular
        const blockBack = () => {
            history.pushState(null, '', location.href);
            setShowExitConfirm(true);
        };

        // Adiciona estado inicial para podermos "voltar" para o mesmo lugar
        history.pushState(null, '', location.href);
        window.addEventListener('popstate', blockBack);

        // 2. Bloqueia fechar aba/recarregar
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
        text: string,
        tokens: string[],
        difficulty: string,
        context?: string,
        selectedFolderIds?: string[]
    ) => {
        const player = createPlayerFromUser(user, totalScore);
        const roomId = await createRoom(
            roomName,
            {
                sourceLang,
                targetLang,
                originalText: text,
                tokens,
                minWords: 40,
                difficulty,
                context,
                selectedFolderIds,
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
        const player = createPlayerFromUser(user, totalScore);
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
            setShowExitConfirm(true);
        }
    };

    const confirmLeave = async () => {
        if (activeRoom) {
            await leaveRoom(activeRoom.id, user.uid);
            setShowExitConfirm(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (activeRoom) {
            await deleteRoom(activeRoom.id);
            setShowExitConfirm(false); // Caso estivesse aberto
        }
    };

    const handleToggleReady = async () => {
        if (!activeRoom) return;
        const currentPlayer = activeRoom.players.find(p => p.id === user.uid);
        if (currentPlayer) {
            await toggleReady(activeRoom.id, user.uid, !currentPlayer.isReady);
        }
    };

    const handleUpdateConfig = async (sourceLang: string, targetLang: string, text: string, difficulty: string, context?: string, selectedFolderIds?: string[]) => {
        if (!activeRoom) return;
        await updateConfig(activeRoom.id, {
            sourceLang,
            targetLang,
            originalText: text,
            difficulty,
            context,
            selectedFolderIds
        });
    };

    const handleTriggerIntruder = async (word: string) => {
        if (!activeRoom) return;
        await triggerIntruder(activeRoom.id, word);
    };

    const handleSaveItems = async (itemsToSave: { word: string; translation: string; context: string }[]) => {
        if (!activeRoom || !user) return;

        const newIds: string[] = [];

        for (const item of itemsToSave) {
            // FIX: Ensure tokens and keywords are populated so ReadingView/Cards don't crash or hide it
            const newId = await addItem({
                chinese: item.word,
                translation: item.translation,
                pinyin: '', // Fallback empty
                tokens: [item.word], // Must be an array with the word itself
                keywords: [{
                    id: Date.now().toString() + Math.random().toString().slice(2), // Temp ID
                    word: item.word,
                    pinyin: '',
                    meaning: item.translation,
                    language: activeRoom.config.sourceLang as any // Idioma do texto original
                }],
                language: activeRoom.config.sourceLang as any, // Idioma do texto original para TTS
                type: 'word',
                originalSentence: item.context // Usa o contexto real do texto original
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

                    {/* Botão Texto Original - visível durante quest/exploration */}
                    {activeRoom && (activeRoom.phase === 'quest' || activeRoom.phase === 'exploration') && (
                        <button
                            onClick={() => setShowOriginalText(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                            title="Ver texto original"
                        >
                            <Icon name="book-open" size={20} />
                            <span className="hidden sm:inline text-sm">Texto</span>
                        </button>
                    )}

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

            {/* Modal Texto Original */}
            {showOriginalText && activeRoom && (
                <div className="fixed inset-0 bg-black/70 z-50 flex flex-col animate-in fade-in duration-200">
                    <div className="bg-white p-4 border-b shadow-sm flex items-center justify-center relative">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="book-open" size={24} className="text-emerald-600" />
                            Texto Original
                        </h3>
                        {/* TTS Button */}
                        <button
                            onClick={() => speak(activeRoom.config.originalText, (activeRoom.config.sourceLang || 'zh') as 'zh' | 'de' | 'pt' | 'en')}
                            className="absolute left-4 flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-semibold transition-colors"
                            title="Ouvir texto"
                        >
                            <Icon name="volume-2" size={20} />
                            <span>Ouvir</span>
                        </button>
                        <button
                            onClick={() => setShowOriginalText(false)}
                            className="absolute right-4 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                        >
                            <Icon name="x" size={20} />
                            <span>Fechar</span>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                            <p className="text-lg leading-relaxed text-slate-700 whitespace-pre-line">
                                {activeRoom.config.originalText}
                            </p>
                        </div>
                        {/* Save to Reading Button */}
                        <div className="max-w-3xl mx-auto mt-4">
                            <button
                                onClick={async () => {
                                    if (!activeRoom.config.originalText) return;
                                    setSavingToReading(true);
                                    try {
                                        const studyItems = await processTextWithGemini(
                                            activeRoom.config.originalText,
                                            'direct',
                                            activeRoom.config.sourceLang as any
                                        );
                                        for (const item of studyItems) {
                                            await addItem(item);
                                        }
                                        alert(`✅ Texto salvo na aba de Leitura! (${studyItems.length} sentenças)`);
                                        setShowOriginalText(false);
                                    } catch (error) {
                                        console.error('Error saving to reading:', error);
                                        alert('❌ Erro ao salvar. Tente novamente.');
                                    } finally {
                                        setSavingToReading(false);
                                    }
                                }}
                                disabled={savingToReading || !activeRoom.config.originalText}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold transition-colors shadow-lg"
                            >
                                {savingToReading ? (
                                    <>
                                        <Icon name="loader" size={20} className="animate-spin" />
                                        <span>Processando com IA...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="download" size={20} />
                                        <span>Salvar na Aba de Leitura</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                onDeleteRoom={handleDeleteRoom}
                            />
                        ) : activeRoom.phase === 'exploration' ? (
                            <ExplorationPhase
                                room={activeRoom}
                                currentUserId={user.uid}
                                onToggleWord={(word) => toggleWordSelection(activeRoom.id, word)}
                                onFinishExploration={() => finishExploration(activeRoom.id)}
                                onUpdateConfig={(cfg) => updateConfig(activeRoom.id, cfg)}
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
                                onShowOriginalText={() => setShowOriginalText(true)}
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
                        <>
                            {/* Botão Voltar para página de jogos */}
                            {onBack && (
                                <div className="mb-4">
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                                    >
                                        <Icon name="arrow-left" size={18} />
                                        Voltar aos Jogos
                                    </button>
                                </div>
                            )}
                            <RoomList
                                rooms={rooms}
                                onJoinRoom={handleJoinRoom}
                                onCreateRoom={() => setShowCreateModal(true)}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <CreateRoomModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateRoom}
                    currentUserId={user.uid}
                />
            )}

            {/* EXIT CONFIRMATION MODAL */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-pop">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="log-out" size={32} className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Deseja sair do jogo?</h3>
                        <p className="text-slate-600 text-center mb-8">
                            Se você sair agora, seu progresso nesta partida será perdido. Os outros jogadores continuarão jogando.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmLeave}
                                className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Icon name="log-out" size={20} />
                                Sim, desejo sair
                            </button>
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Continuar Jogando
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PolyQuestView;
