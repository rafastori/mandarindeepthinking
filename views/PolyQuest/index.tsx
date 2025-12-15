import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../services/firebase';
import { GamePhase, GameState, Language, Difficulty, Player, EnigmaStatus, SOSState } from './types';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameRoom from './components/GameRoom';
import SelectionPhase from './components/SelectionPhase';
import GameOver from './components/GameOver';
import { Loader2 } from 'lucide-react';
import { generateGameData } from "../../services/gemini";
import * as Firestore from './services/firestoreService';

interface PolyQuestProps {
  onBack: () => void;
}

const PLAYER_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];

const PolyQuest: React.FC<PolyQuestProps> = ({ onBack }) => {
  const [user, loadingUser] = useAuthState(auth); // Adicionei loadingUser para evitar flash
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingEnigmas, setIsLoadingEnigmas] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  
  // Novo Estado: Lista de salas para o Lobby
  const [activeRooms, setActiveRooms] = useState<GameState[]>([]);

  // 1. Efeito para Listar Salas no Lobby
  useEffect(() => {
    // Só escuta salas se não estiver jogando
    if (!roomCode) {
        const unsubscribe = Firestore.subscribeToActiveRooms((rooms) => {
            setActiveRooms(rooms);
        });
        return () => unsubscribe();
    }
  }, [roomCode]);

  // 2. Efeito para Sincronizar o Jogo Atual
  useEffect(() => {
    if (!roomCode) return;

    const unsubscribe = Firestore.subscribeToRoom(roomCode, (newData) => {
        setGameState(newData);
        // Triggers automáticos do Host
        if (newData && newData.hostId === user?.uid) {
            handleHostTriggers(newData);
        }
    });

    return () => unsubscribe();
  }, [roomCode, user]);

  const handleHostTriggers = (state: GameState) => {
      // Exemplo: Se estiver no WAITING_ROOM e todos prontos (lógica opcional de auto-start)
      // Mantive simples para não complicar, o botão manual do host já resolve.
  };

  // --- ACTIONS ---

  // Criar Sala
  const handleCreateRoom = async () => {
    if (!user) return;
    try {
        const player: Player = {
            id: user.uid,
            name: user.displayName || 'Jogador',
            avatar: (user.displayName || 'J')[0].toUpperCase(),
            score: 0,
            isReady: false,
            color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
        };

        const code = await Firestore.createRoom(player, {
            sourceLanguage: Language.GERMAN,
            targetLanguage: Language.PORTUGUESE
        });
        setRoomCode(code);
    } catch (e: any) {
        console.error("Erro ao criar sala:", e);
        setError("Erro ao criar sala: " + e.message);
    }
  };

  // Entrar em Sala
  const handleJoinRoom = async (code: string) => {
    if (!user) return;
    try {
        const player: Player = {
            id: user.uid,
            name: user.displayName || 'Viajante',
            avatar: (user.displayName || 'V')[0].toUpperCase(),
            score: 0,
            isReady: false,
            color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
        };

        await Firestore.joinRoom(code, player);
        setRoomCode(code);
    } catch (e: any) {
        console.error("Erro ao entrar:", e);
        setError("Não foi possível entrar: " + e.message);
        setTimeout(() => setError(null), 3000);
    }
  };

  // ... (Mantenha handleToggleReady, handleToggleWord, startSelection, etc. IGUAIS ao anterior)
  // Vou reimprimir as funções críticas para garantir que não quebrem

  const handleToggleReady = async (pid: string) => {
    if (!gameState || pid !== user?.uid) return;
    const updatedPlayers = gameState.players.map(p => p.id === pid ? { ...p, isReady: !p.isReady } : p);
    await Firestore.updateGameState(gameState.roomCode, { players: updatedPlayers });
  };

  const handleToggleWord = async (word: string) => {
    if (!gameState || !user) return;
    const exists = gameState.selectedWords.find(sw => sw.word === word);
    let newSelected = [...gameState.selectedWords];
    
    if (exists) {
        if (exists.userIds.includes(user.uid)) {
            const newIds = exists.userIds.filter(id => id !== user.uid);
            if (newIds.length === 0) newSelected = newSelected.filter(sw => sw.word !== word);
            else newSelected = newSelected.map(sw => sw.word === word ? { ...sw, userIds: newIds } : sw);
        } else {
            newSelected = newSelected.map(sw => sw.word === word ? { ...sw, userIds: [...sw.userIds, user.uid] } : sw);
        }
    } else {
        newSelected.push({ word, userIds: [user.uid] });
    }
    await Firestore.updateGameState(gameState.roomCode, { selectedWords: newSelected });
  };

  const startSelection = async () => {
    if (!gameState) return;
    const resetPlayers = gameState.players.map(p => ({ ...p, isReady: false }));
    await Firestore.updateGameState(gameState.roomCode, { phase: GamePhase.SELECTION, players: resetPlayers });
  };

  const startEnigmaGeneration = async (currentState: GameState) => {
    if (isLoadingEnigmas) return;
    setIsLoadingEnigmas(true);
    try {
        const enigmas = await generateGameData(
            currentState.selectedWords.map(s => s.word), 
            currentState.sourceText, 
            currentState.sourceLanguage
        );
        const statuses: EnigmaStatus[] = enigmas.map(e => ({
            id: e.id, isSolved: false, hintUsed: false, failedBy: [], sosState: SOSState.NONE, helpCount: 0
        }));
        const resetPlayers = currentState.players.map(p => ({ ...p, isReady: false }));
        await Firestore.updateGameState(currentState.roomCode, {
            enigmas, enigmaStatuses: statuses, phase: GamePhase.PLAYING, groupHealth: 100, players: resetPlayers
        });
    } catch (e) {
        alert("Erro na IA. Tente novamente.");
    } finally {
        setIsLoadingEnigmas(false);
    }
  };

  const handleGameAction = async (pid: string, type: any, points: number, eid: string | null) => {
      if (!gameState) return;
      let updates: Partial<GameState> = {};
      let currentStatuses = [...gameState.enigmaStatuses];

      if (type === 'SOLVE') {
          if (eid) {
              const statusIdx = currentStatuses.findIndex(s => s.id === eid);
              if (statusIdx >= 0) {
                  currentStatuses[statusIdx] = { ...currentStatuses[statusIdx], isSolved: true, solvedBy: pid };
                  updates.enigmaStatuses = currentStatuses;
              }
          }
          await Firestore.updatePlayerScore(gameState.roomCode, pid, (gameState.players.find(p => p.id === pid)?.score || 0) + points);
      } 
      
      if (type === 'FAIL') {
          updates.groupHealth = Math.max(0, gameState.groupHealth - 15);
          if (eid) {
             const statusIdx = currentStatuses.findIndex(s => s.id === eid);
             if (statusIdx >= 0) {
                 const currentFailed = currentStatuses[statusIdx].failedBy || [];
                 currentStatuses[statusIdx] = { ...currentStatuses[statusIdx], failedBy: [...currentFailed, pid] };
                 updates.enigmaStatuses = currentStatuses;
             }
          }
          if (updates.groupHealth === 0) updates.phase = GamePhase.GAME_OVER;
      }
      if (Object.keys(updates).length > 0) await Firestore.updateGameState(gameState.roomCode, updates);
  };

  // --- RENDER ---

  if (loadingUser) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500"/></div>;

  if (!user) {
      return (
          <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50">
              <h1 className="text-2xl font-bold mb-4 text-slate-800">Login Necessário</h1>
              <p className="text-slate-600 mb-6">Você precisa estar logado para acessar o PolyGlot Quest Multiplayer.</p>
              <button onClick={onBack} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">Voltar ao Menu</button>
          </div>
      );
  }

  // Se não tem código de sala (ou gameState ainda não carregou), mostra Lobby
  if (!roomCode || !gameState) {
      return (
        <div className="relative">
             {error && <div className="absolute top-4 left-0 right-0 mx-auto w-max bg-red-100 text-red-700 px-6 py-3 rounded-xl shadow-lg border border-red-200 z-[60]">{error}</div>}
             <Lobby 
                userName={user.displayName || 'Aventureiro'}
                userAvatar={(user.displayName || 'A')[0].toUpperCase()}
                availableRooms={activeRooms}
                onCreate={handleCreateRoom}
                onJoin={handleJoinRoom}
                onLogout={onBack}
             />
        </div>
      );
  }

  if (isLoadingEnigmas) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="animate-spin w-12 h-12 text-blue-600 mx-auto mb-4"/><p className="text-slate-600 font-bold">A IA está criando a missão...</p></div></div>;

  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-50">
        <button onClick={() => setRoomCode(null)} className="bg-white/90 px-3 py-1.5 rounded-full shadow hover:bg-white text-slate-500 text-xs font-bold border border-slate-200">
           SAIR DA SALA
        </button>
      </div>

      {gameState.phase === GamePhase.WAITING_ROOM && (
        <WaitingRoom 
            gameState={gameState} playerId={user.uid} 
            onStartSelection={startSelection} 
            onUpdateSettings={(s) => Firestore.updateGameState(gameState.roomCode, s)} 
            onToggleReady={handleToggleReady} 
        />
      )}
      
      {gameState.phase === GamePhase.SELECTION && (
        <SelectionPhase gameState={gameState} playerId={user.uid} onToggleWord={handleToggleWord} onToggleReady={handleToggleReady} />
      )}
      
      {(gameState.phase === GamePhase.PLAYING || gameState.phase === GamePhase.BOSS_FIGHT) && (
        <GameRoom gameState={gameState} playerId={user.uid} onGameAction={handleGameAction} onEndGame={() => Firestore.updateGameState(gameState.roomCode, { phase: GamePhase.GAME_OVER })} />
      )}
      
      {gameState.phase === GamePhase.GAME_OVER && (
          <GameOver gameState={gameState} onReset={() => Firestore.updateGameState(gameState.roomCode, { phase: GamePhase.LOBBY })} />
      )}
    </div>
  );
};

export default PolyQuest;