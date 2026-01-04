import React, { useState, useEffect } from 'react';
import Icon from '../../../components/Icon';

// Definição dos emotes disponíveis
export interface EmoteDefinition {
    id: string;
    emoji: string;
    label: string;
    sound?: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party';
}

// Emotes pré-definidos
export const EMOTES: EmoteDefinition[] = [
    { id: 'clap', emoji: '👏', label: 'Palmas', sound: 'applause' },
    { id: 'laugh', emoji: '😂', label: 'Rindo', sound: 'laugh' },
    { id: 'fire', emoji: '🔥', label: 'Fogo' },
    { id: 'confused', emoji: '🤔', label: 'Pensando' },
    { id: 'cool', emoji: '😎', label: 'Legal' },
    { id: 'thanks', emoji: '🙏', label: 'Obrigado' },
];

// Sons pré-definidos
export const SOUNDS: { id: string; label: string; icon: string; type: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party' }[] = [
    { id: 'party', label: 'Parabéns', icon: '🎉', type: 'party' },
    { id: 'bell', label: 'Sino', icon: '🔔', type: 'bell' },
    { id: 'horn', label: 'Buzina', icon: '📯', type: 'horn' },
    { id: 'tick', label: 'Tic-tac', icon: '⏱️', type: 'tick' },
];

// Emote enviado para broadcast
export interface EmoteBroadcast {
    emoteId: string;
    emoji: string;
    soundType?: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party';
    senderId: string;
    senderName: string;
    timestamp: number;
}

interface EmotePanelProps {
    onSendEmote: (emote: EmoteBroadcast) => void;
    currentUserId: string;
    currentUserName: string;
}

// Função para tocar sons usando Web Audio API
const playSound = (type: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party') => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        switch (type) {
            case 'applause':
                // Sequência rápida de notas aleatórias para simular palmas
                for (let i = 0; i < 6; i++) {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(200 + Math.random() * 400, audioContext.currentTime + i * 0.08);
                    gain.gain.setValueAtTime(0.05, audioContext.currentTime + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.08 + 0.06);
                    osc.start(audioContext.currentTime + i * 0.08);
                    osc.stop(audioContext.currentTime + i * 0.08 + 0.06);
                }
                return;

            case 'laugh':
                // Sequência ascendente rápida
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                oscillator.frequency.linearRampToValueAtTime(500, audioContext.currentTime + 0.1);
                oscillator.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.2);
                oscillator.frequency.linearRampToValueAtTime(550, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
                return;

            case 'bell':
                // Som de sino
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(830.61, audioContext.currentTime); // G#5
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.8);
                return;

            case 'horn':
                // Som de buzina grave
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(196, audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                return;

            case 'tick':
                // Som de relógio
                for (let i = 0; i < 3; i++) {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(1000, audioContext.currentTime + i * 0.25);
                    gain.gain.setValueAtTime(0.08, audioContext.currentTime + i * 0.25);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.25 + 0.05);
                    osc.start(audioContext.currentTime + i * 0.25);
                    osc.stop(audioContext.currentTime + i * 0.25 + 0.05);
                }
                return;

            case 'party':
                // Som de festa/parabéns - melodia alegre ascendente
                const partyNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                partyNotes.forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.12);
                    gain.gain.setValueAtTime(0.15, audioContext.currentTime + i * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.12 + 0.15);
                    osc.start(audioContext.currentTime + i * 0.12);
                    osc.stop(audioContext.currentTime + i * 0.12 + 0.15);
                });
                // Adiciona um "sparkle" final
                setTimeout(() => {
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        for (let i = 0; i < 4; i++) {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.type = 'triangle';
                            osc.frequency.setValueAtTime(1500 + Math.random() * 1000, ctx.currentTime + i * 0.05);
                            gain.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.05);
                            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.08);
                            osc.start(ctx.currentTime + i * 0.05);
                            osc.stop(ctx.currentTime + i * 0.05 + 0.08);
                        }
                    } catch (e) { }
                }, 500);
                return;
        }
    } catch (e) {
        console.warn('Audio not supported', e);
    }
};

// Componente do painel de emotes
export const EmotePanel: React.FC<EmotePanelProps> = ({ onSendEmote, currentUserId, currentUserName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'emoji' | 'sound'>('emoji');
    const [cooldown, setCooldown] = useState(false);

    const handleSendEmote = (emoteId: string, emoji: string, soundType?: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party') => {
        if (cooldown) return;

        // Play sound locally
        if (soundType) {
            playSound(soundType);
        }

        // Broadcast to others
        onSendEmote({
            emoteId,
            emoji,
            soundType,
            senderId: currentUserId,
            senderName: currentUserName,
            timestamp: Date.now()
        });

        // Cooldown de 2 segundos
        setCooldown(true);
        setTimeout(() => setCooldown(false), 2000);

        // Vibração leve
        if (navigator.vibrate) navigator.vibrate(30);

        setIsOpen(false);
    };

    return (
        <div className="relative">
            {/* Botão de interações - destacado */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={cooldown}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                    transition-all duration-300 shadow-lg
                    ${cooldown
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white hover:shadow-xl hover:scale-105 active:scale-95'
                    }
                    ${isOpen ? 'ring-4 ring-purple-300' : ''}
                `}
            >
                <span className="text-lg animate-bounce" style={{ animationDuration: '2s' }}>😊</span>
                <span className="hidden sm:inline">Interagir</span>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} />
            </button>

            {/* Painel dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 w-[280px] animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        <button
                            onClick={() => setActiveTab('emoji')}
                            className={`flex-1 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'emoji'
                                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <span>😊</span> Emojis
                        </button>
                        <button
                            onClick={() => setActiveTab('sound')}
                            className={`flex-1 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'sound'
                                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                                : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <span>🔊</span> Sons
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-3">
                        {activeTab === 'emoji' ? (
                            <div className="grid grid-cols-3 gap-2">
                                {EMOTES.map((emote) => (
                                    <button
                                        key={emote.id}
                                        onClick={() => handleSendEmote(emote.id, emote.emoji, emote.sound)}
                                        className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 hover:bg-purple-100 transition-all hover:scale-110 active:scale-95"
                                    >
                                        <span className="text-3xl">{emote.emoji}</span>
                                        <span className="text-[10px] text-slate-500">{emote.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {SOUNDS.map((sound) => (
                                    <button
                                        key={sound.id}
                                        onClick={() => handleSendEmote(sound.id, sound.icon, sound.type)}
                                        className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 hover:bg-indigo-100 transition-all hover:scale-110 active:scale-95"
                                    >
                                        <span className="text-3xl">{sound.icon}</span>
                                        <span className="text-[10px] text-slate-500">{sound.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-400 text-center border-t border-slate-100">
                        Todos os jogadores verão sua reação!
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente para exibir emotes recebidos (floating animation)
interface EmoteDisplayProps {
    emotes: EmoteBroadcast[];
    currentUserId: string;
}

export const EmoteDisplay: React.FC<EmoteDisplayProps> = ({ emotes, currentUserId }) => {
    const [visibleEmotes, setVisibleEmotes] = useState<Array<EmoteBroadcast & { key: string }>>([]);

    useEffect(() => {
        if (emotes.length === 0) return;

        const latestEmote = emotes[emotes.length - 1];

        // Não exibe emotes próprios (já tocou o som localmente)
        if (latestEmote.senderId === currentUserId) return;

        // Toca o som se houver
        if (latestEmote.soundType) {
            playSound(latestEmote.soundType);
        }

        // Adiciona à lista de visíveis
        const newEmote = { ...latestEmote, key: `${latestEmote.timestamp}-${Math.random()}` };
        setVisibleEmotes(prev => [...prev, newEmote]);

        // Remove após 3 segundos
        setTimeout(() => {
            setVisibleEmotes(prev => prev.filter(e => e.key !== newEmote.key));
        }, 3000);
    }, [emotes, currentUserId]);

    if (visibleEmotes.length === 0) return null;

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
            {visibleEmotes.map((emote) => (
                <div
                    key={emote.key}
                    className="animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-xl border border-slate-200"
                >
                    <span className="text-3xl animate-bounce">{emote.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">
                        {emote.senderName.split(' ')[0]}
                    </span>
                </div>
            ))}
        </div>
    );
};

export { playSound };
