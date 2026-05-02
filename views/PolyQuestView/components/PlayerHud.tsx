import React from 'react';
import { PolyQuestPlayer, PLAYER_CLASSES } from '../types';
import { getPlayerColor } from '../theme';

interface Props {
    player: PolyQuestPlayer;
    isMe?: boolean;
    isHost?: boolean;
    compact?: boolean;
    showClass?: boolean;
    showLevel?: boolean;
}

/** Cartão compacto de jogador — usado nas barras de status durante o jogo. */
const PlayerHud: React.FC<Props> = ({ player, isMe, isHost, compact = true, showClass = true, showLevel = true }) => {
    const color = getPlayerColor(player.id);
    const cls = player.cls ? PLAYER_CLASSES.find(c => c.id === player.cls) : null;

    if (compact) {
        return (
            <div
                className={`flex items-center gap-2 px-2 py-1 rounded-xl border-2 backdrop-blur-sm transition-all ${isMe ? 'ring-2 ring-amber-300' : ''}`}
                style={{
                    backgroundColor: `${color.hex}1a`,
                    borderColor: color.hex,
                }}
            >
                {player.avatarUrl ? (
                    <img src={player.avatarUrl} alt={player.name} className="w-7 h-7 rounded-full ring-1 ring-white/30" />
                ) : (
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: color.hex }}
                    >
                        {player.name[0]?.toUpperCase()}
                    </div>
                )}
                <div className="flex flex-col leading-none">
                    <span className="text-[11px] font-bold text-white truncate max-w-[80px] flex items-center gap-1">
                        {player.name.split(' ')[0]}
                        {isHost && <span className="text-[8px]">👑</span>}
                        {showClass && cls && <span title={cls.name}>{cls.icon}</span>}
                    </span>
                    <span className="text-[10px] text-amber-300 font-semibold">{player.score} pts</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-2xl border-2 backdrop-blur ${isMe ? 'ring-2 ring-amber-300' : ''}`}
            style={{
                backgroundColor: `${color.hex}26`,
                borderColor: color.hex,
            }}
        >
            {player.avatarUrl ? (
                <img src={player.avatarUrl} alt={player.name} className="w-12 h-12 rounded-full ring-2 ring-white/30" />
            ) : (
                <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                    style={{ backgroundColor: color.hex }}
                >
                    {player.name[0]?.toUpperCase()}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                    {player.name}
                    {isHost && <span className="text-xs">👑</span>}
                    {showClass && cls && <span title={cls.name} className="text-base">{cls.icon}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-amber-300 font-bold text-sm">{player.score} pts</span>
                    {showLevel && (
                        <span className="text-[10px] uppercase font-bold text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                            LVL {player.totalScore || 0}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerHud;
