import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { StudyItem } from '../types';
import { useLessonAlignment } from '../hooks/useLessonAlignment';
import { formatClockPrecise } from '../utils/audioAlignment';
import { formatClock } from '../utils/chinesePodAudio';

interface Props {
    lessonId: string;
    audioFileId: string;
    items: StudyItem[];
    language?: StudyItem['language'];
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    playingSegmentId: string | null;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeekTo: (seconds: number) => void;
    onPlaySegment: (start: number, end: number, id?: string) => Promise<void> | void;
    onClose: () => void;
}

const AlignmentEditorModal: React.FC<Props> = ({
    lessonId,
    audioFileId,
    items,
    language,
    currentTime,
    duration,
    isPlaying,
    playingSegmentId,
    onPlay,
    onPause,
    onStop,
    onSeekTo,
    onPlaySegment,
    onClose,
}) => {
    const align = useLessonAlignment(lessonId, items);
    const [selectedId, setSelectedId] = useState(items[0]?.id.toString() || '');

    const selectedCue = useMemo(
        () => align.alignment?.cues.find(c => c.itemId === selectedId) || null,
        [align.alignment, selectedId]
    );
    const selectedItem = items.find(item => item.id.toString() === selectedId);

    const goNeighbor = (delta: number) => {
        const index = items.findIndex(item => item.id.toString() === selectedId);
        const next = items[index + delta];
        if (next) setSelectedId(next.id.toString());
    };

    const handleAuto = async () => {
        try {
            await align.runAutoAlign(audioFileId, language);
        } catch {
            // error already stored
        }
    };

    return (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="clock" size={18} className="text-emerald-600" />
                            Alinhar frases · C{lessonId}
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            O áudio nativo precisa ser o diálogo original. Se o texto for outra versão, corrija os tempos na mão.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100" aria-label="Fechar">
                        <Icon name="x" size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={align.busy}
                            onClick={handleAuto}
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {align.busy ? 'Alinhando…' : 'Alinhar automático (Whisper)'}
                        </button>
                        <button
                            type="button"
                            disabled={!align.alignment || align.busy}
                            onClick={() => align.shiftAll(-0.25)}
                            className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            −0,25s todas
                        </button>
                        <button
                            type="button"
                            disabled={!align.alignment || align.busy}
                            onClick={() => align.shiftAll(0.25)}
                            className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            +0,25s todas
                        </button>
                    </div>

                    {align.busy && (
                        <div>
                            <p className="text-xs text-slate-500 mb-1">{align.progressMessage || 'Processando…'}</p>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(align.progress, 100)}%` }} />
                            </div>
                        </div>
                    )}

                    {align.error && (
                        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{align.error}</p>
                    )}

                    {align.alignment && (
                        <p className="text-[11px] text-slate-500">
                            {align.alignment.method === 'whisper'
                                ? `Whisper · confiança média ${(Math.round((align.alignment.averageScore || 0) * 100))}%`
                                : align.alignment.method === 'proportional'
                                    ? 'Divisão proporcional (o texto não bateu com o falado — ajuste na mão)'
                                    : 'Alinhamento manual'}
                            {align.stale ? ' · texto da pasta mudou; vale realinhar.' : ''}
                        </p>
                    )}

                    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={isPlaying ? onPause : onPlay} className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                <Icon name={isPlaying ? 'pause' : 'play'} size={16} />
                            </button>
                            <button type="button" onClick={onStop} className="w-8 h-8 rounded-full border border-slate-200 text-slate-600 flex items-center justify-center">
                                <Icon name="square" size={14} />
                            </button>
                            <div className="flex-1">
                                <button
                                    type="button"
                                    className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
                                        onSeekTo(ratio * (duration || align.alignment?.duration || 0));
                                    }}
                                >
                                    <span className="block h-full bg-emerald-500" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
                                </button>
                                <p className="mt-1 text-[10px] text-slate-500 tabular-nums">
                                    {formatClockPrecise(currentTime)} / {formatClock(duration || align.alignment?.duration || 0)}
                                </p>
                            </div>
                        </div>

                        {selectedItem && (
                            <p className="text-sm text-slate-800 leading-relaxed">
                                {selectedItem.chinese}
                            </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                disabled={!selectedId}
                                onClick={() => align.markTimes(selectedId, { start: currentTime })}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold disabled:opacity-40"
                            >
                                Marcar início
                            </button>
                            <button
                                type="button"
                                disabled={!selectedId}
                                onClick={() => align.markTimes(selectedId, { end: currentTime })}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold disabled:opacity-40"
                            >
                                Marcar fim
                            </button>
                            <button
                                type="button"
                                disabled={!selectedCue}
                                onClick={() => selectedCue && onPlaySegment(selectedCue.start, selectedCue.end, selectedCue.itemId)}
                                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 text-[11px] font-bold disabled:opacity-40"
                            >
                                Ouvir trecho
                            </button>
                            <button
                                type="button"
                                disabled={!align.alignment}
                                onClick={() => align.realignOne(selectedId)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-bold disabled:opacity-40"
                            >
                                Re-alinhar frase
                            </button>
                            <button type="button" onClick={() => goNeighbor(-1)} className="px-2 py-1.5 text-[11px] text-slate-600">←</button>
                            <button type="button" onClick={() => goNeighbor(1)} className="px-2 py-1.5 text-[11px] text-slate-600">→</button>
                        </div>

                        {selectedCue && (
                            <p className="text-[11px] text-slate-500 tabular-nums">
                                Trecho: {formatClockPrecise(selectedCue.start)} → {formatClockPrecise(selectedCue.end)}
                            </p>
                        )}
                    </div>

                    <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                        {items.map((item, index) => {
                            const id = item.id.toString();
                            const cue = align.alignment?.cues.find(c => c.itemId === id);
                            const active = selectedId === id;
                            const playing = playingSegmentId === id;
                            return (
                                <li key={id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(id)}
                                        className={`w-full text-left px-3 py-2 text-sm ${active ? 'bg-emerald-50' : ''} ${playing ? 'ring-1 ring-emerald-300' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>
                                            <span className="flex-1 truncate text-slate-800">{item.chinese}</span>
                                            <span className="text-[10px] tabular-nums text-slate-400">
                                                {cue ? `${formatClockPrecise(cue.start)}–${formatClockPrecise(cue.end)}` : '—'}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {align.alignment && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Apagar os timestamps desta aula? O MP3 continua na biblioteca.')) {
                                    align.clearAlignment();
                                }
                            }}
                            className="w-full py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl"
                        >
                            Limpar alinhamento
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlignmentEditorModal;
