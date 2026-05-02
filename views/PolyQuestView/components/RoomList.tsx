import React from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';
import { THEME, getPlayerColor } from '../theme';
import { audio } from '../audio';
import AudioToggle from './AudioToggle';

interface Props {
    rooms: PolyQuestRoom[];
    onJoinRoom: (roomId: string) => void;
    onCreateRoom: () => void;
}

export const RoomList: React.FC<Props> = ({ rooms, onJoinRoom, onCreateRoom }) => {
    const available = rooms.filter(r => r.phase === 'lobby');

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-4 md:p-6 text-white`}>
            <div className="max-w-3xl mx-auto space-y-4">
                <div className={`${THEME.bgPanel} rounded-2xl p-5 ${THEME.borderGlow} border flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-2xl">
                            ⚔️
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-amber-300">PolyQuest</h1>
                            <p className="text-xs text-white/60">Junte-se a uma party ou crie sua própria masmorra.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <AudioToggle />
                        <button
                            onClick={() => { audio.classPerk(); onCreateRoom(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/30 active:scale-95"
                        >
                            <Icon name="plus" size={18} /> Nova Sala
                        </button>
                    </div>
                </div>

                {available.length === 0 ? (
                    <div className={`${THEME.bgPanelSolid} rounded-2xl p-10 text-center border-2 border-dashed border-white/15`}>
                        <Icon name="inbox" size={48} className="text-white/30 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-1">Nenhuma sala aberta</h3>
                        <p className="text-white/50 text-sm mb-6">Seja o primeiro a abrir uma masmorra.</p>
                        <button
                            onClick={() => { audio.classPerk(); onCreateRoom(); }}
                            className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl font-bold"
                        >
                            Criar Sala
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {available.map(room => (
                            <div
                                key={room.id}
                                className={`${THEME.bgPanelSolid} rounded-2xl p-4 ${THEME.borderGlow} border hover:border-amber-400/60 transition-colors`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-black text-white truncate">{room.name}</h3>
                                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold uppercase">
                                                Aguardando
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-white/70 mb-2">
                                            <span className="flex items-center gap-1">
                                                <Icon name="users" size={14} />
                                                {room.players.length}
                                            </span>
                                            <span>•</span>
                                            <span className="font-mono uppercase tracking-wider text-amber-300 font-bold">
                                                {room.config.sourceLang} → {room.config.targetLang}
                                            </span>
                                            <span>•</span>
                                            <span className="text-white/50">{room.config.difficulty}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {room.players.map(p => {
                                                const color = getPlayerColor(p.id);
                                                return (
                                                    <div
                                                        key={p.id}
                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
                                                        style={{ backgroundColor: `${color.hex}26`, borderColor: `${color.hex}66` }}
                                                    >
                                                        {p.avatarUrl ? (
                                                            <img src={p.avatarUrl} className="w-4 h-4 rounded-full" />
                                                        ) : (
                                                            <span className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white" style={{ backgroundColor: color.hex }}>
                                                                {p.name[0]}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] font-bold text-white">{p.name.split(' ')[0]}</span>
                                                        {p.isReady && <Icon name="check-circle" size={10} className="text-emerald-400" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { audio.cardLock(); onJoinRoom(room.id); }}
                                        className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl font-bold text-sm flex items-center gap-1.5 self-stretch md:self-start active:scale-95"
                                    >
                                        Entrar <Icon name="arrow-right" size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
