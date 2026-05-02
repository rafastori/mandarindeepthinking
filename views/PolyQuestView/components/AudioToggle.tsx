import React, { useState } from 'react';
import { audio } from '../audio';
import Icon from '../../../components/Icon';

const AudioToggle: React.FC<{ size?: number }> = ({ size = 20 }) => {
    const [muted, setMuted] = useState(audio.isMuted());
    return (
        <button
            onClick={() => {
                const next = !muted;
                audio.setMuted(next);
                setMuted(next);
                if (!next) audio.tick();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            title={muted ? 'Ativar som' : 'Silenciar som'}
        >
            <Icon name={muted ? 'volume-x' : 'volume-2'} size={size} />
        </button>
    );
};

export default AudioToggle;
