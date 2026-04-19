import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import Header from './components/Header';
import Navigation from './components/Navigation';
import StatsModal from './components/StatsModal';
import ImportModal from './components/ImportModal';
import PuterSuggestionModal from './components/PuterSuggestionModal';
import ReadingView from './views/ReadingView';
import ReviewView from './views/ReviewView';
import PracticeView from './views/PracticeView';
import LingoArenaView from './views/LingoArenaView';
import PolyQuestView from './views/PolyQuestView';
import DominoView from './views/DominoView';
import GameSelector from './components/GameSelector';
import LabView from './views/LabView';
import CardsView from './views/CardsView';
import PronunciaView from './views/PronunciaView';
import EmptyState from './components/EmptyState';
import FolderTree from './components/FolderTree';
import IntroScreen from './components/Gamification/IntroScreen';
import SessionSummary from './components/Gamification/SessionSummary';
import BonusCelebration from './components/Gamification/BonusCelebration';
import TutorialMascot from './components/Gamification/TutorialMascot';
import RepositoryModal from './components/TextLibrary/RepositoryModal';
import NeuralSelectOverlay from './components/NeuralSelectOverlay';
import NeuralMap3D from './components/NeuralMap3D';
import FullStatsView from './views/FullStatsView';
import { useStats } from './hooks/useStats';
import { useStudyItems } from './hooks/useStudyItems';
import { useUserProfile } from './hooks/useUserProfile';
import { usePuterSpeech } from './hooks/usePuterSpeech';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useGamification } from './hooks/useGamification';
import { useDetailedStats } from './hooks/useDetailedStats';
import { useLeaderboard } from './hooks/useLeaderboard';
import { useCloudSync } from './hooks/useCloudSync';
import { useVoiceRecording } from './hooks/useVoiceRecording';
import { studyData as staticData } from './constants';
import { StudyItem, Stats, Keyword, SessionStats, StatsHistory } from './types';

const PUTER_SUGGESTION_KEY = 'puter_suggestion_shown';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [tab, setTab] = useState<string>('leitura');
    const [showStats, setShowStats] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showRepository, setShowRepository] = useState(false);
    const [initialImportFolder, setInitialImportFolder] = useState('');
    const [showPuterSuggestion, setShowPuterSuggestion] = useState(false);
    const [selectedGame, setSelectedGame] = useState<'selector' | 'lingoarena' | 'polyquest' | 'domino'>('selector');
    const [isGameFullscreen, setIsGameFullscreen] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [showGlobalFolderTree, setShowGlobalFolderTree] = useState(false);
    const [finalSessionStats, setFinalSessionStats] = useState<SessionStats | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [showNeuralSelect, setShowNeuralSelect] = useState(false);
    const [neuralWord, setNeuralWord] = useState<string | null>(null);
    const [isColorHighlightEnabled, setIsColorHighlightEnabled] = useState(() => {
        const saved = localStorage.getItem('colorHighlightEnabled');
        return saved !== null ? saved === 'true' : true; // default: true
    });

    // Persistir preferência de cores no localStorage
    useEffect(() => {
        localStorage.setItem('colorHighlightEnabled', String(isColorHighlightEnabled));
    }, [isColorHighlightEnabled]);
    const [showFullStats, setShowFullStats] = useState(false);

    const { items: localItems, addItem, deleteItem, updateItem, reorderItems, clearLibrary, exportData, importData, loading: itemsLoading, renameFolderLocal, deleteFolderLocal, uncategorizeFolderLocal } = useStudyItems(user?.uid);
    const detailedStats = useDetailedStats();
    const { savedIds: cloudSavedIds, stats: cloudStats, totalScore: cloudTotalScore, activeFolderFilters, profileLoaded, updateFavorites: updateCloudFavorites, updateStats: updateCloudStats, updateFolderFilters, updateFavoriteConfig: updateCloudFavoriteConfig } = useUserProfile(user?.uid);
    const { backupToCloud, restoreFromCloud, migrateFromFirebase, needsMigration, isSyncing } = useCloudSync(user?.uid);
    const { isPuterConnected, connectPuter, disconnectPuter, puterUsername, speak } = usePuterSpeech();
    const { engine, setEngine } = useSpeechRecognition();
    const voiceRecording = useVoiceRecording();

    // Bloqueia operações de stats até migração completar (evita zerar dados em dispositivo novo)
    const [migrationDone, setMigrationDone] = useState(false);

    const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);
    const { stats: localStats, recordResult: recordLocalResult, clearStats: clearLocalStats, toggleIgnoredReviewWord: toggleLocalIgnoredReviewWord } = useStats();

    // Filtro global das views de revisão
    const [showOnlyErrors, setShowOnlyErrors] = useState(false);

    const activeSavedIds = user ? cloudSavedIds : localSavedIds;
    const activeStats = user ? cloudStats : localStats;

    // Gamification hook
    const handleGamificationStatsUpdate = useCallback((stats: Stats) => {
        if (user && profileLoaded && migrationDone) {
            updateCloudStats(stats);
        }
    }, [user, profileLoaded, migrationDone, updateCloudStats]);

    const gamification = useGamification(activeStats, handleGamificationStatsUpdate);
    const { entries: leaderboard, userRank, loading: leaderboardLoading, updateUserScore } = useLeaderboard(user?.uid);
    const lastLeaderboardUpdateRef = React.useRef<number>(0);

    // Update leaderboard score when stats change (Debounced 30s)
    useEffect(() => {
        if (user && activeStats.points !== undefined && profileLoaded && migrationDone) {
            const now = Date.now();
            // Only update if 30s passed to save reads/writes
            if (now - lastLeaderboardUpdateRef.current > 30000) {
                updateUserScore(
                    user.uid,
                    user.displayName || 'Anônimo',
                    gamification.currentAvatar?.icon,
                    activeStats.points || 0,
                    activeStats.totalTime || 0,
                    activeStats.streak || 0,
                    activeStats.correct || 0
                );
                lastLeaderboardUpdateRef.current = now;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, activeStats.points, activeStats.totalTime, activeStats.streak, activeStats.correct]);

    // Check and update streak on app load
    useEffect(() => {
        if (user && !authLoading && !itemsLoading && profileLoaded && migrationDone) {
            const updatedStats = gamification.checkAndUpdateStreak(activeStats);
            if (updatedStats !== activeStats) {
                updateCloudStats(updatedStats);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, itemsLoading]);

    // Track tab changes for time tracking
    useEffect(() => {
        gamification.setActiveTab(tab);
    }, [tab, gamification]);

    // Auth state listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            const wasLoggedOut = !user;
            const isNowLoggedIn = !!currentUser;

            setUser(currentUser);
            setAuthLoading(false);

            // Mostra sugestão do Puter após primeiro login
            if (wasLoggedOut && isNowLoggedIn && !isPuterConnected) {
                const alreadyShown = localStorage.getItem(PUTER_SUGGESTION_KEY);
                if (!alreadyShown) {
                    // Delay para melhor UX
                    setTimeout(() => setShowPuterSuggestion(true), 1500);
                }
            }
        });
        return () => unsubscribe();
    }, [user, isPuterConnected]);

    useEffect(() => {
        if (!user) {
            const localSaved = localStorage.getItem('mandarin_hsk_recovery');
            if (localSaved) setLocalSavedIds(JSON.parse(localSaved));
        }
    }, [user]);

    // One-time migration: Firebase/Cloud -> IndexedDB local
    // CRITICAL: Deve rodar ANTES de qualquer efeito que escreva stats
    useEffect(() => {
        if (!user || authLoading) return;

        if (needsMigration()) {
            console.log('🔄 Migração necessária, iniciando...');
            migrateFromFirebase().then(result => {
                if (result.success) {
                    if (result.hasData) {
                        console.log('✅ Migração concluída, recarregando...');
                        window.location.reload();
                    } else {
                        // Usuário novo sem dados — pode prosseguir normalmente
                        setMigrationDone(true);
                    }
                } else {
                    // Erro na migração — prossegue com dados locais (vazios)
                    setMigrationDone(true);
                }
            });
        } else {
            // Já foi migrado anteriormente — segue normal
            setMigrationDone(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading]);

    // Auto-show tutorial for new users with empty library
    useEffect(() => {
        if (!authLoading && !itemsLoading && profileLoaded && migrationDone) {
            const tutorialSeen = localStorage.getItem('tutorial_seen');
            if (!tutorialSeen && !user && localItems.length === 0) {
                // Pequeno delay para não sobrepor a IntroScreen se houver
                setTimeout(() => setShowTutorial(true), 2000);
            }
        }
    }, [authLoading, itemsLoading, profileLoaded, migrationDone, user, localItems.length]);

    const libraryData = useMemo(() => [...localItems, ...staticData], [localItems]);


    const handleLogin = async () => {
        try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); }
    };

    const handleLogout = async () => {
        if (window.confirm("Deseja sair da conta?")) await signOut(auth);
    };

    const handleResetAccount = async () => {
        if (!user) return;
        const confirm1 = window.confirm("⚠️ PERIGO: Isso vai apagar TODOS os seus textos e palavras salvas.");
        if (!confirm1) return;
        const confirm2 = window.confirm("Tem certeza absoluta? Essa ação não pode ser desfeita e vai zerar seu progresso.");
        if (!confirm2) return;

        try {
            await clearLibrary();
            await updateCloudFavorites([]);
            await updateCloudStats({ correct: 0, wrong: 0, history: [], wordCounts: {} });
            alert("Banco de dados limpo com sucesso! O app está zerado.");
        } catch (error) {
            console.error(error);
            alert("Erro ao limpar dados. Tente novamente.");
        }
    };

    const handleConnectPuter = async () => {
        setShowPuterSuggestion(false);
        localStorage.setItem(PUTER_SUGGESTION_KEY, 'true');
        await connectPuter();
    };

    const handleDismissPuterSuggestion = () => {
        setShowPuterSuggestion(false);
        localStorage.setItem(PUTER_SUGGESTION_KEY, 'true');
    };

    const toggleSave = (id: string) => {
        const newIds = activeSavedIds.includes(id)
            ? activeSavedIds.filter(i => i !== id)
            : [...activeSavedIds, id];

        if (user) updateCloudFavorites(newIds);
        else {
            setLocalSavedIds(newIds);
            localStorage.setItem('mandarin_hsk_recovery', JSON.stringify(newIds));
        }
    };

    const handleSaveGeneratedCard = async (cardData: Keyword, context: string) => {
        if (!user) {
            alert("Faça login para salvar palavras.");
            return;
        }

        const newItem: Omit<StudyItem, 'id'> = {
            chinese: cardData.word,
            pinyin: cardData.pinyin,
            translation: cardData.meaning,
            tokens: [cardData.word],
            keywords: [cardData],
            language: cardData.language,
            type: 'word',
            originalSentence: context
        };

        const newId = await addItem(newItem);
        if (newId) toggleSave(newId);
    };

    const handleRecordResult = (isCorrect: boolean, word: string, type: 'general' | 'pronunciation' = 'general') => {
        // Track in gamification
        if (isCorrect) {
            gamification.recordCorrect();
        } else {
            gamification.recordWrong();
        }

        if (user) {
            const prev = activeStats;
            const currentCounts = prev.wordCounts || {};
            const newCount = !isCorrect ? (currentCounts[word] || 0) + 1 : (currentCounts[word] || 0);

            const newStats: Stats = {
                ...prev, // Preserva todos os campos existentes (lastLoginDate, studyMoreIds, etc.)
                correct: (prev.correct || 0) + (isCorrect ? 1 : 0),
                wrong: (prev.wrong || 0) + (!isCorrect ? 1 : 0),
                history: !isCorrect
                    ? [{ word, date: new Date().toLocaleDateString('pt-BR'), time: new Date().toLocaleTimeString('pt-BR'), type }, ...prev.history].slice(0, 50)
                    : prev.history,
                wordCounts: { ...currentCounts, [word]: newCount },
                // Sobrescreve com campos de gamification atualizados
                ...gamification.getUpdatedStats()
            };
            updateCloudStats(newStats);
        } else {
            recordLocalResult(isCorrect, word, type);
        }
    };

    const handleToggleIgnoreWord = (word: string) => {
        if (user) {
            const prev = activeStats;
            const currentIgnored = prev.ignoredReviewWords || [];
            const isIgnored = currentIgnored.includes(word);

            const newIgnored = isIgnored
                ? currentIgnored.filter(w => w !== word)
                : [...currentIgnored, word];

            const newStats: Stats = {
                ...prev,
                ignoredReviewWords: newIgnored
            };
            updateCloudStats(newStats);
        } else {
            toggleLocalIgnoredReviewWord(word);
        }
    };

    const handleImportBatch = async (newItems: StudyItem[], folderPath: string) => {
        if (!user) {
            alert("Você precisa estar logado para salvar textos.");
            return;
        }

        const itemsToSave = [...newItems].reverse();

        for (const item of itemsToSave) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...dataToSave } = item;
            await addItem({ ...dataToSave, folderPath });
        }

        // Limpa o folder inicial após import
        setInitialImportFolder('');
    };

    // Abre modal de importação com pasta pré-selecionada
    const handleOpenImportInFolder = (folderPath: string) => {
        setInitialImportFolder(folderPath);
        setShowImport(true);
        setShowGlobalFolderTree(false);
    };

    const handleRenameFolder = async (oldPath: string, newPath: string) => {
        if (!user?.uid) return alert("Você precisa estar logado.");

        const result = await renameFolderLocal(oldPath, newPath);
        if (result.success) {
            alert(`Pasta renomeada! ${result.updatedCount} item(s) atualizado(s).`);
        } else {
            alert(`Erro ao renomear.`);
        }
    };

    const handleMoveFolder = async (path: string) => {
        if (!user?.uid) return alert("Você precisa estar logado.");

        const folderName = path.split('/').pop() || path;
        const newParent = window.prompt(`Mover a pasta "${folderName}" para dentro de qual pasta?\n\nDeixe vazio para mover para a raiz.\nExemplo: Destino/Subpasta`);

        if (newParent === null) return; // Cancelado

        const cleanParent = newParent.trim().replace(/\/$/, ''); // Remove trailing slash if any
        const newPath = cleanParent ? `${cleanParent}/${folderName}` : folderName;

        if (newPath === path) return; // Nenhuma mudança

        const result = await renameFolderLocal(path, newPath);
        if (result.success) {
            alert(`Pasta movida para "${newPath}"! ${result.updatedCount} item(s) atualizado(s).`);
        } else {
            alert(`Erro ao mover.`);
        }
    };

    const handleDeleteFolder = async (path: string) => {
        if (!user?.uid) return alert("Você precisa estar logado.");

        const action = window.confirm(
            `Deseja excluir todos os itens da pasta "${path}"?\n\n` +
            `Clique "OK" para excluir tudo, ou "Cancelar" para mover para "Sem Categoria".`
        );

        if (action) {
            const result = await deleteFolderLocal(path);
            if (result.success) {
                alert(`${result.deletedCount} item(s) excluído(s).`);
            } else {
                alert(`Erro ao excluir.`);
            }
        } else {
            const result = await uncategorizeFolderLocal(path);
            if (result.success) {
                alert(`${result.movedCount} item(s) movido(s) para "Sem Categoria".`);
            } else {
                alert(`Erro ao mover.`);
            }
        }
    };

    const handleSaveLabItem = async (item: StudyItem) => {
        if (!user) return alert("Logue para salvar.");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = item;
        await addItem(data);
    };

    const handleDelete = async (id: string | number) => {
        if (typeof id === 'string') {
            if (window.confirm("Tem certeza que deseja excluir permanentemente esta palavra/texto?")) {
                toggleSave(id);
                await deleteItem(id);
            }
        } else {
            alert("Não é possível deletar itens padrão do sistema.");
        }
    };

    // Wrapper para exportar dados completos (inclui profile)
    const handleExportData = () => {
        exportData({
            savedIds: cloudSavedIds,
            stats: cloudStats,
            totalScore: cloudTotalScore
        });
    };

    // Wrapper para importar dados e processar profile
    const handleImportData = async (file: File, mode: 'merge' | 'replace') => {
        const result = await importData(file, mode);

        // Se importação bem sucedida e tem profile, restaura dados de perfil localmente
        if (result.success && result.profile) {
            const { savedIds: importedSavedIds, stats: importedStats, totalScore: importedTotalScore } = result.profile;

            if (importedSavedIds?.length) {
                const mergedIds = [...new Set([...cloudSavedIds, ...importedSavedIds])];
                await updateCloudFavorites(mergedIds);
            }

            if (importedStats) {
                await updateCloudStats(importedStats);
            }

            console.log('Profile restaurado localmente:', { importedSavedIds, importedStats, importedTotalScore });
        }

        return result;
    };

    // Cloud Backup/Restore handlers
    const handleBackupToCloud = async () => {
        const confirmed = window.confirm('Deseja fazer backup de todos os seus dados na nuvem?\nIsso substituirá o backup anterior.');
        if (!confirmed) return;
        const success = await backupToCloud();
        if (success) {
            alert('✅ Backup realizado com sucesso!');
        }
    };

    const handleRestoreFromCloud = async () => {
        const confirmed = window.confirm('⚠️ Restaurar backup da nuvem?\nIsso substituirá todos os dados locais pelos dados do último backup.');
        if (!confirmed) return;
        const result = await restoreFromCloud();
        if (result.success) {
            alert(`✅ Backup restaurado! ${result.itemCount} itens recuperados.\nRecarregando o app...`);
            window.location.reload(); // Recarrega para refletir dados restaurados
        }
    };

    // Handle ending session (shows summary)
    const handleEndSession = useCallback(() => {
        const stats = gamification.endSession();
        setFinalSessionStats(stats);
        setShowSessionSummary(true);

        // Somente salva se houver dados reais de estudo (evita spans vazios poluindo o db e os gráficos)
        if (stats.wordsReviewed > 0 || stats.tabTime['leitura'] > 0 || Object.values(stats.tabTime).some(t => t > 60)) {
            const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
            const date = new Date(stats.startTime).toLocaleDateString('sv-SE');

            const sessionErrors = (activeStats.history || []).slice(0, stats.wrongAnswers);

            detailedStats.saveSession({
                id,
                date,
                startTime: stats.startTime,
                endTime: stats.endTime || Date.now(),
                wordsReviewed: stats.wordsReviewed,
                correctAnswers: stats.correctAnswers,
                wrongAnswers: stats.wrongAnswers,
                tabTime: stats.tabTime,
                pointsEarned: stats.pointsEarned,
                wordsStudied: [],
                errorsLog: sessionErrors
            });
        }
    }, [gamification, activeStats.history, detailedStats]);

    // Safety net: Save session when the app is closed/reloaded
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!showIntro && gamification.sessionStats.wordsReviewed > 0) {
                // Síncrono para tentar salvar antes do unload
                handleEndSession();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [showIntro, gamification.sessionStats.wordsReviewed, handleEndSession]);

    if (authLoading) return <div className="h-screen w-full flex items-center justify-center text-slate-400">Carregando...</div>;

    const renderView = () => {
        if (!user && libraryData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6">
                    <EmptyState msg="Bem-vindo ao MemorizaTudo" icon="brain-circuit" />
                    <button onClick={handleLogin} className="bg-brand-600 text-white px-6 py-3 rounded-full font-bold shadow-lg mt-6">Entrar com Google</button>
                </div>
            );
        }

        switch (tab) {
            case 'leitura':
                return (
                    <ReadingView
                        data={libraryData}
                        savedIds={activeSavedIds}
                        onToggleSave={toggleSave}
                        onOpenImport={() => setShowImport(true)}
                        onOpenRepository={() => setShowRepository(true)}
                        onOpenImportInFolder={handleOpenImportInFolder}
                        onDeleteText={handleDelete}
                        onSaveGeneratedCard={handleSaveGeneratedCard}
                        onUpdateItem={updateItem}
                        onReorderItems={reorderItems}
                        activeFolderFilters={activeFolderFilters}
                        onUpdateFolderFilters={updateFolderFilters}
                        userId={user?.uid}
                        voiceRecording={voiceRecording}
                        isColorHighlightEnabled={isColorHighlightEnabled}
                        setIsColorHighlightEnabled={setIsColorHighlightEnabled}
                    />
                );
            case 'revisao': return <ReviewView data={libraryData} savedIds={activeSavedIds} onRemove={handleDelete} onUpdateLanguage={updateItem} activeFolderFilters={activeFolderFilters} wordCounts={activeStats.wordCounts || {}} ignoredReviewWords={activeStats.ignoredReviewWords || []} showOnlyErrors={showOnlyErrors} setShowOnlyErrors={setShowOnlyErrors} voiceRecording={voiceRecording} stats={activeStats} updateFavoriteConfig={updateCloudFavoriteConfig} />;
            case 'pratica': return <PracticeView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} showOnlyErrors={showOnlyErrors} wordCounts={activeStats.wordCounts || {}} stats={activeStats} updateFavoriteConfig={updateCloudFavoriteConfig} />;
            case 'jogo':
                if (selectedGame === 'selector') {
                    return (
                        <GameSelector onSelectGame={(game) => {
                            if (game === 'domino') {
                                // Tenta entrar em fullscreen automaticamente (Gesto do usuário válido aqui)
                                try {
                                    document.documentElement.requestFullscreen()
                                        .then(() => setIsGameFullscreen(true))
                                        .catch(e => console.log('Auto-fs failed', e));
                                } catch (e) { /* ignore */ }
                                setIsGameFullscreen(true); // Garante que a UI se adapte mesmo se o browser bloquear
                            }
                            setSelectedGame(game);
                        }} />
                    );
                } else if (selectedGame === 'lingoarena') {
                    return <LingoArenaView onBack={() => setSelectedGame('selector')} />;
                } else if (selectedGame === 'polyquest') {
                    return <PolyQuestView onBack={() => setSelectedGame('selector')} />;
                } else if (selectedGame === 'domino') {
                    return (
                        <DominoView
                            onBack={() => {
                                setSelectedGame('selector');
                                setIsGameFullscreen(false);
                            }}
                            onToggleFullscreen={setIsGameFullscreen}
                        />
                    );
                }
                return null;
            case 'lab': return <LabView data={libraryData} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} />;
            case 'cards': return <CardsView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} showOnlyErrors={showOnlyErrors} wordCounts={activeStats.wordCounts || {}} voiceRecording={voiceRecording} stats={activeStats} updateFavoriteConfig={updateCloudFavoriteConfig} />;
            case 'pronuncia': return <PronunciaView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} />;
            default: return null;
        }
    };

    const isFullscreenGame = tab === 'jogo' && (selectedGame === 'lingoarena' || (selectedGame === 'domino' && isGameFullscreen));

    // Handle starting session (dismisses intro)
    const handleStartSession = () => {
        gamification.startSession();
        setShowIntro(false);
    };

    const handleOpenSessionSummary = () => {
        setFinalSessionStats({
            ...gamification.sessionStats,
            endTime: Date.now()
        });
        setShowSessionSummary(true);
    };

    // Show IntroScreen on app load (for logged-in users)
    if (showIntro && user && !authLoading && !itemsLoading && profileLoaded) {
        return (
            <IntroScreen
                stats={activeStats}
                userName={user.displayName || 'Estudante'}
                userAvatar={gamification.currentAvatar?.icon}
                onStart={handleStartSession}
                leaderboard={leaderboard}
                userRank={userRank}
                currentUserId={user.uid}
                leaderboardLoading={leaderboardLoading}
            />
        );
    }

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 w-full overflow-hidden relative">
            {!isFullscreenGame && (
                <Header
                    user={user}
                    onLogin={handleLogin}
                    onLogout={() => {
                        handleEndSession();
                        handleLogout();
                    }}
                    onOpenStats={() => setShowStats(true)}
                    onOpenSessionSummary={handleOpenSessionSummary}
                    onOpenFolders={() => setShowGlobalFolderTree(true)}
                    onResetAccount={handleResetAccount}
                    isPuterConnected={isPuterConnected}
                    puterUsername={puterUsername}
                    onConnectPuter={handleConnectPuter}
                    onDisconnectPuter={disconnectPuter}
                    onExportData={handleExportData}
                    onImportData={handleImportData}
                    engine={engine}
                    onEngineChange={setEngine}
                    points={gamification.points}
                    onExportTextApp={() => exportData()}
                    onImportTextFile={(file) => importData(file, 'merge')}
                    onBackupToCloud={handleBackupToCloud}
                    onRestoreFromCloud={handleRestoreFromCloud}
                    isSyncing={isSyncing}
                    onOpenTutorial={() => setShowTutorial(true)}
                    onOpenNeuralMap={() => setShowNeuralSelect(true)}
                    activeTab={tab}
                />

            )}
            <main className={`flex-1 overflow-y-auto w-full no-scrollbar ${isFullscreenGame ? '' : ''}`}>
                <div className={`${isFullscreenGame ? 'h-full' : 'max-w-3xl mx-auto h-full'}`}>
                    {itemsLoading && user ? <div className="p-10 text-center text-slate-300">Carregando dados locais...</div> : renderView()}
                </div>
            </main>
            {!isFullscreenGame && <Navigation activeTab={tab} onTabChange={setTab} />}
            {showStats && <StatsModal stats={activeStats} onClose={() => setShowStats(false)} onClear={() => user ? updateCloudStats({ correct: 0, wrong: 0, history: [], wordCounts: {}, ignoredReviewWords: [] }) : clearLocalStats()} onToggleIgnoreWord={handleToggleIgnoreWord} onOpenDetailedStats={() => setShowFullStats(true)} />}
            {showFullStats && <FullStatsView detailedStats={detailedStats} libraryData={libraryData} onPlayAudio={(t, l) => speak(t, (l as any) || 'zh')} onClose={() => setShowFullStats(false)} />}
            {showImport && (
                <ImportModal
                    onClose={() => { setShowImport(false); setInitialImportFolder(''); }}
                    onImport={handleImportBatch}
                    existingItems={libraryData}
                    initialFolder={initialImportFolder}
                />
            )}
            {showRepository && (
                <RepositoryModal
                    onClose={() => setShowRepository(false)}
                    onImportSuccess={(items, folder) => {
                        handleImportBatch(items, folder);
                        setTab('leitura'); // Reset tab to see the imported item
                    }}
                />
            )}
            <FolderTree
                data={libraryData}
                selectedPaths={activeFolderFilters}
                onSelect={updateFolderFilters}
                onImportInFolder={handleOpenImportInFolder}
                onRenameFolder={handleRenameFolder}
                onMoveFolder={handleMoveFolder}
                onDeleteFolder={handleDeleteFolder}
                isOpen={showGlobalFolderTree}
                onClose={() => setShowGlobalFolderTree(false)}
            />
            {showPuterSuggestion && (
                <PuterSuggestionModal
                    onConnect={handleConnectPuter}
                    onDismiss={handleDismissPuterSuggestion}
                />
            )}
            {showSessionSummary && finalSessionStats && (
                <SessionSummary
                    sessionStats={finalSessionStats}
                    newAchievements={gamification.newAchievements}
                    newInventoryItem={gamification.newInventoryItem}
                    onClose={() => {
                        handleEndSession(); // Salva a sessão no momento em que a fecha (para não perder os dados e contar no tempo de permanência final)
                        setShowSessionSummary(false);
                        setFinalSessionStats(null);
                        handleStartSession(); // Reinicia uma nova
                    }}
                />
            )}
            {gamification.pendingBonus && (
                <BonusCelebration
                    bonusType={gamification.pendingBonus.type}
                    bonusPoints={gamification.pendingBonus.points}
                    onClose={gamification.clearPendingBonus}
                />
            )}
            {showTutorial && (
                <TutorialMascot onClose={() => setShowTutorial(false)} />
            )}
            {showNeuralSelect && (
                <NeuralSelectOverlay
                    data={libraryData}
                    savedIds={activeSavedIds}
                    activeFolderFilters={activeFolderFilters}
                    onSelectWord={(w) => { setNeuralWord(w); setShowNeuralSelect(false); }}
                    onClose={() => setShowNeuralSelect(false)}
                />
            )}
            {neuralWord && (
                <NeuralMap3D
                    word={neuralWord}
                    data={libraryData}
                    savedIds={activeSavedIds}
                    stats={activeStats}
                    onNavigate={(newWord) => setNeuralWord(newWord)}
                    onClose={() => setNeuralWord(null)}
                />
            )}
        </div>

    );
};

export default App;
