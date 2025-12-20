import React, { useState, useEffect, useMemo } from 'react';
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
import GameSelector from './components/GameSelector';
import CreativeView from './views/CreativeView';
import LabView from './views/LabView';
import CardsView from './views/CardsView';
import PronunciaView from './views/PronunciaView';
import EmptyState from './components/EmptyState';
import { useStats } from './hooks/useStats';
import { useStudyItems } from './hooks/useStudyItems';
import { useUserProfile } from './hooks/useUserProfile';
import { usePuterSpeech } from './hooks/usePuterSpeech';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { studyData as staticData } from './constants';
import { StudyItem, Stats, Keyword } from './types';

const PUTER_SUGGESTION_KEY = 'puter_suggestion_shown';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [tab, setTab] = useState<string>('leitura');
    const [showStats, setShowStats] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showPuterSuggestion, setShowPuterSuggestion] = useState(false);
    const [selectedGame, setSelectedGame] = useState<'selector' | 'lingoarena' | 'polyquest'>('selector');

    const { items: firebaseItems, addItem, deleteItem, updateItem, clearLibrary, exportData, importData, loading: itemsLoading } = useStudyItems(user?.uid);
    const { savedIds: cloudSavedIds, stats: cloudStats, updateFavorites: updateCloudFavorites, updateStats: updateCloudStats } = useUserProfile(user?.uid);
    const { isPuterConnected, connectPuter, disconnectPuter, puterUsername } = usePuterSpeech();
    const { engine, setEngine } = useSpeechRecognition();

    const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);
    const { stats: localStats, recordResult: recordLocalResult, clearStats: clearLocalStats } = useStats();

    const activeSavedIds = user ? cloudSavedIds : localSavedIds;
    const activeStats = user ? cloudStats : localStats;

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
        if (user) {
            const prev = activeStats;
            const currentCounts = prev.wordCounts || {};
            const newCount = !isCorrect ? (currentCounts[word] || 0) + 1 : (currentCounts[word] || 0);

            const newStats: Stats = {
                correct: prev.correct + (isCorrect ? 1 : 0),
                wrong: prev.wrong + (!isCorrect ? 1 : 0),
                history: !isCorrect
                    ? [{ word, date: new Date().toLocaleDateString('pt-BR'), time: new Date().toLocaleTimeString('pt-BR'), type }, ...prev.history].slice(0, 50)
                    : prev.history,
                wordCounts: { ...currentCounts, [word]: newCount }
            };
            updateCloudStats(newStats);
        } else {
            recordLocalResult(isCorrect, word, type);
        }
    };

    const handleImportBatch = async (newItems: StudyItem[]) => {
        if (!user) {
            alert("Você precisa estar logado para salvar textos na nuvem.");
            return;
        }

        const itemsToSave = [...newItems].reverse();

        for (const item of itemsToSave) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...dataToSave } = item;
            await addItem(dataToSave);
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
                        onDeleteText={handleDelete}
                        onSaveGeneratedCard={handleSaveGeneratedCard}
                    />
                );
            case 'revisao': return <ReviewView data={libraryData} savedIds={activeSavedIds} onRemove={handleDelete} onUpdateLanguage={updateItem} />;
            case 'pratica': return <PracticeView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} />;
            case 'jogo':
                if (selectedGame === 'selector') {
                    return <GameSelector onSelectGame={setSelectedGame} />;
                } else if (selectedGame === 'lingoarena') {
                    return <LingoArenaView />;
                } else if (selectedGame === 'polyquest') {
                    return <PolyQuestView />;
                }
                return null;
            case 'lab': return <LabView data={libraryData} onResult={handleRecordResult} />;
            case 'criativo':
                return (
                    <CreativeView
                        data={libraryData}
                        savedIds={activeSavedIds}
                        stats={activeStats}
                        onSave={handleSaveLabItem}
                    />
                );
            case 'cards': return <CardsView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} />;
            case 'pronuncia': return <PronunciaView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} />;
            default: return null;
        }
    };

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 w-full overflow-hidden relative">
            <Header
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenStats={() => setShowStats(true)}
                onResetAccount={handleResetAccount}
                isPuterConnected={isPuterConnected}
                puterUsername={puterUsername}
                onConnectPuter={handleConnectPuter}
                onDisconnectPuter={disconnectPuter}
                onExportData={exportData}
                onImportData={importData}
                engine={engine}
                onEngineChange={setEngine}
            />
            <main className="flex-1 overflow-y-auto w-full no-scrollbar">
                <div className="max-w-3xl mx-auto h-full">
                    {itemsLoading && user ? <div className="p-10 text-center text-slate-300">Sincronizando...</div> : renderView()}
                </div>
            </main>
            <Navigation activeTab={tab} onTabChange={setTab} />
            {showStats && <StatsModal stats={activeStats} onClose={() => setShowStats(false)} onClear={() => user ? updateCloudStats({ correct: 0, wrong: 0, history: [], wordCounts: {} }) : clearLocalStats()} />}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImportBatch} />}
            {showPuterSuggestion && (
                <PuterSuggestionModal
                    onConnect={handleConnectPuter}
                    onDismiss={handleDismissPuterSuggestion}
                />
            )}
        </div>
    );
};

export default App;
