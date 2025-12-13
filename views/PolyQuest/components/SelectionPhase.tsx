import React, { useMemo, useState } from 'react';
import { GameState, Language } from '../types';
import Button from './Button';
import Modal from './Modal';
import { CheckCircle2, UserCheck, List, X, MousePointerClick } from 'lucide-react';

interface SelectionPhaseProps {
  gameState: GameState;
  playerId: string;
  onToggleWord: (word: string) => void;
  onToggleReady: (playerId: string) => void;
}

const SelectionPhase: React.FC<SelectionPhaseProps> = ({
  gameState,
  playerId,
  onToggleWord,
  onToggleReady
}) => {
  const [isListOpen, setIsListOpen] = useState(false);
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const readyCount = gameState.players.filter(p => p.isReady).length;
  const totalPlayers = gameState.players.length;
  const allReady = totalPlayers > 0 && readyCount === totalPlayers;

  // Split text into tokens (words and punctuation)
  const tokens = useMemo(() => {
    // Specific handling for CJK languages which don't use spaces
    if (gameState.sourceLanguage === Language.MANDARIN || gameState.sourceLanguage === Language.JAPANESE) {
        if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
             const langCode = gameState.sourceLanguage === Language.MANDARIN ? 'zh-CN' : 'ja-JP';
             try {
                // @ts-ignore - TS might not have Segmenter types depending on environment
                const segmenter = new Intl.Segmenter(langCode, { granularity: 'word' });
                // @ts-ignore
                return Array.from(segmenter.segment(gameState.sourceText)).map((s: any) => s.segment);
             } catch (e) {
                 console.warn("Intl.Segmenter failed, falling back to char split", e);
             }
        }
        // Fallback: split by character
        return gameState.sourceText.split('');
    }

    return gameState.sourceText.split(/([.,!?;:"()„“\s]+)/).filter(t => t.length > 0);
  }, [gameState.sourceText, gameState.sourceLanguage]);

  const isWord = (token: string) => {
     const isCJK = gameState.sourceLanguage === Language.MANDARIN || gameState.sourceLanguage === Language.JAPANESE;
     if (isCJK) {
         // Allow single characters for CJK, filter out pure punctuation/spaces
         // Unicode ranges for CJK punctuation and common punctuation
         return !/^[.,!?;:"()„“\s\u3000-\u303f\uff00-\uffef]+$/.test(token) && token.trim().length > 0;
     }
    return !/^[.,!?;:"()„“\s]+$/.test(token) && token.trim().length > 1;
  };

  const getPlayer = (pid: string) => gameState.players.find(pl => pl.id === pid);

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <div className="max-w-7xl w-full grid grid-cols-12 gap-4 h-[90vh]">
        
        {/* Main Text Area - Full Width */}
        <div className="col-span-12 bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
          {/* Ultra Compact Header with Controls */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-slate-500">
               <MousePointerClick className="w-4 h-4" />
               <span className="text-xs font-medium uppercase tracking-wide">Clique nas palavras desconhecidas</span>
            </div>

            <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setIsListOpen(true)}
                   className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:border-blue-400 hover:text-blue-600 transition-colors"
                 >
                   <List className="w-3.5 h-3.5" />
                   <span>Lista ({gameState.selectedWords.length})</span>
                 </button>

                <div className="h-4 w-px bg-slate-200 mx-1"></div>

                <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${allReady ? "text-emerald-600" : "text-slate-400"}`}>
                    {allReady ? "Todos Prontos" : `${readyCount}/${totalPlayers} Prontos`}
                </span>
                
                <Button 
                    variant={currentPlayer?.isReady ? "secondary" : "primary"}
                    onClick={() => onToggleReady(playerId)}
                    className="px-3 py-1.5 text-xs h-auto rounded-lg shadow-none" 
                >
                    <div className="flex items-center gap-1.5">
                        {currentPlayer?.isReady ? <CheckCircle2 className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        <span>{currentPlayer?.isReady ? "Aguardando" : "Terminei"}</span>
                    </div>
                </Button>
            </div>
          </div>

          {/* Text Content */}
          <div className="p-8 flex-1 overflow-y-auto leading-loose text-xl font-serif">
            {tokens.map((token, index) => {
              const cleanToken = token.trim();
              const valid = isWord(cleanToken);
              const selection = valid ? gameState.selectedWords.find(sw => sw.word === cleanToken) : undefined;
              const isSelected = !!selection;

              if (!valid) {
                return <span key={index} className="text-slate-400">{token}</span>;
              }

              // Determine styling based on selection
              // If selected by current user, use a stronger highlight. 
              // If selected by others but not me, use a lighter highlight.
              const selectedByMe = isSelected && selection?.userIds.includes(playerId);
              
              let classes = "text-slate-700 hover:bg-blue-50 hover:text-blue-600";
              if (isSelected) {
                  classes = selectedByMe 
                    ? "bg-yellow-200 text-yellow-900 border-b-2 border-yellow-400 font-semibold mx-0.5 scale-105" 
                    : "bg-slate-200 text-slate-800 border-b-2 border-slate-300 mx-0.5";
              }

              return (
                <span
                  key={index}
                  onClick={() => onToggleWord(cleanToken)}
                  className={`inline-block px-1 rounded-md cursor-pointer transition-all duration-200 select-none ${classes}`}
                >
                  {token}
                </span>
              );
            })}
          </div>
        </div>

        {/* Modal for Word List */}
        <Modal isOpen={isListOpen} onClose={() => setIsListOpen(false)} title="Palavras Selecionadas">
            <div className="max-h-[60vh] overflow-y-auto p-1">
                {gameState.selectedWords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center opacity-60">
                         <List className="w-12 h-12 mb-3 text-slate-300" />
                         <p>Nenhuma palavra selecionada ainda.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {gameState.selectedWords.map((item, idx) => (
                            <div 
                                key={idx} 
                                className="bg-white pl-4 pr-3 py-3 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors"
                            >
                                <span className="font-bold text-slate-700 text-lg">{item.word}</span>
                                
                                <div className="flex items-center gap-3">
                                    {/* Avatars of users who selected this */}
                                    <div className="flex -space-x-2">
                                        {item.userIds.map((uid) => {
                                            const p = getPlayer(uid);
                                            if (!p) return null;
                                            return (
                                                <div 
                                                    key={uid} 
                                                    title={p.name}
                                                    className={`w-8 h-8 rounded-full ${p.color} text-white text-xs flex items-center justify-center font-bold border-2 border-white ring-1 ring-slate-100`}
                                                >
                                                    {p.avatar}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Remove button (only shows if current user selected it) */}
                                    {item.userIds.includes(playerId) && (
                                        <button 
                                            onClick={() => onToggleWord(item.word)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <Button onClick={() => setIsListOpen(false)} className="py-2 px-6">Fechar</Button>
            </div>
        </Modal>

      </div>
    </div>
  );
};

export default SelectionPhase;