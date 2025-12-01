import React, { useState, useEffect, useMemo } from 'react';
import { auth, googleProvider } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import Header from './components/Header';
import Navigation from './components/Navigation';
import StatsModal from './components/StatsModal';
import PronunciationModal from './components/PronunciationModal';
import ImportModal from './components/ImportModal';
import ReadingView from './views/ReadingView';
import ReviewView from './views/ReviewView';
import PracticeView from './views/PracticeView';
import GameView from './views/GameView';
import LabView from './views/LabView';
import CardsView from './views/CardsView';
import EmptyState from './components/EmptyState';
import { useStats } from './hooks/useStats';
import { useStudyItems } from './hooks/useStudyItems';
import { useUserProfile } from './hooks/useUserProfile';
import { studyData as staticData } from './constants';
import { StudyItem, Stats } from './types';

const App: React.FC = () => {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // App State
    const [tab, setTab] = useState<string>('leitura');
    const [showStats, setShowStats] = useState(false);
    const [showPronounce, setShowPronounce] = useState(false);
    const [showImport, setShowImport] = useState(false);
    
    // Hooks
    // 1. Items do Firestore (Textos)
    const { items: firebaseItems, addItem, deleteItem, loading: itemsLoading } = useStudyItems(user?.uid);
    
    // 2. Perfil do Usuário (Favoritos e Stats na Nuvem)
    const { 
        savedIds: cloudSavedIds, 
        stats: cloudStats, 
        updateFavorites: updateCloudFavorites, 
        updateStats: updateCloudStats 
    } = useUserProfile(user?.uid);

    // 3. Estado Local (Fallback)
    const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);
    const { stats: localStats, recordResult: recordLocalResult, clearStats: clearLocalStats } = useStats();

    // Derived State (Decide se usa Nuvem ou Local)
    const activeSavedIds = user ? cloudSavedIds : localSavedIds;
    const activeStats = user ? cloudStats : localStats;

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load Local Settings (Saved IDs) - Só carrega se não estiver logado
    useEffect(() => {
        if (!user) {
            try {
                const localSaved = localStorage.getItem('mandarin_hsk_recovery');
                if (localSaved) {
                    setLocalSavedIds(JSON.parse(localSaved));
                }
            } catch (e) {
                console.error("Failed to load saved IDs", e);
            }
        }
    }, [user]);

    // Combine Data (Static + Firebase)
    const libraryData = useMemo(() => {
        return [...firebaseItems, ...staticData];
    }, [firebaseItems]);

    // Handlers
    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
            alert("Erro ao conectar com Google.");
        }
    };

    const handleLogout = async () => {
        if (window.confirm("Deseja sair da conta?")) {
            await signOut(auth);
            // Ao sair, o estado local assume (que estará vazio ou com dados antigos do localStorage)
        }
    };

    const toggleSave = (id: string) => {
        const currentList = activeSavedIds;
        const newIds = currentList.includes(id) 
            ? currentList.filter(i => i !== id) 
            : [...currentList, id];
        
        if (user) {
            updateCloudFavorites(newIds);
        } else {
            setLocalSavedIds(newIds);
            localStorage.setItem('mandarin_hsk_recovery', JSON.stringify(newIds));
        }
    };

    const handleRecordResult = (isCorrect: boolean, word: string, type: 'general' | 'pronunciation' = 'general') => {
        if (user) {
            // Lógica de cálculo de estatísticas (replicada do hook local para o cloud)
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

    const handleClearStats = () => {
        if (user) {
             const empty: Stats = { correct: 0, wrong: 0, history: [], wordCounts: {} };
             updateCloudStats(empty);
        } else {
            clearLocalStats();
        }
    };

    const handleImportBatch = async (newItems: StudyItem[]) => {
        if (!user) {
            alert("Você precisa estar logado para salvar textos na nuvem.");
            return;
        }
        
        // Iterate and add items one by one to Firestore
        // We strip the temporary ID generated by Gemini because Firestore creates its own
        for (const item of newItems) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...dataToSave } = item;
            await addItem(dataToSave);
        }
    };

    const handleSaveLabItem = async (item: StudyItem) => {
        if (!user) {
            alert("Você precisa estar logado para salvar.");
            return;
        }
        // Remove ID to create a new entry in Firestore
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataToSave } = item;
        await addItem(dataToSave);
    };

    const handleDelete = async (id: string | number) => {
        if (typeof id === 'string') {
            await deleteItem(id);
        } else {
            alert("Não é possível deletar itens padrão do sistema.");
        }
    };

    // Render Logic
    if (authLoading) {
        return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Carregando...</div>;
    }

    const renderView = () => {
        if (!user && libraryData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6">
                    <EmptyState msg="Bem-vindo ao MemorizaTudo" icon="brain-circuit" />
                    <p className="text-slate-500 mb-6 max-w-xs">Faça login para salvar seus textos, estudar e sincronizar seu progresso na nuvem.</p>
                    <button onClick={handleLogin} className="bg-brand-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-brand-700 transition-all">
                        Entrar com Google
                    </button>
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
                    />
                );
            case 'revisao':
                return <ReviewView data={libraryData} savedIds={activeSavedIds} onRemove={toggleSave} />;
            case 'pratica':
                return <PracticeView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} />;
            case 'jogo':
                return <GameView data={libraryData} onResult={handleRecordResult} />;
            case 'lab':
                return (
                    <LabView 
                        data={libraryData} 
                        savedIds={activeSavedIds} 
                        onResult={handleRecordResult} 
                        onSave={handleSaveLabItem}
                    />
                );
            case 'cards':
                return <CardsView data={libraryData} savedIds={activeSavedIds} onResult={handleRecordResult} />;
            default:
                return null;
        }
    };

    return (
        <div className="h-[100dvh] flex flex-col bg-slate-50 w-full overflow-hidden relative">
            <Header 
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onOpenStats={() => setShowStats(true)} 
                onOpenPronounce={() => setShowPronounce(true)} 
            />
            
            <main className="flex-1 overflow-y-auto w-full no-scrollbar">
                <div className="max-w-3xl mx-auto h-full">
                    {itemsLoading && user ? (
                        <div className="p-10 text-center text-slate-300">Sincronizando...</div>
                    ) : (
                        renderView()
                    )}
                </div>
            </main>
            
            <Navigation activeTab={tab} onTabChange={setTab} />
            
            {showStats && (
                <StatsModal 
                    stats={activeStats} 
                    onClose={() => setShowStats(false)} 
                    onClear={handleClearStats} 
                />
            )}
            
            {showPronounce && (
                <PronunciationModal 
                    data={libraryData} 
                    onClose={() => setShowPronounce(false)} 
                    onResult={handleRecordResult} 
                />
            )}

            {showImport && (
                <ImportModal 
                    onClose={() => setShowImport(false)}
                    onImport={handleImportBatch}
                />
            )}
        </div>
    );
};

export default App;