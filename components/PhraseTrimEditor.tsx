import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { MIN_SEG, clampTime, formatClockPrecise, parseClockPrecise } from '../utils/audioAlignment';

interface Props {
    start?: number;
    end?: number;
    currentTime: number;
    duration: number;
    disabled?: boolean;
    onSeekTo: (seconds: number) => void;
    onChangeRange: (patch: { start?: number; end?: number }) => void;
}

const WINDOW_PRESETS = [4, 8, 16] as const;

function ratioInView(time: number, viewStart: number, viewEnd: number): number {
    const span = Math.max(viewEnd - viewStart, 0.01);
    return Math.min(Math.max((time - viewStart) / span, 0), 1);
}

function TimeField({
    label,
    value,
    duration,
    onCommit,
}: {
    label: string;
    value: number;
    duration: number;
    onCommit: (seconds: number) => void;
}) {
    const [text, setText] = useState(formatClockPrecise(value));
    const [invalid, setInvalid] = useState(false);
    const focusedRef = useRef(false);

    useEffect(() => {
        if (focusedRef.current) return;
        setText(formatClockPrecise(value));
        setInvalid(false);
    }, [value]);

    const commit = () => {
        const parsed = parseClockPrecise(text);
        if (parsed == null) {
            setInvalid(true);
            setText(formatClockPrecise(value));
            return;
        }
        setInvalid(false);
        onCommit(clampTime(parsed, duration));
    };

    return (
        <label className="flex-1 min-w-[7.5rem]">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</span>
            <input
                type="text"
                inputMode="decimal"
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setInvalid(false);
                }}
                onFocus={() => { focusedRef.current = true; }}
                onBlur={() => {
                    focusedRef.current = false;
                    commit();
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                aria-label={label}
                className={`w-full px-2.5 py-2 rounded-lg border text-sm tabular-nums ${
                    invalid ? 'border-rose-400 text-rose-700' : 'border-slate-200 text-slate-800'
                }`}
                placeholder="0:16.6"
            />
        </label>
    );
}

const PhraseTrimEditor: React.FC<Props> = ({
    start,
    end,
    currentTime,
    duration,
    disabled,
    onSeekTo,
    onChangeRange,
}) => {
    const [windowSec, setWindowSec] = useState<number>(8);
    const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
    const [jogOffset, setJogOffset] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<'start' | 'end' | 'playhead' | null>(null);
    const viewRef = useRef({ start: 0, end: 8 });
    const jogRef = useRef({ holding: false, originX: 0, lastTs: 0, time: 0, disp: 0, raf: 0 });

    const hasRange = start != null && end != null;
    const liveStart = draft?.start ?? start ?? Math.max(0, currentTime);
    const liveEnd = draft?.end ?? end ?? Math.min(duration || liveStart + 1, liveStart + Math.max(MIN_SEG, 0.8));

    const mid = (liveStart + liveEnd) / 2;
    const derivedViewStart = duration > 0
        ? Math.max(0, Math.min(mid - windowSec / 2, Math.max(duration - windowSec, 0)))
        : 0;
    const derivedViewEnd = Math.min(duration || derivedViewStart + windowSec, derivedViewStart + windowSec);
    const viewStart = dragRef.current ? viewRef.current.start : derivedViewStart;
    const viewEnd = dragRef.current ? viewRef.current.end : derivedViewEnd;
    viewRef.current = { start: viewStart, end: viewEnd };

    const timeFromX = (clientX: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return currentTime;
        const ratio = (clientX - rect.left) / rect.width;
        return clampTime(viewStart + ratio * (viewEnd - viewStart), duration || viewEnd);
    };

    const persist = (nextStart: number, nextEnd: number) => {
        let s = clampTime(nextStart, duration || nextStart);
        let e = clampTime(nextEnd, duration || nextEnd);
        if (e < s + MIN_SEG) e = Math.min(duration || e, s + MIN_SEG);
        onChangeRange({ start: s, end: e });
    };

    const nudge = (which: 'start' | 'end' | 'playhead', delta: number) => {
        if (which === 'playhead') {
            onSeekTo(clampTime(currentTime + delta, duration || currentTime + delta));
            return;
        }
        if (which === 'start') persist(liveStart + delta, liveEnd);
        else persist(liveStart, liveEnd + delta);
    };

    const onBarPointerDown = (kind: 'start' | 'end' | 'playhead') => (event: React.PointerEvent) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = kind;
        viewRef.current = { start: derivedViewStart, end: derivedViewEnd };
        const t = timeFromX(event.clientX);
        if (kind === 'playhead') {
            onSeekTo(t);
        } else {
            const nextStart = kind === 'start' ? Math.min(t, liveEnd - MIN_SEG) : liveStart;
            const nextEnd = kind === 'end' ? Math.max(t, liveStart + MIN_SEG) : liveEnd;
            setDraft({ start: nextStart, end: nextEnd });
            onSeekTo(kind === 'start' ? nextStart : nextEnd);
        }
    };

    const onBarPointerMove = (event: React.PointerEvent) => {
        const kind = dragRef.current;
        if (!kind) return;
        const t = timeFromX(event.clientX);
        if (kind === 'playhead') {
            onSeekTo(t);
            return;
        }
        const nextStart = kind === 'start' ? Math.min(t, liveEnd - MIN_SEG) : liveStart;
        const nextEnd = kind === 'end' ? Math.max(t, liveStart + MIN_SEG) : liveEnd;
        setDraft({ start: nextStart, end: nextEnd });
        onSeekTo(kind === 'start' ? nextStart : nextEnd);
    };

    const onBarPointerUp = () => {
        const kind = dragRef.current;
        dragRef.current = null;
        if (!kind || kind === 'playhead') return;
        if (draft) persist(draft.start, draft.end);
        setDraft(null);
    };

    const tickJog = (ts: number) => {
        const jog = jogRef.current;
        if (!jog.holding) return;
        const dt = jog.lastTs ? Math.min((ts - jog.lastTs) / 1000, 0.05) : 0.016;
        jog.lastTs = ts;
        const rate = (jog.disp / 72) * 1.4;
        jog.time = clampTime(jog.time + rate * dt, duration || jog.time);
        onSeekTo(jog.time);
        jog.raf = requestAnimationFrame(tickJog);
    };

    const onJogDown = (event: React.PointerEvent) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const jog = jogRef.current;
        jog.holding = true;
        jog.originX = event.clientX;
        jog.lastTs = 0;
        jog.time = currentTime;
        jog.disp = 0;
        setJogOffset(0);
        jog.raf = requestAnimationFrame(tickJog);
    };

    const onJogMove = (event: React.PointerEvent) => {
        if (!jogRef.current.holding) return;
        const disp = event.clientX - jogRef.current.originX;
        jogRef.current.disp = Math.max(-140, Math.min(140, disp));
        setJogOffset(jogRef.current.disp);
    };

    const onJogUp = () => {
        const jog = jogRef.current;
        jog.holding = false;
        jog.disp = 0;
        if (jog.raf) cancelAnimationFrame(jog.raf);
        setJogOffset(0);
    };

    const startPct = ratioInView(liveStart, viewStart, viewEnd) * 100;
    const endPct = ratioInView(liveEnd, viewStart, viewEnd) * 100;
    const playPct = ratioInView(currentTime, viewStart, viewEnd) * 100;
    const widthPct = Math.max(endPct - startPct, 1.2);

    return (
        <div className="space-y-3">
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                    Recorte da frase
                </p>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] tabular-nums text-slate-400">{formatClockPrecise(viewStart)}</span>
                    <div className="flex gap-1">
                        {WINDOW_PRESETS.map(sec => (
                            <button
                                key={sec}
                                type="button"
                                onClick={() => setWindowSec(sec)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    windowSec === sec ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                {sec}s
                            </button>
                        ))}
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-400">{formatClockPrecise(viewEnd)}</span>
                </div>
                <div
                    ref={barRef}
                    className="relative h-12 rounded-lg bg-slate-800 overflow-hidden touch-none select-none"
                    onPointerMove={onBarPointerMove}
                    onPointerUp={onBarPointerUp}
                    onPointerCancel={onBarPointerUp}
                >
                    <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,#64748b_0_2px,transparent_2px_18px)]" />
                    <button
                        type="button"
                        className="absolute inset-0 z-0"
                        aria-label="Posição do áudio"
                        onPointerDown={onBarPointerDown('playhead')}
                    />
                    {hasRange || draft ? (
                        <div
                            className="absolute top-1 bottom-1 rounded-md bg-emerald-400/35 border-2 border-emerald-400 z-10 pointer-events-none"
                            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                        />
                    ) : null}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                        style={{ left: `${playPct}%` }}
                    />
                    <button
                        type="button"
                        aria-label="Início do trecho"
                        disabled={disabled}
                        onPointerDown={onBarPointerDown('start')}
                        className="absolute top-0 bottom-0 w-4 -ml-2 z-30 rounded-sm bg-emerald-400 flex items-center justify-center touch-none"
                        style={{ left: `${startPct}%` }}
                    >
                        <span className="w-0.5 h-6 bg-emerald-900/70 rounded-full" />
                    </button>
                    <button
                        type="button"
                        aria-label="Fim do trecho"
                        disabled={disabled}
                        onPointerDown={onBarPointerDown('end')}
                        className="absolute top-0 bottom-0 w-4 -ml-2 z-30 rounded-sm bg-emerald-400 flex items-center justify-center touch-none"
                        style={{ left: `${endPct}%` }}
                    >
                        <span className="w-0.5 h-6 bg-emerald-900/70 rounded-full" />
                    </button>
                </div>
            </div>

            <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                    Recuar / avançar aos poucos
                </p>
                <div
                    className="relative h-11 rounded-xl border border-slate-200 bg-slate-50 touch-none select-none overflow-hidden"
                    onPointerDown={onJogDown}
                    onPointerMove={onJogMove}
                    onPointerUp={onJogUp}
                    onPointerCancel={onJogUp}
                    role="slider"
                    aria-label="Arraste para a esquerda para recuar e para a direita para avançar"
                    aria-valuemin={0}
                    aria-valuemax={duration || 0}
                    aria-valuenow={currentTime}
                >
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-bold text-slate-400 pointer-events-none">
                        <span className="flex items-center gap-1">
                            <Icon name="skip-back" size={12} /> recuar
                        </span>
                        <span className="flex items-center gap-1">
                            avançar <Icon name="skip-forward" size={12} />
                        </span>
                    </div>
                    <div
                        className="absolute top-1.5 bottom-1.5 w-10 rounded-lg bg-emerald-600 shadow-md pointer-events-none"
                        style={{ left: `calc(50% - 1.25rem + ${jogOffset}px)` }}
                    />
                </div>
                <div className="mt-1.5 flex justify-center gap-2">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => nudge('playhead', -0.1)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700"
                    >
                        −0,1s
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => nudge('playhead', 0.1)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700"
                    >
                        +0,1s
                    </button>
                </div>
            </div>

            <div className="flex gap-2">
                <TimeField
                    label="Início (digite)"
                    value={liveStart}
                    duration={duration || liveStart}
                    onCommit={(seconds) => persist(seconds, liveEnd)}
                />
                <TimeField
                    label="Fim (digite)"
                    value={liveEnd}
                    duration={duration || liveEnd}
                    onCommit={(seconds) => persist(liveStart, seconds)}
                />
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => nudge('start', -0.1)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600"
                >
                    Início −0,1s
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => nudge('start', 0.1)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600"
                >
                    Início +0,1s
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => nudge('end', -0.1)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600"
                >
                    Fim −0,1s
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => nudge('end', 0.1)}
                    className="flex-1 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600"
                >
                    Fim +0,1s
                </button>
            </div>
            <p className="text-[10px] text-slate-400">
                Arraste as alças verdes como no recorte de vídeo. Ou digite o tempo, por exemplo 0:16.6
            </p>
        </div>
    );
};

export default PhraseTrimEditor;
