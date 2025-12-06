import React from 'react';
import Icon from '../../components/Icon';
import { GameRoom } from '../../types';

// Constante de tópicos movida para cá para ser usada no select
export const TOPICS = [
    "Comida & Bebida", "Viagem", "Trabalho", "Família", 
    "Natureza", "Cidade", "Sentimentos", "Casa", "Tecnologia", "Esportes"
];

interface LobbyProps {
    room: GameRoom;
    isHost: boolean;
    // Config States
    selectedTopics: string[];
    selectedLang: 'zh' | 'de';
    selectedDiff: string;
    targetScore: number;
    loadingDeck: boolean;
    // Setters
    onToggleTopic: (topic: string) => void;
    setLang: (l: 'zh' | 'de') => void;
    setDiff: (d: string) => void;
    setTargetScore: (s: number) => void;
    // Actions
    onStart: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
    room, isHost, selectedTopics, selectedLang, selectedDiff, targetScore, loadingDeck,
    onToggleTopic, setLang, setDiff, setTargetScore, onStart
}) => {
    return (
        <>
            {/* Área de Jogadores */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Icon name="users" size={14} /> Jogadores Conectados ({room.players.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {room.players.map(player => (
                        <div key={player.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                            {player.avatarUrl ? (
                                <img src={player.avatarUrl} alt={player.name} className="w-8 h-8 rounded-full border border-slate-200" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                                    {player.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-700 truncate">{player.name}</p>
                                {player.id === room.hostId && <p className="text-[10px] text-brand-600 font-medium">Host</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-lg">
                    <Icon name="settings" size={24} className="text-brand-500" /> 
                    Configuração
                </h3>

                {isHost ? (
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Idioma</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setLang('zh')} className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${selectedLang === 'zh' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}><span>🇨🇳</span> Mandarim</button>
                                <button onClick={() => setLang('de')} className={`p-3 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${selectedLang === 'de' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}><span>🇩🇪</span> Alemão</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">2. Dificuldade</label>
                            <select value={selectedDiff} onChange={(e) => setDiff(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium">
                                <option value="Iniciante">Iniciante</option>
                                <option value="Intermediário">Intermediário</option>
                                <option value="Avançado">Avançado</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">3. Tópicos (Múltipla Escolha)</label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {TOPICS.map(topic => {
                                    const isSelected = selectedTopics.includes(topic);
                                    return (
                                        <button key={topic} onClick={() => onToggleTopic(topic)} className={`p-3 text-sm rounded-lg text-left transition-all ${isSelected ? 'bg-purple-100 text-purple-700 font-bold shadow-sm ring-1 ring-purple-500' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                            {topic}
                                            {isSelected && <Icon name="check" size={14} className="float-right mt-0.5" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Selecionados: {selectedTopics.join(', ')}</p>
                        </div>
                        <div className="mt-4">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">4. Meta: {targetScore} pts</label>
                            <input type="range" min="5" max="100" step="5" value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-brand-600" />
                        </div>

                        <button onClick={onStart} disabled={loadingDeck || room.players.length < 2} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-200 mt-4 flex items-center justify-center gap-2 hover:bg-brand-700 disabled:opacity-50">
                            {loadingDeck ? "Criando Cartas..." : <><Icon name="sparkles" size={20} /> Gerar Partida</>}
                        </button>
                        {room.players.length < 2 && <p className="text-center text-red-500 text-xs mt-2">Mínimo 2 jogadores.</p>}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <Icon name="clock" size={32} className="text-slate-300" />
                        </div>
                        <p className="font-medium text-slate-600">Aguardando Host iniciar...</p>
                        <div className="mt-6 w-full max-w-xs bg-slate-50 p-4 rounded-xl border border-slate-100 text-left space-y-2 mx-auto">
                            <p className="text-xs text-slate-400 uppercase font-bold">Configuração Atual:</p>
                            <div className="flex justify-between text-sm text-slate-700"><span>Tema:</span> <b>{room.config?.topic}</b></div>
                            <div className="flex justify-between text-sm text-slate-700"><span>Meta:</span> <b>{targetScore} pts</b></div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};