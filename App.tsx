import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import CreativeView from './views/CreativeView';
import LabView from './views/LabView';
import CardsView from './views/CardsView';
import PronunciaView from './views/PronunciaView';
import EmptyState from './components/EmptyState';
import IntroScreen from './components/Gamification/IntroScreen';
import SessionSummary from './components/Gamification/SessionSummary';
import BonusCelebration from './components/Gamification/BonusCelebration';
import { useStats } from './hooks/useStats';
import { useStudyItems } from './hooks/useStudyItems';
import { useUserProfile } from './hooks/useUserProfile';
import { usePuterSpeech } from './hooks/usePuterSpeech';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useGamification } from './hooks/useGamification';
import { useLeaderboard } from './hooks/useLeaderboard';
import { studyData as staticData } from './constants';
import { StudyItem, Stats, Keyword, SessionStats } from './types';

const PUTER_SUGGESTION_KEY = 'puter_suggestion_shown';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [tab, setTab] = useState<string>('leitura');
    const [showStats, setShowStats] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [initialImportFolder, setInitialImportFolder] = useState('');
    const [showPuterSuggestion, setShowPuterSuggestion] = useState(false);
    const [selectedGame, setSelectedGame] = useState<'selector' | 'lingoarena' | 'polyquest' | 'domino'>('selector');
    const [isGameFullscreen, setIsGameFullscreen] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [finalSessionStats, setFinalSessionStats] = useState<SessionStats | null>(null);

    const { items: firebaseItems, addItem, deleteItem, updateItem, clearLibrary, exportData, importData, loading: itemsLoading } = useStudyItems(user?.uid);
    const { savedIds: cloudSavedIds, stats: cloudStats, totalScore: cloudTotalScore, activeFolderFilters, updateFavorites: updateCloudFavorites, updateStats: updateCloudStats, updateFolderFilters, loading: statsLoading } = useUserProfile(user?.uid);
    const { isPuterConnected, connectPuter, disconnectPuter, puterUsername } = usePuterSpeech();
    const { engine, setEngine } = useSpeechRecognition();

    const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);
    const { stats: localStats, recordResult: recordLocalResult, clearStats: clearLocalStats } = useStats();

    const activeSavedIds = user ? cloudSavedIds : localSavedIds;
    const activeStats = user ? cloudStats : localStats;

    // Gamification hook
    const handleGamificationStatsUpdate = useCallback((stats: Stats) => {
        if (user) {
            updateCloudStats(stats);
        }
    }, [user, updateCloudStats]);

    const gamification = useGamification(activeStats, handleGamificationStatsUpdate);
    const { entries: leaderboard, userRank, loading: leaderboardLoading, updateUserScore } = useLeaderboard(user?.uid);
    const lastLeaderboardUpdateRef = React.useRef<number>(0);

    // Update leaderboard score when stats change (Debounced 30s)
    useEffect(() => {
        if (user && activeStats.points !== undefined) {
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

    // Flag to ensure streak is checked exactly once per session/load
    const hasCheckedStreak = useRef(false);

    // Reset flag when user changes (e.g. logout/login)
    useEffect(() => {
        hasCheckedStreak.current = false;
    }, [user]);

    // Check and update streak on app load
    useEffect(() => {
        if (user && !authLoading && !itemsLoading && !statsLoading && !hasCheckedStreak.current) {
            // SAFETY CHECK: If streak is 0, we might still be waiting for the real value from Firebase.
            // Unless it's a brand new user (who has no stats)

            const hasData = activeStats.streak > 0 || activeStats.lastLoginDate || Object.keys(activeStats.wordCounts || {}).length > 0;

            if (hasData) {
                const updatedStats = gamification.checkAndUpdateStreak(activeStats);

                // Only update if something actually changed to avoid loop
                // Note: checkAndUpdateStreak might return same object now, but let's be safe
                if (updatedStats.streak !== activeStats.streak || updatedStats.lastLoginDate !== activeStats.lastLoginDate) {
                    console.log('[APP DEBUG] Updating streak from', activeStats.streak, 'to', updatedStats.streak);
                    updateCloudStats(updatedStats);
                } else {
                    console.log('[APP DEBUG] Streak check passed, no changes.');
                }
                // Mark as checked to prevent future re-runs
                hasCheckedStreak.current = true;
            } else {
                console.log('[APP DEBUG] Skipping streak check - stats seem empty/default');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, itemsLoading, statsLoading, activeStats]);

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

    // Reset game selection when changing tabs
    useEffect(() => {
        if (tab !== 'jogo') {
            setSelectedGame('selector');
        }
    }, [tab]);

    const libraryData = useMemo(() => [...firebaseItems, ...staticData], [firebaseItems]);

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
                correct: (prev.correct || 0) + (isCorrect ? 1 : 0),
                wrong: (prev.wrong || 0) + (!isCorrect ? 1 : 0),
                history: !isCorrect
                    ? [{ word, date: new Date().toLocaleDateString('pt-BR'), time: new Date().toLocaleTimeString('pt-BR'), type }, ...prev.history].slice(0, 50)
                    : prev.history,
                wordCounts: { ...currentCounts, [word]: newCount },
                // Preserve gamification fields
                ...gamification.getUpdatedStats()
            };
            updateCloudStats(newStats);
        } else {
            recordLocalResult(isCorrect, word, type);
        }
    };

    const handleImportBatch = async (newItems: StudyItem[], folderPath: string) => {
        if (!user) {
            alert("Você precisa estar logado para salvar textos na nuvem.");
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

        // Se importação bem sucedida e tem profile, restaura dados de perfil
        if (result.success && result.profile) {
            const { savedIds: importedSavedIds, stats: importedStats, totalScore: importedTotalScore } = result.profile;

            // savedIds: merge (união com existentes, sem duplicatas)
            if (importedSavedIds?.length) {
                const mergedIds = [...new Set([...cloudSavedIds, ...importedSavedIds])];
                await updateCloudFavorites(mergedIds);
            }

            // stats: substituir pelos importados
            if (importedStats) {
                await updateCloudStats(importedStats);
            }

            // totalScore: Podemos adicionar lógica aqui se necessário no futuro
            console.log('Profile restaurado:', { importedSavedIds, importedStats, importedTotalScore });
        }

        return result;
    };

    // Export only selected items (text/folder) without stats
    const handleExportTextApp = () => {
        // Filter items based on active folder filters (if any)
        let selectedItems = libraryData;

        if (activeFolderFilters && activeFolderFilters.length > 0) {
            selectedItems = libraryData.filter(item => {
                if (!item.folderPath) {
                    return activeFolderFilters.includes('__uncategorized__');
                }
                return activeFolderFilters.some(filter =>
                    item.folderPath === filter || item.folderPath?.startsWith(filter + '/')
                );
            });
        }

        if (selectedItems.length === 0) {
            alert('❌ Nenhum item para exportar.');
            return;
        }

        // Export only essential fields (no performance stats)
        const cleanItems = selectedItems.map(item => ({
            id: item.id,
            chinese: item.chinese,
            pinyin: item.pinyin,
            translation: item.translation,
            tokens: item.tokens,
            keywords: item.keywords,
            language: item.language,
            type: item.type,
            originalSentence: item.originalSentence,
            folderPath: item.folderPath,
        }));

        const blob = new Blob([JSON.stringify({ items: cleanItems }, null, 2)], { type: 'application/json' });

        // Prompt user for filename
        const defaultName = `memorizatudo-texto-${new Date().toISOString().split('T')[0]}`;
        const fileName = prompt('Nome do arquivo:', defaultName);
        if (!fileName) return; // User cancelled

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`✅ Exportados ${cleanItems.length} itens com sucesso!`);
    };

    // Import text/folder JSON (items only, no stats)
    const handleImportTextFile = async (file: File): Promise<{ success: boolean; count: number; error?: string }> => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.items || !Array.isArray(data.items)) {
                return { success: false, count: 0, error: 'Arquivo inválido. Deve conter um array "items".' };
            }

            // Add items to library using existing addItem function
            // Reverse order since display shows newest first
            let importedCount = 0;
            const itemsToImport = [...data.items].reverse();

            for (const item of itemsToImport) {
                // Skip if invalid
                if (!item.chinese || !item.translation) continue;

                // Create clean item for import (Firebase doesn't accept undefined)
                const newItem: StudyItem = {
                    id: item.id || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    chinese: item.chinese,
                    pinyin: item.pinyin || '',
                    translation: item.translation,
                    tokens: item.tokens || [],
                    keywords: item.keywords || [],
                    language: item.language || 'zh',
                    type: item.type || 'text',
                };

                // Only add optional fields if they have values
                if (item.originalSentence) newItem.originalSentence = item.originalSentence;
                if (item.folderPath) newItem.folderPath = item.folderPath;

                await addItem(newItem);
                importedCount++;
            }

            return { success: true, count: importedCount };
        } catch (error: any) {
            console.error('Error importing text file:', error);
            return { success: false, count: 0, error: error.message || 'Erro ao processar arquivo JSON.' };
        }
    };

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
                        onOpenImportInFolder={handleOpenImportInFolder}
                        onDeleteText={handleDelete}
                        onSaveGeneratedCard={handleSaveGeneratedCard}
                        onUpdateItem={updateItem}
                        activeFolderFilters={activeFolderFilters}
                        onUpdateFolderFilters={updateFolderFilters}
                        userId={user?.uid}
                    />
                );
            case 'revisao': return <ReviewView data={libraryData} savedIds={activeSavedIds} onRemove={handleDelete} onUpdateLanguage={updateItem} activeFolderFilters={activeFolderFilters} />;
            case 'pratica': return <PracticeView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} />;
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
            case 'criativo':
                return (
                    <CreativeView
                        data={libraryData}
                        savedIds={activeSavedIds}
                        stats={activeStats}
                        onSave={handleSaveLabItem}
                    />
                );
            case 'cards': return <CardsView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} />;
            case 'pronuncia': return <PronunciaView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} activeFolderFilters={activeFolderFilters} />;
            default: return null;
        }
    };

    const isFullscreenGame = tab === 'jogo' && (selectedGame === 'lingoarena' || (selectedGame === 'domino' && isGameFullscreen));

    // Handle ending session (shows summary)
    const handleEndSession = () => {
        const stats = gamification.endSession();
        setFinalSessionStats(stats);
        setShowSessionSummary(true);
    };

    // Handle starting session (dismisses intro)
    const handleStartSession = () => {
        gamification.startSession();
        setShowIntro(false);
    };

    // Show IntroScreen on app load (for logged-in users)
    if (showIntro && user && !authLoading && !itemsLoading && !statsLoading) {
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
                    onResetAccount={handleResetAccount}
                    isPuterConnected={isPuterConnected}
                    puterUsername={puterUsername}
                    onConnectPuter={handleConnectPuter}
                    onDisconnectPuter={disconnectPuter}
                    onExportData={handleExportData}
                    onImportData={handleImportData}
                    onExportTextApp={handleExportTextApp}
                    onImportTextFile={handleImportTextFile}
                    engine={engine}
                    onEngineChange={setEngine}
                    streak={gamification.streak}
                    points={gamification.points}
                />
            )}
            <main className={`flex-1 overflow-y-auto w-full no-scrollbar ${isFullscreenGame ? '' : ''}`}>
                <div className={`${isFullscreenGame ? 'h-full' : 'max-w-3xl mx-auto h-full'}`}>
                    {(itemsLoading || statsLoading) && user ? <div className="p-10 text-center text-slate-300">Sincronizando...</div> : renderView()}
                </div>
            </main>
            {!isFullscreenGame && <Navigation activeTab={tab} onTabChange={setTab} />}
            {showStats && <StatsModal stats={activeStats} onClose={() => setShowStats(false)} onClear={() => user ? updateCloudStats({ correct: 0, wrong: 0, history: [], wordCounts: {} }) : clearLocalStats()} />}
            {showImport && (
                <ImportModal
                    onClose={() => { setShowImport(false); setInitialImportFolder(''); }}
                    onImport={handleImportBatch}
                    existingItems={libraryData}
                    initialFolder={initialImportFolder}
                />
            )}
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
                        setShowSessionSummary(false);
                        setFinalSessionStats(null);
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
        </div>
    );
};

export default App;
