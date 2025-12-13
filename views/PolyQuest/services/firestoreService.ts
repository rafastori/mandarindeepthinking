import { 
    collection, doc, setDoc, updateDoc, onSnapshot, getDoc, arrayUnion, arrayRemove 
  } from 'firebase/firestore';
  import { db } from '../../../services/firebase'; 
  // AQUI ESTAVA O PROBLEMA: Faltava importar os Enums
  import { GameState, Player, GamePhase, Language, Difficulty } from '../types';
  
  const COLLECTION = 'polyquest_rooms';
  
  const generateRoomCode = () => `QUEST-${Math.floor(1000 + Math.random() * 9000)}`;
  
  export const createRoom = async (host: Player, settings: Partial<GameState>) => {
    const roomCode = generateRoomCode();
    const roomRef = doc(db, COLLECTION, roomCode);
  
    const initialState: GameState = {
      roomCode,
      hostId: host.id,
      phase: GamePhase.LOBBY,
      players: [host],
      
      // --- CORREÇÃO FEITA AQUI ---
      // Antes estava 'Português', agora está Language.PORTUGUESE
      targetLanguage: settings.targetLanguage || Language.PORTUGUESE,
      sourceLanguage: settings.sourceLanguage || Language.GERMAN,
      difficulty: settings.difficulty || Difficulty.BEGINNER,
      // ---------------------------
  
      sourceText: '',
      selectedWords: [],
      currentRound: 1,
      maxRounds: 5,
      enigmas: [],
      enigmaStatuses: [],
      groupHealth: 100,
      lastSolverId: null,
      consecutiveSolves: 0,
      hasIntruderHappened: false,
      ...settings 
    };
  
    await setDoc(roomRef, initialState);
    return roomCode;
  };
  
  export const joinRoom = async (roomCode: string, player: Player) => {
    const roomRef = doc(db, COLLECTION, roomCode);
    const snap = await getDoc(roomRef);
  
    if (!snap.exists()) throw new Error("Sala não encontrada!");
    
    const data = snap.data() as GameState;
    // Validamos se a sala está aberta
    if (data.phase !== GamePhase.LOBBY && data.phase !== GamePhase.WAITING_ROOM) {
        throw new Error("O jogo já começou!");
    }
  
    const isAlreadyIn = data.players.some((p: Player) => p.id === player.id);
    if (!isAlreadyIn) {
        await updateDoc(roomRef, {
          players: arrayUnion(player)
        });
    }
    
    return data;
  };
  
  export const subscribeToRoom = (roomCode: string, callback: (data: GameState) => void) => {
    const roomRef = doc(db, COLLECTION, roomCode);
    return onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as GameState);
      }
    });
  };
  
  export const updateGameState = async (roomCode: string, updates: Partial<GameState>) => {
    const roomRef = doc(db, COLLECTION, roomCode);
    await updateDoc(roomRef, updates);
  };
  
  export const updatePlayerScore = async (roomCode: string, playerId: string, newScore: number) => {
      const roomRef = doc(db, COLLECTION, roomCode);
      const snap = await getDoc(roomRef);
      if(snap.exists()) {
          const data = snap.data() as GameState;
          const updatedPlayers = data.players.map((p: Player) => p.id === playerId ? { ...p, score: newScore } : p);
          await updateDoc(roomRef, { players: updatedPlayers });
      }
  };

  // NOVA FUNÇÃO: Listar salas públicas em tempo real
export const subscribeToActiveRooms = (callback: (rooms: GameState[]) => void) => {
    const roomsRef = collection(db, COLLECTION);
    // Na vida real, você filtraria por 'phase == LOBBY', mas vamos pegar todas por enquanto
    return onSnapshot(roomsRef, (snapshot) => {
      const rooms: GameState[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as GameState;
        // Só mostra salas que estão esperando jogadores
        if (data.phase === GamePhase.LOBBY || data.phase === GamePhase.WAITING_ROOM) {
          rooms.push(data);
        }
      });
      callback(rooms);
    });
  };