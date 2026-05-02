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
import { DefeatPhase } from './components/DefeatPhase';
import TutorialOverlay from './components/TutorialOverlay';
import { useTutorial } from './hooks/useTutorial';
import { usePuterSpeech } from '../../hooks/usePuterSpeech';
import { processTextWithGemini } from '../../services/gemini';
import { THEME } from './theme';

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

    const room = usePolyQuestRoom(user?.uid);
    const { addItem } = useStudyItems(user?.uid);
    const { savedIds, updateFavorites, totalScore } = useUserProfile(user?.uid);
    const tutorial = useTutorial();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);

    // Auto-abre o tutorial na PRIMEIRA vez que o usuário logado entra na tela do PolyQuest
    // (sem sala ativa ainda — para não interromper uma partida em andamento).
    useEffect(() => {
        if (user && !room.activeRoom && !room.loading) {
            tutorial.autoOpenIfFirstTime();
        }
    }, [user, room.activeRoom, room.loading]);

    // Bloqueia voltar/refresh durante partida
    useEffect(() => {
        if (!room.activeRoom) return;
        const blockBack = () => {
            history.pushState(null, '', location.href);
            setShowExitConfirm(true);
        };
        history.pushState(null, '', location.href);
        window.addEventListener('popstate', blockBack);
        const blockReload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', blockReload);
        return () => {
            window.removeEventListener('popstate', blockBack);
            window.removeEventListener('beforeunload', blockReload);
        };
    }, [room.activeRoom]);

    if (!user) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-6 text-center ${THEME.bg} text-white -m-6`}>
                <Icon name="lock" size={48} className="text-white/30 mb-4" />
                <h2 className="text-xl font-bold mb-2">Login Necessário</h2>
                <p className="text-white/60">Faça login para entrar nas masmorras.</p>
            </div>
        );
    }

    const handleCreateRoom = async (
        roomName: string, sourceLang: string, targetLang: string, text: string,
        tokens: string[], difficulty: string, context?: string, selectedFolderIds?: string[],
    ) => {
        const player = createPlayerFromUser(user, totalScore);
        await room.createRoom(roomName, {
            sourceLang, targetLang, originalText: text, tokens, minWords: 40, difficulty, context, selectedFolderIds,
        }, player);
        // setActiveRoomId já é setado dentro do createRoom — sem race
    };

    const handleJoinRoom = async (roomId: string) => {
        const player = createPlayerFromUser(user, totalScore);
        await room.joinRoom(roomId, player);
        // idem — sem race
    };

    const handleLeaveRoom = () => { setShowExitConfirm(true); };
    const confirmLeave = async () => {
        if (room.activeRoom) await room.leaveRoom(room.activeRoom.id, user.uid);
        setShowExitConfirm(false);
    };
    const handleDeleteRoom = async () => {
        if (room.activeRoom) await room.deleteRoom(room.activeRoom.id);
        setShowExitConfirm(false);
    };

    const handleSaveItems = async (itemsToSave: { word: string; translation: string; context: string }[]) => {
        if (!room.activeRoom || !user) return;
        const newIds: string[] = [];
        for (const it of itemsToSave) {
            const newId = await addItem({
                chinese: it.word,
                translation: it.translation,
                pinyin: '',
                tokens: [it.word],
                keywords: [{
                    id: Date.now().toString() + Math.random().toString().slice(2),
                    word: it.word,
                    pinyin: '',
                    meaning: it.translation,
                    language: room.activeRoom.config.sourceLang as any,
                }],
                language: room.activeRoom.config.sourceLang as any,
                type: 'word',
                originalSentence: it.context,
            });
            if (newId) newIds.push(newId);
        }
        if (newIds.length > 0) {
            await updateFavorites([...savedIds, ...newIds]);
        }
    };

    const handleSaveHistory = async (result: any) => {
        if (!room.activeRoom || !user) return;
        await room.savePlayerHistory(room.activeRoom.id, user.uid, result);
    };

    const a = room.activeRoom;

    return (
        <div className={`flex flex-col h-full ${THEME.bg}`}>
            {/* Header global (compacto) */}
            {a && (
                <div className="bg-black/40 backdrop-blur p-3 border-b border-white/10 flex items-center gap-3 z-30">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-base">
                        ⚔️
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-black text-amber-300 truncate">{a.name}</h1>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider font-bold">{phaseLabel(a.phase)}</p>
                    </div>

                    {(a.phase === 'quest' || a.phase === 'exploration' || a.phase === 'boss') && (
                        <button
                            onClick={() => setShowOriginalText(true)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
                        >
                            <Icon name="book-open" size={14} />
                            <span className="hidden sm:inline">Texto</span>
                        </button>
                    )}

                    <button
                        onClick={tutorial.openTutorial}
                        className="p-1.5 bg-white/10 hover:bg-amber-400/20 hover:text-amber-300 text-white rounded-lg"
                        title="Ver tutorial"
                    >
                        <Icon name="help-circle" size={18} />
                    </button>

                    <button
                        onClick={handleLeaveRoom}
                        className="px-3 py-1.5 text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 rounded-lg font-bold text-xs"
                    >
                        ← Sair
                    </button>
                </div>
            )}

            {/* Modal texto original */}
            {showOriginalText && a && (
                <div className="fixed inset-0 bg-black/85 z-50 flex flex-col animate-in fade-in duration-200">
                    <div className="bg-black/60 backdrop-blur p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                            <Icon name="book-open" size={20} /> Texto Original
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => speak(a.config.originalText, (a.config.sourceLang || 'zh') as any)}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                            >
                                <Icon name="volume-2" size={16} /> Ouvir
                            </button>
                            <button
                                onClick={() => setShowOriginalText(false)}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                            >
                                <Icon name="x" size={16} /> Fechar
                            </button>
                        </div>
                    </div>
                    <div className={`flex-1 overflow-y-auto p-6 ${THEME.bg}`}>
                        <div className="max-w-3xl mx-auto bg-black/30 rounded-2xl p-6 border border-white/10">
                            <p className="text-base leading-relaxed text-white/85 whitespace-pre-line">{a.config.originalText}</p>
                        </div>
                        <div className="max-w-3xl mx-auto mt-4">
                            <button
                                onClick={async () => {
                                    if (!a.config.originalText) return;
                                    setSavingToReading(true);
                                    try {
                                        const studyItems = await processTextWithGemini(a.config.originalText, 'direct', a.config.sourceLang as any);
                                        for (const it of studyItems) await addItem(it);
                                        alert(`✅ Texto salvo na Leitura! (${studyItems.length} sentenças)`);
                                        setShowOriginalText(false);
                                    } catch (e) {
                                        alert('Erro ao salvar.');
                                    } finally {
                                        setSavingToReading(false);
                                    }
                                }}
                                disabled={savingToReading}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-900 rounded-xl font-bold"
                            >
                                {savingToReading ? <Icon name="loader" size={18} className="animate-spin" /> : <Icon name="download" size={18} />}
                                {savingToReading ? 'Processando…' : 'Salvar na Leitura'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conteúdo principal */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto">
                    {room.loading ? (
                        <div className="flex items-center justify-center h-64 text-white">
                            <Icon name="loader" size={48} className="text-amber-400 animate-spin mr-3" />
                            Carregando…
                        </div>
                    ) : a ? (
                        <PhaseRouter
                            room={a}
                            user={user}
                            api={room}
                            onShowOriginalText={() => setShowOriginalText(true)}
                            onSaveItems={handleSaveItems}
                            onSaveHistory={handleSaveHistory}
                            onResetGame={handleLeaveRoom}
                        />
                    ) : (
                        <>
                            <div className="mb-3 flex items-center justify-between gap-2">
                                {onBack ? (
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-2 px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl text-sm font-bold"
                                    >
                                        <Icon name="arrow-left" size={16} /> Voltar aos Jogos
                                    </button>
                                ) : <div />}
                                <button
                                    onClick={tutorial.openTutorial}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-amber-400/20 hover:text-amber-300 text-white rounded-xl text-sm font-bold"
                                    title="Como jogar"
                                >
                                    <Icon name="help-circle" size={16} />
                                    Como jogar
                                </button>
                            </div>
                            <RoomList
                                rooms={room.rooms}
                                onJoinRoom={handleJoinRoom}
                                onCreateRoom={() => setShowCreateModal(true)}
                            />
                        </>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <CreateRoomModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateRoom}
                    currentUserId={user.uid}
                />
            )}

            <TutorialOverlay open={tutorial.open} onClose={tutorial.closeTutorial} />

            {showExitConfirm && a && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className={`${THEME.bgPanelSolid} rounded-2xl p-6 w-full max-w-sm border border-white/15 shadow-2xl`}>
                        <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Icon name="log-out" size={28} className="text-rose-300" />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">Sair da Quest?</h3>
                        <p className="text-white/60 text-sm text-center mb-6">
                            Seu progresso nesta partida será perdido. Os outros jogadores continuam.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={confirmLeave}
                                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                                <Icon name="log-out" size={18} /> Sair
                            </button>
                            {a.hostId === user.uid && (
                                <button
                                    onClick={handleDeleteRoom}
                                    className="w-full py-3 bg-rose-700/40 hover:bg-rose-700/60 text-rose-200 font-bold rounded-xl"
                                >
                                    Deletar sala (host)
                                </button>
                            )}
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="w-full py-3 bg-white/5 text-white/80 font-bold rounded-xl"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Phase router (separado pra clareza) ───────────

interface PhaseRouterProps {
    room: any;
    user: User;
    api: ReturnType<typeof usePolyQuestRoom>;
    onShowOriginalText: () => void;
    onSaveItems: (items: { word: string; translation: string; context: string }[]) => Promise<void>;
    onSaveHistory: (result: any) => Promise<void>;
    onResetGame: () => void;
}

const PhaseRouter: React.FC<PhaseRouterProps> = ({ room, user, api, onShowOriginalText, onSaveItems, onSaveHistory, onResetGame }) => {
    const isHost = room.hostId === user.uid;

    if (room.phase === 'lobby') {
        return (
            <PolyQuestLobby
                room={room}
                isHost={isHost}
                currentUserId={user.uid}
                onToggleReady={async () => {
                    const cur = room.players.find((p: any) => p.id === user.uid);
                    if (cur) await api.toggleReady(room.id, user.uid, !cur.isReady);
                }}
                onSelectClass={async (cls) => api.setPlayerClass(room.id, user.uid, cls)}
                onUpdateConfig={(srcLang, tgtLang, text, diff, ctx, folderIds) =>
                    api.updateConfig(room.id, { sourceLang: srcLang, targetLang: tgtLang, originalText: text, difficulty: diff, context: ctx, selectedFolderIds: folderIds })
                }
                onStartGame={() => api.startGame(room.id)}
                onLeaveRoom={onResetGame}
                onDeleteRoom={() => api.deleteRoom(room.id)}
            />
        );
    }
    if (room.phase === 'exploration') {
        return (
            <ExplorationPhase
                room={room}
                currentUserId={user.uid}
                onToggleWord={(w) => api.toggleWordSelection(room.id, w)}
                onFinishExploration={() => api.finishExploration(room.id)}
                onUpdateConfig={(cfg) => api.updateConfig(room.id, cfg)}
            />
        );
    }
    if (room.phase === 'quest') {
        return (
            <QuestPhase
                room={room}
                currentUserId={user.uid}
                onSetEnigmas={(eg) => api.setEnigmas(room.id, eg)}
                onAnswer={(idx, ans, correct) => api.submitAnswer(room.id, user.uid, idx, ans, correct)}
                onLockEnigma={(idx) => api.lockEnigma(room.id, idx, user.uid)}
                onUnlockEnigma={(idx) => api.unlockEnigma(room.id, idx, user.uid)}
                onRequestHelp={(idx) => api.requestHelp(room.id, idx, user.uid)}
                onProvideHelp={(idx) => api.provideHelp(room.id, idx, user.uid)}
                onUsePerkMage={(idx) => api.usePerkMage(room.id, idx, user.uid)}
                onUsePerkBard={() => api.usePerkBard(room.id, user.uid)}
                onTriggerIntruder={(w, idx) => api.startIntruder(room.id, w, idx)}
                onShowOriginalText={onShowOriginalText}
            />
        );
    }
    if (room.phase === 'intruder') {
        return (
            <IntruderChallenge
                room={room}
                currentUserId={user.uid}
                onResolveIntruder={(w) => api.resolveIntruder(room.id, user.uid, w)}
                onTimeoutIntruder={() => api.timeoutIntruder(room.id)}
            />
        );
    }
    if (room.phase === 'boss') {
        return (
            <BossPhase
                room={room}
                currentUserId={user.uid}
                onStartBoss={(target, blocks) => api.startBoss(room.id, target, blocks)}
                onAddBlock={(text) => api.addBossBlock(room.id, text, user.uid)}
                onRemoveBlock={(id) => api.removeBossBlock(room.id, id)}
                onReorderBlocks={(order) => api.reorderBossBlocks(room.id, order)}
                onAttack={() => api.attackBoss(room.id)}
                onUsePerkWarrior={() => api.usePerkWarrior(room.id, user.uid)}
                onBossAttacks={() => api.bossAttacks(room.id)}
            />
        );
    }
    if (room.phase === 'victory') {
        return (
            <VictoryPhase
                room={room}
                currentUserId={user.uid}
                onResetGame={onResetGame}
                onSaveItems={onSaveItems}
                onSaveHistory={onSaveHistory}
            />
        );
    }
    if (room.phase === 'defeat') {
        return (
            <DefeatPhase
                room={room}
                currentUserId={user.uid}
                onResetGame={onResetGame}
                onSaveHistory={onSaveHistory}
            />
        );
    }
    return null;
};

const phaseLabel = (phase: string) => {
    const map: Record<string, string> = {
        lobby: 'Sala de Espera',
        exploration: 'Exploração',
        quest: 'Quest',
        intruder: 'Intruso!',
        boss: 'Batalha Final',
        victory: 'Vitória',
        defeat: 'Derrota',
    };
    return map[phase] || phase;
};

export default PolyQuestView;
