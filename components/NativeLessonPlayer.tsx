import React from 'react';
import Icon from './Icon';
import { formatClock, SUFFIX_LABELS } from '../utils/chinesePodAudio';
import { NativeLessonMatch } from '../hooks/useNativeLessonAudio';

interface Props {
    match: NativeLessonMatch | null;
    hasLibrary: boolean;
    isPlaying: boolean;
    isLooping: boolean;
    currentTime: number;
    duration: number;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onReplay: () => void;
    onToggleLoop: () => void;
    onSeek: (ratio: number) => void;
    onOpenLibrary: () => void;
    canSuggestLink?: boolean;
}

const NativeLessonPlayer: React.FC<Props> = ({
    match,
    hasLibrary,
    isPlaying,
    isLooping,
    currentTime,
    duration,
    onPlay,
    onPause,
    onStop,
    onReplay,
    onToggleLoop,
    onSeek,
    onOpenLibrary,
    canSuggestLink = false,
}) => {
    if (!match && !hasLibrary && canSuggestLink) {
        return (
            <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-800">
                <Icon name="music" size={16} className="flex-shrink-0" />
                <p className="text-xs flex-1">
                    Esta pasta parece uma aula ChinesePod. Vincule os MP3 locais para ouvir o áudio nativo em vez do TTS.
                </p>
                <button
                    type="button"
                    onClick={onOpenLibrary}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
                >
                    Vincular
                </button>
            </div>
        );
    }

    if (!match) {
        if (!hasLibrary) return null;
        return (
            <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                <Icon name="volume-2" size={16} className="text-slate-400 flex-shrink-0" />
                <p className="text-xs flex-1">
                    <span className="font-semibold">TTS</span>
                    <span className="text-slate-400"> · sem MP3 nativo para esta pasta</span>
                </p>
                <button
                    type="button"
                    onClick={onOpenLibrary}
                    className="text-[11px] font-semibold text-brand-600 hover:underline"
                >
                    Biblioteca
                </button>
            </div>
        );
    }

    const suffixLabel = match.file.suffix ? SUFFIX_LABELS[match.file.suffix] : 'Áudio';
    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

    return (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5">
            <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide">
                    <Icon name="music" size={10} />
                    Nativo
                </span>
                <p className="text-xs text-emerald-900 min-w-0 truncate flex-1" title={match.file.fileName}>
                    C{match.lessonId} · {suffixLabel}
                    <span className="text-emerald-700/70"> · {match.file.fileName}</span>
                </p>
                <button
                    type="button"
                    onClick={onOpenLibrary}
                    className="text-[11px] font-semibold text-emerald-800 hover:underline flex-shrink-0"
                >
                    Trocar
                </button>
            </div>

            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={isPlaying ? onPause : onPlay}
                    className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
                    title={isPlaying ? 'Pausar áudio nativo' : 'Ouvir áudio nativo'}
                    aria-label={isPlaying ? 'Pausar áudio nativo' : 'Ouvir áudio nativo'}
                >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
                </button>
                <button
                    type="button"
                    onClick={onReplay}
                    className="w-8 h-8 rounded-full bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100"
                    title="Repetir do início"
                >
                    <Icon name="rotate-ccw" size={14} />
                </button>
                <button
                    type="button"
                    onClick={onToggleLoop}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center ${isLooping
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title={isLooping ? 'Repetição ligada' : 'Repetir em loop'}
                >
                    <Icon name="repeat" size={14} />
                </button>
                <button
                    type="button"
                    onClick={onStop}
                    className="w-8 h-8 rounded-full bg-white text-slate-500 border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                    title="Parar"
                >
                    <Icon name="square" size={14} />
                </button>

                <div className="flex-1 min-w-0 ml-1">
                    <button
                        type="button"
                        className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden"
                        title="Progresso"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
                            onSeek(ratio);
                        }}
                    >
                        <span
                            className="block h-full bg-emerald-500"
                            style={{ width: `${progress * 100}%` }}
                        />
                    </button>
                    <p className="mt-1 text-[10px] text-emerald-800/80 tabular-nums">
                        {formatClock(currentTime)} / {formatClock(duration)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NativeLessonPlayer;
