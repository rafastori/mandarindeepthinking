import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { StudyItem } from '../types';
import { useLessonAlignment } from '../hooks/useLessonAlignment';
import {
    DEFAULT_INTRO_SKIP_SECONDS,
    INTRO_SKIP_PRESETS,
    effectiveCueTimes,
    formatClockPrecise,
    isLiveCueComplete,
} from '../utils/audioAlignment';
import { formatClock } from '../utils/chinesePodAudio';
import { nativeAudioLibrary } from '../services/nativeAudioLibrary';
import PhraseTrimEditor from './PhraseTrimEditor';

interface Props {
    lessonId: string;
    audioFileId: string;
    items: StudyItem[];
    language?: StudyItem['language'];
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    playingSegmentId: string | null;
    onPlay: (startAtIfIdle?: number) => void;
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
    const [introSkip, setIntroSkip] = useState(DEFAULT_INTRO_SKIP_SECONDS);
    const [liveMode, setLiveMode] = useState(false);
    const [liveHint, setLiveHint] = useState<{ type: 'error' | 'ok' | 'info'; text: string } | null>(null);
    const playheadRef = useRef(currentTime);
    playheadRef.current = currentTime;
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const summary = await nativeAudioLibrary.getSummary();
                const stored = align.alignment?.introSkipSeconds ?? summary.introSkipSeconds;
                if (!cancelled && typeof stored === 'number') setIntroSkip(stored);
            } catch {
                if (align.alignment?.introSkipSeconds != null) setIntroSkip(align.alignment.introSkipSeconds);
            }
        })();
        return () => { cancelled = true; };
    }, [align.alignment?.introSkipSeconds]);

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
            await nativeAudioLibrary.setIntroSkipSeconds(introSkip);
            await align.runAutoAlign(audioFileId, language, introSkip);
        } catch {
            // error already stored
        }
    };

    const playSelectedCue = () => {
        if (!selectedCue) return;
        const times = effectiveCueTimes(selectedCue, introSkip, duration || align.alignment?.duration);
        if (times) onPlaySegment(times.start, times.end, selectedCue.itemId);
    };

    const applyCuePatch = async (patch: { start?: number; end?: number }) => {
        if (!selectedId) return;
        await align.ensureManualAlignment(audioFileId, duration || align.alignment?.duration || 0, introSkip);
        await align.markTimes(selectedId, patch);
    };

    const showLiveHint = useCallback((type: 'error' | 'ok' | 'info', text: string) => {
        setLiveHint({ type, text });
        window.setTimeout(() => {
            setLiveHint(prev => (prev?.text === text ? null : prev));
        }, 2200);
    }, []);

    const selectedIndex = items.findIndex(item => item.id.toString() === selectedId);
    const currentHasStart = !!selectedCue;
    const markedCount = items.filter(item =>
        isLiveCueComplete(align.alignment?.cues.find(cue => cue.itemId === item.id.toString()))
    ).length;
    const allMarked = items.length > 0 && markedCount === items.length;

    const startLiveListening = async () => {
        const total = duration || align.alignment?.duration || 0;
        const ensured = await align.ensureManualAlignment(audioFileId, total, introSkip);
        const firstOpen = items.find(item =>
            !isLiveCueComplete(ensured?.cues.find(cue => cue.itemId === item.id.toString()))
        );
        if (firstOpen) setSelectedId(firstOpen.id.toString());
        setLiveMode(true);
        setLiveHint(null);
        if (currentTime < introSkip - 0.05) onSeekTo(introSkip);
        if (!isPlaying) onPlay(introSkip);
        showLiveHint('info', 'Ouça o diálogo e toque em Início / Fim. O áudio continua.');
    };

    const handleLiveStart = useCallback(async () => {
        const id = selectedIdRef.current;
        if (!id) return;
        const time = playheadRef.current;
        await align.ensureManualAlignment(audioFileId, duration || align.alignment?.duration || 0, introSkip);
        const result = await align.markLiveStart(id, time, introSkip);
        if (!result.ok) {
            showLiveHint('error', 'Não há alinhamento para gravar. Toque em Marcar enquanto ouve.');
            return;
        }
        if (result.clampedToIntro) {
            showLiveHint('info', `Início ajustado para depois da intro (${formatClockPrecise(result.start)}).`);
        } else {
            showLiveHint('ok', `Início em ${formatClockPrecise(result.start)}.`);
        }
    }, [align, audioFileId, duration, introSkip, showLiveHint]);

    const handleLiveEnd = useCallback(async () => {
        const id = selectedIdRef.current;
        if (!id) return;
        const time = playheadRef.current;
        const index = items.findIndex(item => item.id.toString() === id);
        const following = index >= 0 ? items[index + 1] : undefined;
        const result = await align.markLiveEnd(id, following?.id.toString(), time);
        if (result.ok === false) {
            if (result.reason === 'no_start') {
                showLiveHint('error', 'Marque o início primeiro.');
            } else if (result.reason === 'end_before_start') {
                showLiveHint('error', 'O fim precisa ser depois do início.');
            } else {
                showLiveHint('error', 'Toque em Marcar enquanto ouve para começar.');
            }
            return;
        }
        if (following) {
            setSelectedId(following.id.toString());
            showLiveHint('ok', `Fim em ${formatClockPrecise(result.end)}. Próxima frase…`);
        } else {
            showLiveHint('ok', 'Todas as frases marcadas.');
        }
    }, [align, items, showLiveHint]);

    useEffect(() => {
        if (!liveMode || duration <= 0) return;
        if ((align.alignment?.duration || 0) >= duration - 0.05) return;
        align.ensureManualAlignment(audioFileId, duration, introSkip);
    }, [align, audioFileId, duration, introSkip, liveMode]);

    useEffect(() => {
        if (!liveMode) return;
        const onKey = (event: KeyboardEvent) => {
            const tag = (event.target as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.code === 'Space' || event.key === ' ') {
                event.preventDefault();
                handleLiveEnd();
            } else if (event.key === 'i' || event.key === 'I') {
                event.preventDefault();
                handleLiveStart();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [liveMode, handleLiveEnd, handleLiveStart]);

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
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <label className="block text-xs font-bold text-amber-900" htmlFor="intro-skip-seconds">
                            Pular intro (segundos)
                        </label>
                        <p className="text-[11px] text-amber-800/80 mt-0.5">
                            Os DG do ChinesePod começam com ~6s de inglês. O Whisper e o playback só usam o diálogo depois disso.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <input
                                id="intro-skip-seconds"
                                type="number"
                                min={0}
                                max={30}
                                step={0.5}
                                value={introSkip}
                                onChange={(e) => setIntroSkip(Math.max(0, Number(e.target.value) || 0))}
                                className="w-20 px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-sm tabular-nums text-amber-950"
                            />
                            <span className="text-[11px] text-amber-800">padrão 6</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {INTRO_SKIP_PRESETS.map(value => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setIntroSkip(value)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${introSkip === value
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white text-amber-900 border-amber-200'
                                    }`}
                                >
                                    {String(value).replace('.', ',')}s
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => onPlaySegment(0, introSkip || 0.5, 'intro')}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-semibold text-amber-900"
                            >
                                Ouvir intro
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onSeekTo(introSkip);
                                    onPlaySegment(introSkip, introSkip + 4, 'dialogue-start');
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-semibold text-amber-900"
                            >
                                Ouvir início do diálogo
                            </button>
                            <button
                                type="button"
                                disabled={!align.alignment || align.busy}
                                onClick={() => align.applyIntroSkip(introSkip, true)}
                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-semibold text-amber-900 disabled:opacity-40"
                            >
                                Aplicar {String(introSkip).replace('.', ',')}s nas frases atuais
                            </button>
                        </div>
                    </div>

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

                    <div className={`rounded-xl border p-3 space-y-2 ${liveMode ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Icon name="target" size={16} className="text-emerald-600" />
                                    Marcar enquanto ouve
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Uma escuta só: Início na 1ª frase, depois só Fim. A próxima começa onde a anterior termina.
                                </p>
                            </div>
                            {liveMode ? (
                                <button
                                    type="button"
                                    onClick={() => setLiveMode(false)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 bg-white text-slate-600"
                                >
                                    Sair
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={align.busy || items.length === 0}
                                    onClick={startLiveListening}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white disabled:opacity-40"
                                >
                                    Começar
                                </button>
                            )}
                        </div>

                        {liveMode && (
                            <>
                                <p className="text-[11px] font-semibold text-emerald-900 tabular-nums">
                                    Frase {Math.max(selectedIndex, 0) + 1} de {items.length}
                                    {allMarked ? ' · todas marcadas' : ` · ${markedCount} pronta${markedCount === 1 ? '' : 's'}`}
                                    {' · '}{formatClockPrecise(currentTime)}
                                    {currentTime < introSkip - 0.05 ? ' · ainda na intro' : ''}
                                </p>
                                {selectedItem && (
                                    <p className="text-lg leading-snug text-slate-900 font-medium">
                                        {selectedItem.chinese}
                                    </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={handleLiveStart}
                                        className={`min-h-[3.25rem] rounded-xl text-sm font-bold border ${currentHasStart
                                            ? 'bg-white text-slate-700 border-slate-200'
                                            : 'bg-slate-800 text-white border-slate-800'
                                        }`}
                                    >
                                        {currentHasStart ? 'Remarcar início' : 'Início'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLiveEnd}
                                        className="min-h-[3.25rem] rounded-xl text-sm font-bold bg-emerald-600 text-white border border-emerald-600"
                                    >
                                        Fim
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                    No computador: espaço = Fim, I = Início. O áudio não para.
                                </p>
                            </>
                        )}
                    </div>

                    {liveHint && (
                        <p className={`text-sm rounded-lg px-3 py-2 border ${liveHint.type === 'error'
                            ? 'text-rose-700 bg-rose-50 border-rose-100'
                            : liveHint.type === 'ok'
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-100'
                                : 'text-slate-700 bg-slate-50 border-slate-200'
                        }`}>
                            {liveHint.text}
                        </p>
                    )}

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
                            {align.alignment.introSkipSeconds != null
                                ? ` · intro ${String(align.alignment.introSkipSeconds).replace('.', ',')}s pulada`
                                : ''}
                            {align.stale ? ' · texto da pasta mudou; vale realinhar.' : ''}
                        </p>
                    )}

                    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={isPlaying ? onPause : () => onPlay(liveMode ? introSkip : undefined)} className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
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

                        <PhraseTrimEditor
                            key={selectedId}
                            start={selectedCue?.start}
                            end={selectedCue?.end}
                            currentTime={currentTime}
                            duration={duration || align.alignment?.duration || 0}
                            disabled={!selectedId}
                            onSeekTo={onSeekTo}
                            onChangeRange={applyCuePatch}
                        />

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
                                onClick={playSelectedCue}
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
                    </div>

                    <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                        {items.map((item, index) => {
                            const id = item.id.toString();
                            const cue = align.alignment?.cues.find(c => c.itemId === id);
                            const active = selectedId === id;
                            const playing = playingSegmentId === id;
                            const complete = isLiveCueComplete(cue);
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
                                            <span className={`text-[10px] tabular-nums ${complete ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                {cue
                                                    ? `${formatClockPrecise(cue.start)}–${complete ? formatClockPrecise(cue.end) : '…'}`
                                                    : '—'}
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
