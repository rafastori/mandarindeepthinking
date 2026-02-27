import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

interface VoiceMicButtonProps {
    wordId: string;
    hasRecording: boolean;
    isRecording: boolean;
    isPlaying: boolean;
    recordingWordId: string | null;
    playingWordId: string | null;
    recordingTime: number;
    onStartRecording: (wordId: string) => void;
    onStopRecording: () => void;
    onPlay: (wordId: string) => void;
    onStopPlaying: () => void;
    size?: 'sm' | 'md';
    variant?: 'light' | 'dark';
}

const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
    wordId,
    hasRecording,
    isRecording,
    isPlaying,
    recordingWordId,
    playingWordId,
    recordingTime,
    onStartRecording,
    onStopRecording,
    onPlay,
    onStopPlaying,
    size = 'sm',
    variant = 'light',
}) => {
    const [showPopover, setShowPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    const isThisRecording = isRecording && recordingWordId === wordId;
    const isThisPlaying = isPlaying && playingWordId === wordId;

    // Close popover on click outside
    useEffect(() => {
        if (!showPopover) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)) {
                setShowPopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPopover]);

    const iconSize = size === 'sm' ? 16 : 20;
    const isDark = variant === 'dark';

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Handle main button click
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isThisRecording) {
            // Stop recording
            onStopRecording();
            setShowPopover(false);
            return;
        }

        if (isThisPlaying) {
            onStopPlaying();
            return;
        }

        if (hasRecording) {
            setShowPopover(!showPopover);
        } else {
            // No recording yet, start recording directly
            onStartRecording(wordId);
        }
    };

    // Button styles
    const getButtonClasses = () => {
        const base = 'relative rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0';
        const sizeClass = size === 'sm' ? 'p-1.5' : 'p-2.5';

        if (isThisRecording) {
            return `${base} ${sizeClass} bg-red-500 text-white animate-pulse scale-125 shadow-lg shadow-red-500/30`;
        }

        if (isThisPlaying) {
            if (isDark) {
                return `${base} ${sizeClass} bg-white/40 text-white animate-pulse`;
            }
            return `${base} ${sizeClass} bg-brand-600 text-white animate-pulse`;
        }

        if (hasRecording) {
            if (isDark) {
                return `${base} ${sizeClass} bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/50 border border-emerald-500/50`;
            }
            return `${base} ${sizeClass} text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200`;
        }

        // No recording
        if (isDark) {
            return `${base} ${sizeClass} bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80`;
        }
        return `${base} ${sizeClass} text-slate-400 hover:text-slate-600 hover:bg-slate-100`;
    };

    const getIcon = () => {
        if (isThisRecording) return 'square'; // Stop icon
        if (isThisPlaying) return 'square';
        return 'mic';
    };

    return (
        <div className="relative inline-flex">
            <button
                ref={btnRef}
                onClick={handleClick}
                className={getButtonClasses()}
                title={
                    isThisRecording ? `Gravando... ${formatTime(recordingTime)} — Clique para parar`
                        : isThisPlaying ? 'Reproduzindo — Clique para parar'
                            : hasRecording ? 'Gravação salva — Clique para opções'
                                : 'Gravar sua voz'
                }
            >
                <Icon name={getIcon()} size={iconSize} />

                {/* Recording timer badge */}
                {isThisRecording && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1 rounded-full min-w-[20px] text-center leading-[16px]">
                        {formatTime(recordingTime)}
                    </span>
                )}
            </button>

            {/* Popover with options */}
            {showPopover && hasRecording && !isThisRecording && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[150px] z-[100] animate-in fade-in slide-in-from-bottom-2"
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPopover(false);
                            if (isThisPlaying) {
                                onStopPlaying();
                            } else {
                                onPlay(wordId);
                            }
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                    >
                        <span className="text-base">🔊</span>
                        {isThisPlaying ? 'Parar' : 'Reproduzir'}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPopover(false);
                            onStartRecording(wordId);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                    >
                        <span className="text-base">🎙️</span>
                        Gravar Novo
                    </button>

                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                        <div className="w-2.5 h-2.5 bg-white border-r border-b border-slate-200 transform rotate-45" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceMicButton;
