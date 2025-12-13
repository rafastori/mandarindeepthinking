import React, { useState } from 'react';
import Button from './Button';
import { BookOpen, Globe, Users, ArrowRight, LogOut } from 'lucide-react';
import { GameState } from '../types';

interface LobbyProps {
  userName: string;           // Nome vindo do Google
  userAvatar: string;         // Letra do avatar
  availableRooms: GameState[]; // Salas reais do Firestore
  onCreate: () => void;       // Função simples para criar
  onJoin: (code: string) => void; // Função para entrar
  onLogout: () => void;       // Botão para sair do jogo
}

const Lobby: React.FC<LobbyProps> = ({ 
  userName, 
  userAvatar, 
  availableRooms, 
  onCreate, 
  onJoin,
  onLogout 
}) => {
  const [manualCode, setManualCode] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row min-h-[500px]">
        
        {/* Lado Esquerdo: Branding & Criar */}
        <div className="w-full md:w-5/12 bg-blue-600 p-8 text-white flex flex-col relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
           
           {/* Botão de Sair discreto */}
           <button onClick={onLogout} className="absolute top-4 left-4 p-2 bg-blue-700/50 rounded-full hover:bg-blue-700 transition-colors z-20">
             <LogOut className="w-4 h-4 text-white" />
           </button>

           <div className="relative z-10 flex-1 flex flex-col justify-center">
                <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm shadow-lg border border-white/10">
                    <Globe className="text-white w-9 h-9" />
                </div>
                <h1 className="text-3xl font-bold mb-2 tracking-tight">PolyGlot Quest</h1>
                <p className="text-blue-100 mb-8 leading-relaxed font-medium">
                    Bem-vindo, <strong>{userName}</strong>! <br/>
                    Sua jornada para fluência começa aqui.
                </p>
                
                <div className="mt-auto space-y-4">
                    {/* Botão Gigante de Criar */}
                    <Button 
                        fullWidth 
                        onClick={onCreate} 
                        className="bg-white !text-blue-700 hover:bg-blue-50 border-none shadow-xl font-bold py-4"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <BookOpen className="w-5 h-5" />
                            <span>Criar Nova Sala</span>
                        </div>
                    </Button>
                </div>
           </div>
        </div>

        {/* Lado Direito: Lista de Salas Reais */}
        <div className="w-full md:w-7/12 p-8 bg-slate-50 flex flex-col">
            <div className="flex justify-between items-end mb-6">
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    Salas Online
                </h2>
                <span className="text-xs font-medium text-slate-400">
                    {availableRooms.length} encontradas
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2 custom-scrollbar min-h-[200px]">
                {availableRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Users className="w-12 h-12 mb-2 opacity-20" />
                        <p>Nenhuma sala pública no momento.</p>
                        <p className="text-xs">Crie a sua agora!</p>
                    </div>
                ) : (
                    availableRooms.map((room) => (
                        <button
                            key={room.roomCode}
                            onClick={() => onJoin(room.roomCode)}
                            className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 hover:scale-[1.01] transition-all text-left group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="font-bold text-slate-800 text-lg">Sala {room.roomCode}</div>
                                    <div className="text-xs text-slate-400 font-medium mt-0.5">Idioma: {room.sourceLanguage} → {room.targetLanguage}</div>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    <Users className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold">
                                        {room.players.length}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end">
                                 <div className="bg-blue-600 text-white p-1.5 rounded-full opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                    <ArrowRight className="w-4 h-4" />
                                 </div>
                            </div>
                        </button>
                    ))
                )}
            </div>

            <div className="pt-6 mt-4 border-t border-slate-200">
                <div className="flex gap-2 items-center opacity-70 hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Entrar com Código:</span>
                    <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="QUEST-XXXX"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none uppercase text-xs font-bold text-slate-600 bg-white"
                    />
                    <button 
                        onClick={() => onJoin(manualCode)}
                        disabled={!manualCode.trim()}
                        className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 disabled:opacity-50"
                    >
                        Entrar
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;