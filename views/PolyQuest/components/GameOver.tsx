import React, { useState } from 'react';
import { GameState, Player } from '../types';
import Button from './Button';
import { RefreshCcw, Save, Crown, BookOpen, Check, Star } from 'lucide-react';

interface GameOverProps {
  gameState: GameState;
  onReset: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ gameState, onReset }) => {
  const [saved, setSaved] = useState(false);
  // Initialize with all words selected by default
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(gameState.enigmas.map(e => e.id)));

  // Sort players by score
  const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  const handleSave = () => {
    if (selectedIds.size === 0) return;
    setSaved(true);
    // Simulation of saving to database/local storage
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleEnigma = (id: string) => {
    if (saved) setSaved(false);
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (saved) setSaved(false);
    if (selectedIds.size === gameState.enigmas.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(gameState.enigmas.map(e => e.id)));
    }
  };

  const isAllSelected = selectedIds.size === gameState.enigmas.length && gameState.enigmas.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header / Victory Section */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 text-center relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-emerald-400 to-blue-500"></div>
          
          <div className="p-8 md:p-12">
            <div className="inline-flex items-center justify-center p-4 bg-yellow-100 rounded-full mb-6 ring-8 ring-yellow-50">
              <Crown className="w-10 h-10 text-yellow-600" />
            </div>
            
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Missão Cumprida!</h1>
            <p className="text-slate-500 text-lg mb-8">
              A equipe dominou o idioma <span className="font-bold text-blue-600">{gameState.sourceLanguage}</span>.
            </p>

            {/* Podium */}
            <div className="flex justify-center items-end gap-4 mb-8 h-48">
              {sortedPlayers[1] && (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center mb-2 border-2 border-white shadow-sm">{sortedPlayers[1].avatar}</div>
                  <div className="bg-slate-100 w-20 h-24 rounded-t-xl flex flex-col justify-end pb-2 border-x border-t border-slate-200">
                     <span className="text-xs font-bold text-slate-400">2º</span>
                     <span className="font-bold text-slate-700">{sortedPlayers[1].score}</span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col items-center z-10">
                <Crown className="w-6 h-6 text-yellow-500 mb-1 animate-bounce" />
                <div className="w-14 h-14 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center mb-2 border-4 border-white shadow-md text-xl">{winner.avatar}</div>
                <div className="bg-gradient-to-b from-yellow-100 to-yellow-50 w-24 h-32 rounded-t-xl flex flex-col justify-end pb-4 border-x border-t border-yellow-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400/30"></div>
                    <span className="text-sm font-bold text-yellow-600">Vencedor</span>
                    <span className="text-2xl font-bold text-slate-800">{winner.score}</span>
                </div>
                <div className="mt-2 font-bold text-slate-800">{winner.name}</div>
              </div>

              {sortedPlayers[2] && (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center mb-2 border-2 border-white shadow-sm">{sortedPlayers[2].avatar}</div>
                  <div className="bg-orange-50 w-20 h-16 rounded-t-xl flex flex-col justify-end pb-2 border-x border-t border-orange-100">
                     <span className="text-xs font-bold text-orange-300">3º</span>
                     <span className="font-bold text-slate-700">{sortedPlayers[2].score}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Library Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 self-start md:self-center">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Biblioteca da Missão</h2>
                <p className="text-xs text-slate-500 font-medium">Selecione as palavras para salvar ({selectedIds.size}/{gameState.enigmas.length})</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button 
                    onClick={toggleAll}
                    className="text-sm font-bold text-slate-500 hover:text-blue-600 px-3 py-2 transition-colors"
                >
                    {isAllSelected ? "Desmarcar Todas" : "Marcar Todas"}
                </button>

                <button 
                  onClick={handleSave}
                  disabled={saved || selectedIds.size === 0}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md
                    ${saved 
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default' 
                      : selectedIds.size === 0
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                    }
                  `}
                >
                  {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Salvo na Biblioteca!' : `Salvar (${selectedIds.size})`}
                </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
            {gameState.enigmas.map((enigma) => {
              const isSelected = selectedIds.has(enigma.id);
              return (
                <div 
                    key={enigma.id} 
                    onClick={() => toggleEnigma(enigma.id)}
                    className={`p-6 transition-colors cursor-pointer group select-none ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                >
                    <div className="flex items-start gap-4">
                        <div className={`mt-1.5 w-6 h-6 rounded-lg border-2 flex shrink-0 items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 shadow-sm' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row md:items-start gap-4">
                            <div className="md:w-1/3">
                                <div className="flex items-baseline gap-2 mb-1">
                                <span className={`text-xl font-bold transition-colors ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>{enigma.word}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-wide">{gameState.sourceLanguage}</span>
                                </div>
                                <div className="text-emerald-600 font-bold flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                {enigma.correctTranslation}
                                </div>
                            </div>
                            
                            <div className="md:w-2/3 bg-white/50 p-3 rounded-xl border border-slate-200/60 relative">
                                <div className={`absolute top-3 left-0 w-1 h-8 rounded-r transition-colors ${isSelected ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                <p className="text-slate-600 italic pl-3 leading-relaxed font-serif text-sm">
                                "{enigma.contextSentence.split(enigma.word).flatMap((part, i, arr) => 
                                        i < arr.length - 1 
                                        ? [part, <strong key={i} className={`px-1 rounded mx-0.5 transition-colors ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-900'}`}>{enigma.word}</strong>] 
                                        : [part]
                                    )}"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
              );
            })}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             <Button fullWidth onClick={onReset} className="py-4 text-lg">
                <div className="flex items-center justify-center gap-2">
                  <RefreshCcw className="w-5 h-5" />
                  <span>Iniciar Nova Aventura</span>
                </div>
             </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GameOver;