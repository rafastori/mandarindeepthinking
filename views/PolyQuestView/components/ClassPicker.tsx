import React from 'react';
import { PlayerClass, PLAYER_CLASSES } from '../types';
import { audio } from '../audio';

interface Props {
    selected?: PlayerClass;
    onSelect: (cls: PlayerClass) => void;
    disabled?: boolean;
    compact?: boolean;
}

/** Seletor de classe — mostra os 3 perks. Usado no Lobby. */
const ClassPicker: React.FC<Props> = ({ selected, onSelect, disabled, compact }) => {
    return (
        <div className={`grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-1 md:grid-cols-3 gap-3'}`}>
            {PLAYER_CLASSES.map(cls => {
                const isSel = selected === cls.id;
                return (
                    <button
                        key={cls.id}
                        onClick={() => {
                            if (disabled) return;
                            audio.cardLock();
                            onSelect(cls.id);
                        }}
                        disabled={disabled}
                        className={`
                            relative rounded-xl border-2 p-3 text-left transition-all
                            ${isSel
                                ? 'bg-white/10 border-amber-400 ring-2 ring-amber-300/50 shadow-[0_0_20px_rgba(255,216,110,0.3)]'
                                : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                        `}
                        style={isSel ? { borderColor: cls.color } : undefined}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{cls.icon}</span>
                            <span className="font-bold text-white text-sm" style={{ color: isSel ? cls.color : 'white' }}>
                                {cls.name}
                            </span>
                            {isSel && (
                                <span className="ml-auto text-amber-400 text-xs font-black">✓</span>
                            )}
                        </div>
                        <div className="text-[11px] text-white/80 font-medium leading-snug">
                            {cls.perkName}
                        </div>
                        <div className="text-[10px] text-white/50 mt-0.5 leading-snug">
                            {cls.perkDesc}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default ClassPicker;
