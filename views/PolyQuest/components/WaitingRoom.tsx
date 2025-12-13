import React, { useState } from 'react';
import { Player, GameState, Language } from '../types';
import Button from './Button';
import { Users, Copy, CheckCircle2, Circle, Wand2, Lock, Unlock } from 'lucide-react';
import { generateSourceMaterial } from '../services/geminiService';

interface WaitingRoomProps {
  gameState: GameState;
  playerId: string; // Current user ID
  onStartSelection: () => void;
  onUpdateSettings: (settings: Partial<GameState>) => void;
  onToggleReady: (playerId: string) => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ 
  gameState, 
  playerId,
  onStartSelection,
  onUpdateSettings,
  onToggleReady
}) => {
  const [generating, setGenerating] = useState(false);
  const isHost = gameState.hostId === playerId;
  const allReady = gameState.players.length > 0 && gameState.players.every(p => p.isReady);

  const copyCode = () => {
    navigator.clipboard.writeText(gameState.roomCode);
  };

  const handleGenerateText = async () => {
    setGenerating(true);
    try {
      const data = await generateSourceMaterial(gameState.sourceLanguage, "Uma aventura inesperada");
      onUpdateSettings({ sourceText: data.fullText });
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  // Logic to determine if text length is sufficient
  // CJK languages (Mandarin, Japanese) don't use spaces, so we count characters.
  // Others count words by splitting spaces.
  const isCJK = gameState.sourceLanguage === Language.MANDARIN || gameState.sourceLanguage === Language.JAPANESE;
  const currentCount = isCJK 
    ? gameState.sourceText.length 
    : gameState.sourceText.split(/\s+/).filter(w => w.length > 0).length;
  
  const minCount = 10;
  const isValidLength = currentCount >= minCount;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Player List */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Participantes
            </h2>
            <div className="mt-4 flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors" onClick={copyCode}>
               <span className="text-xs text-slate-400 font-bold uppercase">Código:</span>
               <span className="font-mono font-bold text-lg text-slate-700 tracking-widest flex-1">{gameState.roomCode}</span>
               <Copy className="w-4 h-4 text-slate-400" />
             </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-3">
            {gameState.players.map((player) => (
              <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl border ${player.isReady ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
                  {player.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{player.name}</h3>
                    {player.id === gameState.hostId && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Host</span>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${player.isReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {player.isReady ? 'Pronto para a missão' : 'Preparando equipamentos...'}
                  </span>
                </div>
                {player.isReady ? <CheckCircle2 className="text-emerald-500 w-5 h-5" /> : <Circle className="text-slate-300 w-5 h-5" />}
              </div>
            ))}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             <Button 
               variant={gameState.players.find(p => p.id === playerId)?.isReady ? "secondary" : "outline"}
               fullWidth
               onClick={() => onToggleReady(playerId)}
             >
               {gameState.players.find(p => p.id === playerId)?.isReady ? "Estou Pronto!" : "Marcar como Pronto"}
             </Button>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              Configuração da Missão
            </h2>
            {!isHost && (
              <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded">Visão do Convidado</span>
            )}
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* Language Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Idioma do Texto (Origem)</label>
                <select 
                  disabled={!isHost}
                  value={gameState.sourceLanguage}
                  onChange={(e) => {
                    const newLang = e.target.value as Language;
                    // Reset text when language changes to ensure content matches TTS voice
                    onUpdateSettings({ 
                      sourceLanguage: newLang,
                      sourceText: newLang !== gameState.sourceLanguage ? '' : gameState.sourceText
                    });
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:ring-2 focus:ring-blue-200 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Idioma da Tradução (Destino)</label>
                <select 
                  disabled={!isHost}
                  value={gameState.targetLanguage}
                  onChange={(e) => onUpdateSettings({ targetLanguage: e.target.value as Language })}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:ring-2 focus:ring-blue-200 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                   {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Source Text Input */}
            <div className="flex flex-col h-full min-h-[200px]">
              <div className="flex justify-between items-end mb-2">
                 <label className="block text-sm font-medium text-slate-500">Texto Base</label>
                 {isHost && (
                   <button 
                    onClick={handleGenerateText}
                    disabled={generating}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 disabled:opacity-50"
                   >
                     {generating ? "Gerando..." : "Gerar Texto Aleatório com IA"}
                   </button>
                 )}
              </div>
              <textarea
                disabled={!isHost}
                value={gameState.sourceText}
                onChange={(e) => onUpdateSettings({ sourceText: e.target.value })}
                placeholder={isHost ? "Cole um texto no idioma selecionado ou gere um automaticamente..." : "Aguardando o anfitrião definir o texto..."}
                className="flex-1 w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 resize-none focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:opacity-75 disabled:cursor-not-allowed font-serif leading-relaxed"
              />
              <div className={`text-right text-xs mt-1 transition-colors ${isValidLength ? 'text-emerald-500 font-medium' : 'text-slate-400'}`}>
                {currentCount} {isCJK ? 'caracteres' : 'palavras'} (Mín: {minCount})
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             {isHost ? (
               <div className="flex flex-col gap-2">
                 <Button 
                   fullWidth 
                   onClick={onStartSelection} 
                   disabled={!allReady || !isValidLength} 
                   className="py-4 text-lg shadow-xl"
                 >
                   <div className="flex items-center justify-center gap-2">
                      {allReady ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      <span>Iniciar Seleção de Palavras</span>
                   </div>
                 </Button>
                 {!allReady && (
                   <p className="text-center text-xs text-amber-600 font-medium">
                     Todos os jogadores devem estar "Prontos" para iniciar.
                   </p>
                 )}
               </div>
             ) : (
               <div className="text-center py-3 text-slate-500 font-medium bg-slate-100 rounded-xl border border-slate-200">
                 Aguardando o Líder da Expedição iniciar...
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;