import React, { useState } from 'react';
import Button from './Button';
import { BookOpen, Globe, ArrowRight, Users } from 'lucide-react';

interface LobbyProps {
  onJoin: (name: string, roomCode: string, isHost: boolean) => void;
}

// Mock data for available rooms
const AVAILABLE_ROOMS = [
  { code: 'QUEST-EN', host: 'Teacher Mike', source: 'Inglês', target: 'Português', players: 3, max: 5 },
  { code: 'QUEST-DE', host: 'Hans Müller', source: 'Alemão', target: 'Português', players: 1, max: 5 },
  { code: 'QUEST-IT', host: 'Giulia Rossi', source: 'Italiano', target: 'Português', players: 2, max: 5 },
  { code: 'QUEST-FR', host: 'Marie Curie', source: 'Francês', target: 'Português', players: 4, max: 5 },
];

const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [manualCode, setManualCode] = useState('');

  const handleCreate = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (name.trim()) {
      onJoin(name, code, true);
    } else {
       document.getElementById('name-input')?.focus();
    }
  };

  const handleJoinSpecific = (code: string) => {
    if (name.trim()) {
      onJoin(name, code, false);
    } else {
        document.getElementById('name-input')?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left Side: Branding & Create */}
        <div className="w-full md:w-5/12 bg-blue-600 p-8 text-white flex flex-col relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
           
           <div className="relative z-10 flex-1 flex flex-col justify-center">
                <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm shadow-lg border border-white/10">
                    <Globe className="text-white w-9 h-9" />
                </div>
                <h1 className="text-3xl font-bold mb-2 tracking-tight">PolyGlot Quest</h1>
                <p className="text-blue-100 mb-8 leading-relaxed font-medium">
                    Sua jornada para fluência começa aqui. Junte-se a uma sala ou crie sua própria aventura.
                </p>
                
                <div className="space-y-4 mt-auto">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-blue-200 mb-2">Nome do Aventureiro</label>
                        <input
                            id="name-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Como quer ser chamado?"
                            className="w-full px-4 py-3 rounded-xl border-2 border-blue-500 bg-blue-700/50 text-white placeholder-blue-300 focus:bg-blue-700 focus:border-white focus:ring-0 outline-none transition-all"
                        />
                    </div>
                    <Button 
                        fullWidth 
                        onClick={handleCreate} 
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

        {/* Right Side: Room List */}
        <div className="w-full md:w-7/12 p-8 bg-slate-50 flex flex-col">
            <div className="flex justify-between items-end mb-6">
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    Salas Disponíveis
                </h2>
                <span className="text-xs font-medium text-slate-400">
                    {AVAILABLE_ROOMS.length} salas online
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 -mr-2 custom-scrollbar">
                {AVAILABLE_ROOMS.map((room) => (
                    <button
                        key={room.code}
                        onClick={() => handleJoinSpecific(room.code)}
                        className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 hover:scale-[1.01] transition-all text-left group"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="font-bold text-slate-800 text-lg">{room.host}</div>
                                <div className="text-xs text-slate-400 font-medium mt-0.5">Sala: {room.code}</div>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <Users className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold">
                                    {room.players}/{room.max}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{room.source}</span>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{room.target}</span>
                            </div>
                             
                             <div className="bg-blue-600 text-white p-1.5 rounded-full opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                <ArrowRight className="w-4 h-4" />
                             </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="pt-6 mt-4 border-t border-slate-200">
                <div className="flex gap-2 items-center opacity-70 hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Código Privado:</span>
                    <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="ABC-123"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none uppercase text-xs font-bold text-slate-600 bg-white"
                    />
                    <button 
                        onClick={() => handleJoinSpecific(manualCode)}
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