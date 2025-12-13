import React, { useState, useEffect, useMemo } from 'react';
import { GameState, Enigma, EnigmaStatus, SOSState, GamePhase } from '../types';
import Button from './Button';
import Modal from './Modal';
import { 
  Trophy, CheckCircle, Volume2, HelpCircle, 
  Lock, BookOpen, XCircle, Heart, ZapOff,
  LifeBuoy, Sparkles, User, AlertTriangle, ArrowRight, Skull
} from 'lucide-react';

interface GameRoomProps {
  gameState: GameState;
  playerId: string;
  onGameAction: (playerId: string, actionType: 'SOLVE' | 'FAIL' | 'SOS_REQUEST' | 'SOS_PROVIDE' | 'INTRUDER_FOUND' | 'BOSS_ACTION', points: number, enigmaId: string | null) => void;
  onEndGame: () => void;
}

// Improved TTS Helper
const speakText = (text: string, langName: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const langMap: Record<string, string> = {
    'Alemão': 'de-DE', 'Inglês': 'en-US', 'Espanhol': 'es-ES', 'Francês': 'fr-FR',
    'Italiano': 'it-IT', 'Japonês': 'ja-JP', 'Português': 'pt-BR', 'Mandarim': 'zh-CN', 'Russo': 'ru-RU'
  };

  const targetLang = langMap[langName] || 'en-US';
  const voices = window.speechSynthesis.getVoices();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = targetLang;
  utterance.rate = 0.9;

  let voice = voices.find(v => v.lang === targetLang) || voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
};

const GameRoom: React.FC<GameRoomProps> = ({ gameState, playerId, onGameAction, onEndGame }) => {
  const [statuses, setStatuses] = useState<EnigmaStatus[]>(gameState.enigmaStatuses || []);
  const [selectedEnigma, setSelectedEnigma] = useState<Enigma | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  
  // Enigma Modal State
  const [modalFeedback, setModalFeedback] = useState<'correct' | 'wrong' | 'sos_sent' | 'sos_solved' | null>(null);
  const [tempDisabledOptions, setTempDisabledOptions] = useState<string[]>([]);

  // Challenge States
  const [intruderAccepted, setIntruderAccepted] = useState(false);
  
  // Boss States
  const [bossBlocks, setBossBlocks] = useState<string[]>([]); // Current order
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]); // Available to pick
  const [bossFeedback, setBossFeedback] = useState<'win' | 'fail' | null>(null);

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const currentScore = currentPlayer?.score || 0;
  
  // Fatigue Check
  const fatigueExpiresAt = currentPlayer?.fatigueExpiresAt || 0;
  const isFatigued = fatigueExpiresAt > Date.now();
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if(gameState.enigmaStatuses) {
        setStatuses(gameState.enigmaStatuses);
    }
  }, [gameState.enigmaStatuses]);

  useEffect(() => {
    if (isFatigued) {
        const interval = setInterval(() => {
            const remaining = Math.ceil((fatigueExpiresAt - Date.now()) / 1000);
            setTimeLeft(remaining > 0 ? remaining : 0);
        }, 500);
        return () => clearInterval(interval);
    }
  }, [isFatigued, fatigueExpiresAt]);

  // Init Boss Data
  useEffect(() => {
    if (gameState.phase === GamePhase.BOSS_FIGHT && gameState.bossData) {
        setAvailableBlocks(gameState.bossData.shuffledBlocks);
        setBossBlocks([]);
    }
  }, [gameState.phase, gameState.bossData]);

  const handleCardClick = (enigma: Enigma) => {
    if (isFatigued || gameState.intruderData) return;

    const status = statuses.find(s => s.id === enigma.id);
    if (!status) return;

    // Block interaction if SOS is active and I am the requester (waiting for help)
    if (status.sosState === SOSState.ACTIVE && status.sosRequesterId === playerId) return;

    // Block solved cards
    if (status.isSolved) return; 
    
    setModalFeedback(null);
    setTempDisabledOptions([]);
    setSelectedEnigma(enigma);
  };

  const currentStatus = selectedEnigma ? statuses.find(s => s.id === selectedEnigma.id) : null;
  const isFailedByMe = currentStatus?.failedBy.includes(playerId);
  const isSOSActive = currentStatus?.sosState === SOSState.ACTIVE;
  const isSOSResolved = currentStatus?.sosState === SOSState.RESOLVED_BY_ALLY;
  
  // Determine role in the modal
  const isRequester = currentStatus?.sosRequesterId === playerId;
  const isHelper = isSOSActive && !isRequester;

  const handleOptionClick = (option: string) => {
    if (!selectedEnigma || !currentStatus) return;

    const isCorrect = option === selectedEnigma.correctTranslation;

    if (isCorrect) {
        if (isHelper) {
             // Scenario: Helper solves the SOS
             setModalFeedback('sos_solved');
             onGameAction(playerId, 'SOS_PROVIDE', 0, selectedEnigma.id); // Points handled in App.tsx logic for Provides
             setTimeout(() => setSelectedEnigma(null), 1500);
        } else {
             // Scenario: Standard Solve or Requester Solving with Synonym
             setModalFeedback('correct');
             
             // Points Logic
             let points = 10;
             if (currentStatus.hintUsed) points = 5;
             if (isSOSResolved) {
                 // 1st attempt with help = 5, subsequent attempts = 3
                 points = currentStatus.helpCount > 1 ? 3 : 5;
             }

             onGameAction(playerId, 'SOLVE', points, selectedEnigma.id);
             setTimeout(() => setSelectedEnigma(null), 1500);
        }
    } else {
        // Failure Logic
        setModalFeedback('wrong');
        onGameAction(playerId, 'FAIL', 0, selectedEnigma.id);
        setTimeout(() => setSelectedEnigma(null), 1200);
    }
  };

  const handleSOSRequest = () => {
      if (!selectedEnigma) return;
      setModalFeedback('sos_sent');
      onGameAction(playerId, 'SOS_REQUEST', 0, selectedEnigma.id);
      setTimeout(() => setSelectedEnigma(null), 1200);
  };

  const handleUseHint = () => {
    if (!selectedEnigma || !currentStatus || currentStatus.hintUsed) return;
    // Just visual/local update, points handled on solve
    const newStatuses = statuses.map(s => s.id === selectedEnigma.id ? { ...s, hintUsed: true } : s);
    setStatuses(newStatuses);
    const wrongOptions = selectedEnigma.options.filter(o => o !== selectedEnigma.correctTranslation);
    const toDisable = wrongOptions.sort(() => 0.5 - Math.random()).slice(0, 2);
    setTempDisabledOptions(toDisable);
  };

  // --- INTRUDER HANDLER ---
  const handleIntruderClick = (clickedWord: string) => {
     if (!gameState.intruderData) return;
     // Clean word from punctuation for comparison if needed, though split separates simple cases
     const target = gameState.intruderData.intruderWord.trim();
     const cleanClicked = clickedWord.replace(/[.,!?;:"()]/g, '').trim();

     if (cleanClicked.toLowerCase() === target.toLowerCase()) {
         onGameAction(playerId, 'INTRUDER_FOUND', 20, null);
         setIntruderAccepted(false); // Reset for clean up
     }
  };

  // --- BOSS HANDLERS ---
  const handleBlockClick = (block: string, fromList: 'available' | 'current') => {
      if (fromList === 'available') {
          setAvailableBlocks(prev => prev.filter(b => b !== block));
          setBossBlocks(prev => [...prev, block]);
      } else {
          setBossBlocks(prev => prev.filter(b => b !== block));
          setAvailableBlocks(prev => [...prev, block]);
      }
      setBossFeedback(null);
  };

  const checkBossSolution = () => {
      if (!gameState.bossData) return;
      const userSentence = bossBlocks.join(' ').replace(/\s+/g, ' ').trim();
      const targetSentence = gameState.bossData.originalSentence.replace(/\s+/g, ' ').trim();

      // Simple normalization check (case insensitive, ignore punctuation differences for leniency)
      const normalize = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '');
      
      if (normalize(userSentence) === normalize(targetSentence)) {
          setBossFeedback('win');
          setTimeout(() => onGameAction(playerId, 'BOSS_ACTION', 50, null), 1500);
      } else {
          setBossFeedback('fail');
          onGameAction(playerId, 'BOSS_ACTION', 0, null); // 0 points signals fail handler to deduct HP
          // Reset after fail feedback
          setTimeout(() => setBossFeedback(null), 2000);
      }
  };

  const solvedCount = statuses.filter(s => s.isSolved).length;
  const totalCount = gameState.enigmas.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm transition-all">
        <div className="w-full bg-slate-100 h-2">
            <div 
                className={`h-full transition-all duration-500 ease-out ${gameState.groupHealth < 30 ? 'bg-red-500 animate-pulse' : gameState.groupHealth < 60 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                style={{ width: `${gameState.groupHealth}%` }}
            ></div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 text-slate-700" title="Confiança da Equipe">
                <Heart className={`w-5 h-5 ${gameState.groupHealth < 30 ? 'text-red-500 fill-red-500 animate-bounce' : 'text-red-500'}`} />
                <span className="font-bold">{gameState.groupHealth}%</span>
             </div>
             {gameState.phase === GamePhase.BOSS_FIGHT ? (
                 <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-bold text-sm border border-purple-200 flex items-center gap-2">
                     <Skull className="w-4 h-4"/> BOSS FINAL
                 </div>
             ) : (
                <div className="hidden sm:block bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-bold text-sm border border-blue-100">
                {solvedCount}/{totalCount} Palavras
                </div>
             )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
               <Trophy className="w-4 h-4 text-amber-500" />
               <span className="font-bold text-sm">{currentScore} pts</span>
            </div>
            {gameState.phase !== GamePhase.BOSS_FIGHT && (
                <Button variant="ghost" onClick={() => setShowFullText(true)} className="text-sm py-1.5 h-auto">
                <BookOpen className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Texto</span>
                </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 relative">
        
        {/* FATIGUE OVERLAY */}
        {isFatigued && !gameState.intruderData && (
            <div className="absolute inset-0 z-10 bg-slate-50/80 backdrop-blur-[1px] rounded-3xl flex flex-col items-center justify-center animate-in fade-in duration-300 pointer-events-none">
                <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 text-center max-w-sm mx-4 pointer-events-auto">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ZapOff className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Fadiga Tática!</h3>
                    <div className="text-2xl font-black text-blue-600 font-mono">{timeLeft}s</div>
                </div>
            </div>
        )}

        {/* BOSS FIGHT UI */}
        {gameState.phase === GamePhase.BOSS_FIGHT ? (
            <div className="bg-white rounded-3xl shadow-xl border border-purple-100 p-8 flex flex-col items-center animate-in fade-in duration-500">
                 <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                     <Skull className="w-10 h-10 text-purple-600 animate-pulse" />
                 </div>
                 <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">Desafio Final</h2>
                 <p className="text-slate-500 mb-8 text-center max-w-md">
                     Reconstrua a frase complexa para vencer. Erros custam 20% de vida!
                 </p>

                 {/* Drop Zone */}
                 <div className={`w-full min-h-[120px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 p-4 flex flex-wrap gap-2 items-center justify-center mb-8 transition-colors ${bossFeedback === 'fail' ? 'bg-red-50 border-red-300' : ''}`}>
                    {bossBlocks.length === 0 && <span className="text-slate-400 font-medium">Clique nos blocos abaixo para montar a frase...</span>}
                    {bossBlocks.map((block, idx) => (
                        <button 
                            key={`${block}-${idx}`} 
                            onClick={() => handleBlockClick(block, 'current')}
                            className="bg-white border-2 border-purple-200 text-purple-800 px-4 py-2 rounded-xl shadow-sm hover:border-red-400 hover:bg-red-50 font-bold transition-all animate-in zoom-in duration-200"
                        >
                            {block}
                        </button>
                    ))}
                 </div>

                 {/* Available Blocks */}
                 <div className="flex flex-wrap gap-3 justify-center mb-10">
                    {availableBlocks.map((block, idx) => (
                        <button 
                            key={`${block}-${idx}`} 
                            onClick={() => handleBlockClick(block, 'available')}
                            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl shadow-sm hover:border-purple-400 hover:shadow-md hover:-translate-y-1 transition-all"
                        >
                            {block}
                        </button>
                    ))}
                 </div>

                 <Button 
                    onClick={checkBossSolution}
                    disabled={availableBlocks.length > 0 || bossFeedback === 'win'}
                    className={`px-12 py-4 text-lg shadow-xl transition-all ${bossFeedback === 'win' ? 'bg-emerald-500 hover:bg-emerald-600' : bossFeedback === 'fail' ? 'bg-red-500 hover:bg-red-600 animate-shake' : 'bg-purple-600 hover:bg-purple-700'}`}
                 >
                     {bossFeedback === 'win' ? 'Vitória Gloriosa!' : bossFeedback === 'fail' ? 'Frase Incorreta! (-20% HP)' : 'Verificar Frase'}
                 </Button>
            </div>
        ) : (
            // STANDARD GRID GAMEPLAY
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gameState.enigmas.map((enigma) => {
                    const status = statuses.find(s => s.id === enigma.id);
                    const isSolved = status?.isSolved;
                    const isFailed = status?.failedBy.includes(playerId);
                    
                    // SOS States
                    const sosActive = status?.sosState === SOSState.ACTIVE;
                    const sosResolved = status?.sosState === SOSState.RESOLVED_BY_ALLY;
                    const iAsked = status?.sosRequesterId === playerId;

                    return (
                        <div 
                            key={enigma.id}
                            onClick={() => handleCardClick(enigma)}
                            className={`
                                relative aspect-[4/3] rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm border-2
                                ${isFatigued || gameState.intruderData ? 'cursor-not-allowed grayscale opacity-50' : 'cursor-pointer'}
                                ${isSolved 
                                    ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100' 
                                    : sosActive
                                        ? iAsked 
                                            ? 'bg-slate-100 border-slate-300 opacity-70 cursor-wait' // Waiting for help
                                            : 'bg-red-50 border-red-400 animate-pulse shadow-red-200 shadow-md scale-105' // Help needed!
                                    : sosResolved && iAsked
                                        ? 'bg-amber-50 border-amber-400 shadow-amber-200 shadow-lg ring-2 ring-amber-200' // Help arrived
                                    : isFailed
                                        ? 'bg-red-50 border-red-200 hover:border-red-300'
                                        : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1'
                                }
                            `}
                        >
                            {isSolved ? (
                                <>
                                    <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                                    <span className="font-bold text-emerald-800 text-lg line-clamp-1 break-all">{enigma.word}</span>
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full mt-1">
                                        {enigma.correctTranslation}
                                    </span>
                                    {status?.solvedBy !== playerId && (
                                        <span className="absolute top-2 right-2 text-[10px] bg-slate-200 text-slate-600 px-1 rounded flex items-center gap-1">
                                            <User className="w-3 h-3"/> Parceiro
                                        </span>
                                    )}
                                </>
                            ) : sosActive ? (
                                <>
                                    <LifeBuoy className={`w-10 h-10 mb-2 ${iAsked ? 'text-slate-400' : 'text-red-500 animate-bounce'}`} />
                                    <span className={`font-bold text-sm ${iAsked ? 'text-slate-500' : 'text-red-600'}`}>
                                        {iAsked ? 'Aguardando Ajuda...' : 'PEDIDO DE SOS!'}
                                    </span>
                                </>
                            ) : sosResolved && iAsked ? (
                                <>
                                    <Sparkles className="w-8 h-8 text-amber-500 mb-2 animate-spin-slow" />
                                    <span className="font-bold text-amber-700">Ajuda Chegou!</span>
                                    <span className="text-xs text-amber-600 mt-1">Clique para resolver</span>
                                </>
                            ) : (
                                <>
                                    {isFailed && <XCircle className="absolute top-2 right-2 w-5 h-5 text-red-400" />}
                                    <Lock className={`w-8 h-8 mb-2 ${isFailed ? 'text-red-300' : 'text-slate-300'}`} />
                                    <span className={`font-bold text-lg break-all ${isFailed ? 'text-red-800' : 'text-slate-700'}`}>
                                        {enigma.word}
                                    </span>
                                    <span className="text-xs text-slate-400 mt-2">
                                        {isFailed ? 'Tente novamente!' : 'Toque para resolver'}
                                    </span>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </main>

      {/* --- INTRUDER CHALLENGE OVERLAY --- */}
      {gameState.intruderData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
             {!intruderAccepted ? (
                 // STEP 1: Acceptance Modal
                 <div className="bg-white max-w-md w-full rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95">
                     <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                         <AlertTriangle className="w-10 h-10 text-red-600" />
                     </div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2">Alerta de Intruso!</h2>
                     <p className="text-slate-600 mb-8 leading-relaxed">
                         Uma palavra falsa foi inserida no texto pela IA. Encontre-a para ganhar <span className="font-bold text-emerald-600">+20 Pontos</span> e recuperar a vida da equipe!
                     </p>
                     <Button fullWidth onClick={() => setIntruderAccepted(true)} className="bg-red-600 hover:bg-red-700 shadow-red-200">
                         Aceitar Desafio
                     </Button>
                 </div>
             ) : (
                 // STEP 2: The Hunt
                 <div className="bg-white max-w-3xl w-full rounded-3xl p-8 shadow-2xl flex flex-col h-[80vh]">
                     <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> Encontre o Intruso
                            </h3>
                            <p className="text-sm text-slate-400">Clique na palavra que não pertence ao contexto.</p>
                        </div>
                        <div className="bg-red-50 px-3 py-1 rounded-lg text-red-700 font-bold text-sm">
                            Recompensa: Cura +20%
                        </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto leading-loose text-xl font-serif text-slate-700">
                         {gameState.intruderData.modifiedText.split(/\s+/).map((word, idx) => (
                             <span 
                                key={idx}
                                onClick={() => handleIntruderClick(word)}
                                className="inline-block px-1 mx-0.5 rounded cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors select-none"
                             >
                                 {word}{' '}
                             </span>
                         ))}
                     </div>
                 </div>
             )}
          </div>
      )}

      {/* Standard Modals (Full Text & Enigma) - Hidden during Boss Fight */}
      {gameState.phase !== GamePhase.BOSS_FIGHT && (
        <>
            <Modal isOpen={showFullText} onClose={() => setShowFullText(false)} title="Texto Original">
                <div className="prose prose-slate max-w-none max-h-[70vh] overflow-y-auto">
                    <p className="text-lg leading-loose font-serif text-slate-700 whitespace-pre-wrap">{gameState.sourceText}</p>
                </div>
            </Modal>

            <Modal 
                isOpen={!!selectedEnigma} 
                onClose={() => !modalFeedback && setSelectedEnigma(null)} 
                title={isHelper ? "RESGATE: Salve seu parceiro!" : "Decifre a Palavra"}
            >
                {/* ... existing modal content ... reuse strictly existing logic ... */}
                {selectedEnigma && currentStatus && (
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 custom-scrollbar">
                        {isSOSResolved && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-in slide-in-from-top duration-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                    <span className="font-bold text-amber-700 text-sm uppercase tracking-wide">Dica Especial da IA</span>
                                </div>
                                <p className="text-amber-900 font-medium text-lg leading-tight">"{selectedEnigma.synonymOrDefinition}"</p>
                            </div>
                        )}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">Contexto</span>
                                <button onClick={() => speakText(selectedEnigma.contextSentence, gameState.sourceLanguage)} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"><Volume2 className="w-4 h-4" /></button>
                            </div>
                            <p className="font-serif text-lg text-slate-800 italic leading-relaxed">
                                "{selectedEnigma.contextSentence.split(selectedEnigma.word).flatMap((part, i, arr) => i < arr.length - 1 ? [part, <strong key={i} className="text-blue-600 bg-blue-50 px-1 rounded mx-0.5 underline decoration-blue-300 decoration-2 underline-offset-2">{selectedEnigma.word}</strong>] : [part])}"
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {selectedEnigma.options.map((option, idx) => {
                                const isDisabled = tempDisabledOptions.includes(option);
                                let btnClass = "bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300";
                                if ((modalFeedback === 'correct' || modalFeedback === 'sos_solved') && option === selectedEnigma.correctTranslation) btnClass = "bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105";
                                else if (modalFeedback === 'wrong' && !isDisabled) btnClass = "bg-red-50 border-red-200 text-red-400 opacity-50"; 
                                return (
                                    <button key={idx} disabled={isDisabled || !!modalFeedback} onClick={() => handleOptionClick(option)} className={`w-full p-2 rounded-lg border text-left font-medium text-sm transition-all duration-200 flex justify-between items-center h-auto min-h-[3rem] whitespace-normal break-words leading-tight ${isDisabled ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-100' : ''} ${btnClass}`}>
                                        <span className="flex-1 pr-1">{option}</span>
                                        {(modalFeedback === 'correct' || modalFeedback === 'sos_solved') && option === selectedEnigma.correctTranslation && <CheckCircle className="w-4 h-4 text-white shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                        {!isHelper && (
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                <div className="text-sm text-slate-500">Recompensa: <span className="font-bold text-slate-800">{currentStatus.hintUsed ? '5' : isSOSResolved ? (currentStatus.helpCount > 1 ? '3' : '5') : '10'} pts</span></div>
                                <div className="flex gap-2">
                                    {!isSOSResolved && (
                                        <button onClick={handleUseHint} disabled={currentStatus.hintUsed || !!modalFeedback} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus.hintUsed ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}>
                                            <HelpCircle className="w-3.5 h-3.5" />{currentStatus.hintUsed ? 'Dica Usada' : 'Dica (-5)'}
                                        </button>
                                    )}
                                    <button onClick={handleSOSRequest} disabled={!!modalFeedback} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors text-white bg-red-500 hover:bg-red-600 border border-red-600 shadow-sm">
                                        <LifeBuoy className="w-3.5 h-3.5" />PEDIR AJUDA (SOS)
                                    </button>
                                </div>
                            </div>
                        )}
                        {modalFeedback === 'wrong' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-xl animate-in zoom-in fade-in duration-200">Erro! Dano à Equipe!</div></div>}
                        {modalFeedback === 'sos_sent' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-white/50 backdrop-blur-sm"><div className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold shadow-xl animate-in zoom-in fade-in duration-200 text-center"><LifeBuoy className="w-8 h-8 mx-auto mb-2 animate-bounce" />Pedido de Ajuda Enviado!<br/><span className="text-sm font-normal text-blue-100">Aguarde um salvador...</span></div></div>}
                        {modalFeedback === 'sos_solved' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold shadow-xl animate-in zoom-in fade-in duration-200">Você salvou seu parceiro! (+5 pts)</div></div>}
                    </div>
                )}
            </Modal>
        </>
      )}
    </div>
  );
};

export default GameRoom;