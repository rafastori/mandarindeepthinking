import React from 'react';
import Icon from '../../components/Icon';
import { GameRoom } from '../../types';

interface RoomListProps {
    rooms: GameRoom[];
    newRoomName: string;
    setNewRoomName: (name: string) => void;
    onCreateRoom: () => void;
    onJoinRoom: (id: string) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, newRoomName, setNewRoomName, onCreateRoom, onJoinRoom }) => {
    return (
        // Ajuste 1: Padding reduzido no mobile (p-4) e maior no PC (sm:p-6)
        <div className="p-4 sm:p-6 pb-24 h-full overflow-y-auto">
             <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-100 mb-8 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Icon name="gamepad-2" className="text-brand-600" /> 
                    Multiplayer
                </h2>
                
                {/* Ajuste 2: Coluna no Mobile (flex-col), Linha no PC (sm:flex-row) */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Nome da Sala..."
                        className="flex-1 border border-slate-200 p-3 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all w-full"
                    />
                    <button 
                        onClick={onCreateRoom} 
                        disabled={!newRoomName.trim()}
                        // Ajuste 3: Botão largura total no mobile (w-full), auto no PC (sm:w-auto)
                        className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 w-full sm:w-auto"
                    >
                        Criar
                    </button>
                </div>
            </div>
            
            <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-4 px-2">Salas Disponíveis</h3>
            <div className="space-y-3">
                {rooms.length === 0 && (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">Nenhuma sala criada.</p>
                        <p className="text-slate-300 text-sm">Crie a primeira sala acima!</p>
                    </div>
                )}
                
                {rooms.map(room => (
                    <div key={room.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center hover:shadow-md transition-all">
                        {/* Ajuste 4: overflow-hidden para o texto não quebrar o layout */}
                        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                            <div className="bg-brand-100 text-brand-700 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-lg shadow-sm">
                                {room.players.length}
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-700 text-base sm:text-lg flex items-center gap-2 truncate">
                                    {room.name}
                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex-shrink-0">
                                        {room.config?.lang === 'zh' ? '🇨🇳' : '🇩🇪'}
                                    </span>
                                </p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <Icon name="star" size={12} /> Meta: <b>{room.targetScore || 20}</b>
                                    </p>
                                    <p className="text-xs text-slate-400 flex items-center gap-1 border-l border-slate-200 pl-3">
                                        {room.status === 'playing' ? 'Jogando' : 'Lobby'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => onJoinRoom(room.id)} 
                            className="bg-slate-100 text-slate-600 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors text-sm sm:text-base flex-shrink-0 ml-2"
                        >
                            Entrar
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};