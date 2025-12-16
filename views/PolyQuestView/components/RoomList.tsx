import React from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';

interface RoomListProps {
    rooms: PolyQuestRoom[];
    onJoinRoom: (roomId: string) => void;
    onCreateRoom: () => void;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, onJoinRoom, onCreateRoom }) => {
    // Filtrar apenas salas em lobby
    const availableRooms = rooms.filter(r => r.phase === 'lobby');

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Salas Disponíveis</h2>
                <button
                    onClick={onCreateRoom}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                >
                    <Icon name="plus" size={20} />
                    <span>Criar Sala</span>
                </button>
            </div>

            {/* Lista de salas */}
            {availableRooms.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                    <Icon name="inbox" size={48} className="text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma sala disponível</h3>
                    <p className="text-slate-500 mb-6">Seja o primeiro a criar uma sala!</p>
                    <button
                        onClick={onCreateRoom}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                    >
                        Criar Nova Sala
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {availableRooms.map(room => (
                        <div
                            key={room.id}
                            className="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <h3 className="text-xl font-bold text-slate-800">{room.name}</h3>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                                            Aguardando
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Icon name="users" size={16} className="text-slate-400" />
                                            <span>{room.players.length} jogador(es)</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Icon name="globe" size={16} className="text-slate-400" />
                                            <span>{room.config.sourceLang.toUpperCase()} → {room.config.targetLang.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    {/* Jogadores */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {room.players.map(player => (
                                            <div
                                                key={player.id}
                                                className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-200"
                                            >
                                                {player.avatarUrl && (
                                                    <img
                                                        src={player.avatarUrl}
                                                        alt={player.name}
                                                        className="w-5 h-5 rounded-full"
                                                    />
                                                )}
                                                <span className="text-xs font-medium text-slate-700">{player.name}</span>
                                                {player.isReady && (
                                                    <Icon name="check-circle" size={14} className="text-emerald-600" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => onJoinRoom(room.id)}
                                    className="ml-4 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                >
                                    <Icon name="log-in" size={18} />
                                    <span>Entrar</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
