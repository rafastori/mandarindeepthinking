import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { GameRoom, GameCard } from '../types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { generateGameDeck } from '../services/gemini';
import Icon from '../components/Icon';

// Lista de Tópicos para o Jogo
const TOPICS = [
    "Comida & Bebida", "Viagem", "Trabalho", "Família", 
    "Natureza", "Cidade", "Sentimentos", "Casa", "Tecnologia", "Esportes"
];

// Função auxiliar para embaralhar o deck antes de começar
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const GameView: React.FC = () => {
    const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [user, setUser] = useState<User | null>(null);
    
    // Estados de Configuração da Partida (Inputs do Host)
    const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
    const [selectedLang, setSelectedLang] = useState<'zh'|'de'>('zh');
    const [selectedDiff, setSelectedDiff] = useState('Iniciante');
    const [loadingDeck, setLoadingDeck] = useState(false);

    // 1. Monitora Autenticação
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // 2. Monitora Salas em Tempo Real
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'gameRooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRoom));
            setGameRooms(rooms);
            
            // Mantém a sala ativa atualizada se o usuário estiver nela
            if (activeRoom) {
                const updated = rooms.find(r => r.id === activeRoom.id);
                if (updated) setActiveRoom(updated);
            }
        });
        return () => unsubscribe();
    }, [activeRoom?.id]);

    // --- AÇÕES DO LOBBY ---

    const createRoom = async () => {
        if (!user || !newRoomName) return;
        
        const newRoomData: Omit<GameRoom, 'id'> = {
            name: newRoomName,
            hostId: user.uid,
            players: [{ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' }],
            createdAt: new Date(),
            status: 'lobby',
            deck: [],
            config: {
                topic: selectedTopic,
                lang: selectedLang,
                diff: selectedDiff
            }
        };

        const docRef = await addDoc(collection(db, 'gameRooms'), newRoomData);
        // O snapshot cuidará de atualizar o estado
        setNewRoomName('');
    };

    const joinRoom = async (roomId: string) => {
        if (!user) return;
        const roomRef = doc(db, 'gameRooms', roomId);
        
        // Verifica se já não está na sala para evitar duplicatas (opcional, mas bom)
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            const data = roomSnap.data() as GameRoom;
            const isAlreadyIn = data.players.some(p => p.id === user.uid);
            
            if (!isAlreadyIn) {
                await updateDoc(roomRef, {
                    players: arrayUnion({ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' })
                });
            }
            setActiveRoom({ id: roomSnap.id, ...data } as GameRoom);
        }
    };

    const leaveRoom = async (roomId: string) => {
        if (!user) return;
        const roomRef = doc(db, 'gameRooms', roomId);
        
        await updateDoc(roomRef, {
            players: arrayRemove({ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' })
        });
        setActiveRoom(null);
    };

    // --- LÓGICA DO JOGO (HOST) ---

    // Passo 2: Gerar Cartas com IA e ir para "Review"
    const handleGenerateCards = async () => {
        if (!activeRoom || !user) return;
        setLoadingDeck(true);
        try {
            // Chama o Gemini
            const cards = await generateGameDeck(selectedTopic, selectedDiff, selectedLang);
            
            // Salva no Firestore
            const roomRef = doc(db, 'gameRooms', activeRoom.id);
            await updateDoc(roomRef, {
                deck: cards,
                status: 'review', // Muda o estado da sala para todos
                config: { topic: selectedTopic, lang: selectedLang, diff: selectedDiff }
            });
            
        } catch (e) {
            console.error(e);
            alert("Erro ao gerar cartas. Tente novamente.");
        } finally {
            setLoadingDeck(false);
        }
    };

    // Passo 4: Iniciar a Partida Oficialmente
    const startGame = async () => {
        if (!activeRoom || !user || activeRoom.hostId !== user.uid) return;
        
        // 1. Embaralha as cartas geradas
        const finalDeck = shuffleArray(activeRoom.deck);
        
        // 2. Decide quem começa (Pega o primeiro da lista ou aleatório)
        const firstPlayerId = activeRoom.players[0].id;

        // 3. Atualiza o Firestore para iniciar
        const roomRef = doc(db, 'gameRooms', activeRoom.id);
        await updateDoc(roomRef, {
            status: 'playing',
            deck: finalDeck, // Salva o deck embaralhado
            currentCardIndex: 0,
            currentTurnPlayerId: firstPlayerId
        });
    };

    const handleCancelReview = async () => {
        if (!activeRoom) return;
        const roomRef = doc(db, 'gameRooms', activeRoom.id);
        await updateDoc(roomRef, {
            status: 'lobby',
            deck: []
        });
    };

    // --- RENDERIZAÇÃO ---

    if (!user) return <div className="p-10 text-center text-slate-400">Faça login para jogar.</div>;

    // VISÃO: DENTRO DA SALA
    if (activeRoom) {
        const isHost = activeRoom.hostId === user.uid;
        const status = activeRoom.status || 'lobby';
        const deck = activeRoom.deck || [];

        return (
            <div className="flex flex-col h-full bg-slate-50">
                {/* Header da Sala */}
                <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                             <Icon name="users" size={20} className="text-brand-600"/> 
                             {activeRoom.name}
                        </h2>
                        <span className="text-xs text-slate-400">Sala ID: {activeRoom.id.slice(0,4)}</span>
                    </div>
                    <button onClick={() => leaveRoom(activeRoom.id)} className="text-red-500 font-bold text-sm bg-red-50 px-3 py-1 rounded-lg hover:bg-red-100">
                        Sair
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-24">
                    
                    {/* Lista de Jogadores */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Jogadores ({activeRoom.players.length})</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {activeRoom.players.map(player => (
                                <div key={player.id} className="flex flex-col items-center min-w-[60px]">
                                    <div className="relative">
                                        <img 
                                            src={player.avatarUrl || 'https://ui-avatars.com/api/?name='+player.name} 
                                            alt={player.name} 
                                            className="w-12 h-12 rounded-full border-2 border-white shadow-md" 
                                        />
                                        {activeRoom.hostId === player.id && (
                                            <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                                                HOST
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs mt-2 font-medium text-slate-700 truncate w-16 text-center">{player.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- FASE 1: LOBBY & CONFIGURAÇÃO --- */}
                    {status === 'lobby' && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-lg">
                                <Icon name="settings" size={24} className="text-brand-500" /> 
                                Configuração da Partida
                            </h3>

                            {isHost ? (
                                <div className="space-y-6">
                                    {/* Seletor de Língua */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Idioma</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => setSelectedLang('zh')}
                                                className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${selectedLang === 'zh' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                            >
                                                <span>🇨🇳</span> Mandarim
                                            </button>
                                            <button 
                                                onClick={() => setSelectedLang('de')}
                                                className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${selectedLang === 'de' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                            >
                                                <span>🇩🇪</span> Alemão
                                            </button>
                                        </div>
                                    </div>

                                    {/* Seletor de Dificuldade */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">2. Dificuldade</label>
                                        <select 
                                            value={selectedDiff}
                                            onChange={(e) => setSelectedDiff(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                        >
                                            <option value="Iniciante">Iniciante (A1-A2)</option>
                                            <option value="Intermediário">Intermediário (B1-B2)</option>
                                            <option value="Avançado">Avançado (C1)</option>
                                        </select>
                                    </div>

                                    {/* Seletor de Tópico */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">3. Tópico</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                            {TOPICS.map(topic => (
                                                <button
                                                    key={topic}
                                                    onClick={() => setSelectedTopic(topic)}
                                                    className={`p-3 text-sm rounded-lg text-left transition-all ${selectedTopic === topic ? 'bg-purple-100 text-purple-700 font-bold shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                    {topic}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleGenerateCards}
                                        disabled={loadingDeck}
                                        className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-200 mt-4 flex items-center justify-center gap-2 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {loadingDeck ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Criando Cartas com IA...
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="sparkles" size={20} />
                                                Gerar Partida
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                        <Icon name="clock" size={32} className="text-slate-300" />
                                    </div>
                                    <p className="font-medium">Aguardando o Host configurar a partida...</p>
                                    <p className="text-xs mt-2 text-slate-300">Prepare-se!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- FASE 2: VERIFICAÇÃO (CHECK POINT) --- */}
                    {status === 'review' && (
                        <div className="animate-in slide-in-from-bottom-4 fade-in">
                            <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                                <Icon name="info" className="text-purple-500 mt-1 flex-shrink-0" size={20} />
                                <div>
                                    <h4 className="font-bold text-purple-800 text-sm">Conferência de Cartas</h4>
                                    <p className="text-xs text-purple-600 mt-1">
                                        {isHost 
                                            ? "Verifique se as cartas geradas estão corretas antes de iniciar." 
                                            : "O Host está revisando as cartas geradas para a partida."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-4 px-1">
                                <h3 className="font-bold text-slate-700">Baralho ({deck.length} cartas)</h3>
                                {isHost && (
                                    <button 
                                        onClick={startGame}
                                        className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-green-600 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Icon name="play" size={16} />
                                        Iniciar Jogo!
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid gap-3 mb-24">
                                {deck.map((card, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-brand-200 transition-colors">
                                        <div>
                                            <p className={`font-bold text-xl mb-1 ${selectedLang === 'zh' ? 'font-chinese' : 'font-sans text-slate-800'}`}>
                                                {card.word}
                                            </p>
                                            <p className="text-brand-600 text-sm font-medium">{card.pinyin}</p>
                                        </div>
                                        <div className="text-right max-w-[50%] pl-4 border-l border-slate-100">
                                            <p className="text-slate-700 font-medium text-sm">{card.meaning}</p>
                                            <p className="text-xs text-slate-400 italic truncate mt-1 group-hover:text-slate-500 transition-colors">
                                                "{card.example}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {isHost && (
                                <button 
                                    onClick={handleCancelReview}
                                    className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white border border-slate-200 text-slate-500 px-6 py-3 rounded-full font-bold text-sm shadow-lg hover:text-red-500 hover:border-red-200 transition-all"
                                >
                                    Cancelar e Voltar
                                </button>
                            )}
                        </div>
                    )}

                    {/* --- FASE 3: JOGO (PLAYING) --- */}
                    {status === 'playing' && (
                        <div className="text-center py-20 animate-in zoom-in duration-300">
                            <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <Icon name="gamepad-2" size={48} className="text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Partida Iniciada!</h2>
                            <p className="text-slate-500 mb-8">O jogo está valendo. Boa sorte!</p>
                            
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 inline-block text-left">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Status Debug</p>
                                <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                    Turno: {activeRoom.players.find(p => p.id === activeRoom.currentTurnPlayerId)?.name}
                                    <br/>
                                    Carta Atual: {activeRoom.currentCardIndex! + 1} / {deck.length}
                                </pre>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        );
    }

    // VISÃO: LISTA DE SALAS (LOBBY GERAL)
    return (
        <div className="p-6 pb-24 h-full overflow-y-auto">
             <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 mb-8 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Icon name="gamepad-2" className="text-brand-600" /> 
                    Multiplayer
                </h2>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Nome da Sala..."
                        className="flex-1 border border-slate-200 p-3 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                    <button 
                        onClick={createRoom} 
                        disabled={!newRoomName.trim()}
                        className="bg-brand-600 text-white px-6 rounded-xl font-bold hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                    >
                        Criar
                    </button>
                </div>
            </div>
            
            <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-4 px-2">Salas Disponíveis</h3>
            <div className="space-y-3">
                {gameRooms.length === 0 && (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">Nenhuma sala criada.</p>
                        <p className="text-slate-300 text-sm">Crie a primeira sala acima!</p>
                    </div>
                )}
                
                {gameRooms.map(room => (
                    <div key={room.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className="bg-brand-100 text-brand-700 w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm">
                                {room.players.length}
                            </div>
                            <div>
                                <p className="font-bold text-slate-700 text-lg">{room.name}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${room.status === 'playing' ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                    {room.status === 'playing' ? 'Em andamento' : 'Aguardando'} • Host: {room.players.find(p=>p.id===room.hostId)?.name || '...'}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => joinRoom(room.id)} 
                            className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors"
                        >
                            Entrar
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GameView;