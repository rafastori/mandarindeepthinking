import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { MIN_SEG, formatClockPrecise, parseClockPrecise } from '../utils/audioAlignment';

interface Props {
    start?: number;
    end?: number;
    currentTime: number;
    duration: number;
    disabled?: boolean;
    onSeekTo: (seconds: number) => void;
    onChangeRange: (patch: { start?: number; end?: number }) => void | Promise<void>;
}

const WINDOW_PRESETS = [4, 8, 16] as const;

type DragKind = 'start' | 'end' | 'playhead';

function ratioInView(time: number, viewStart: number, viewEnd: number): number {
    const span = Math.max(viewEnd - viewStart, 0.01);
    return Math.min(Math.max((time - viewStart) / span, 0), 1);
}

function clampRange(nextStart: number, nextEnd: number, duration: number): { start: number; end: number } {
    const cap = duration > 0 ? duration : Math.max(nextEnd, nextStart + MIN_SEG, 1);
    let s = Number.isFinite(nextStart) ? Math.max(0, nextStart) : 0;
    let e = Number.isFinite(nextEnd) ? Math.max(0, nextEnd) : s + MIN_SEG;
    s = Math.min(s, Math.max(0, cap - MIN_SEG));
    e = Math.min(Math.max(e, s + MIN_SEG), cap);
    if (e - s < MIN_SEG) e = Math.min(cap, s + MIN_SEG);
    return { start: s, end: e };
}

function defaultRange(start: number | undefined, end: number | undefined, currentTime: number, duration: number) {
    if (start != null && end != null) return { start, end };
    const s = Math.max(0, currentTime);
    const e = Math.min(duration > 0 ? duration : s + 1, s + Math.max(MIN_SEG, 0.8));
    return { start: s, end: e };
}

function viewStartFor(mid: number, windowSec: number, duration: number) {
    if (duration > 0) {
        return Math.max(0, Math.min(mid - windowSec / 2, Math.max(duration - windowSec, 0)));
    }
    return Math.max(0, mid - windowSec / 2);
}

function TimeField({
    label,
    value,
    onCommit,
}: {
    label: string;
    value: number;
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
        onCommit(parsed);
    };

    return (
        <label className="flex-1 min-w-[7.5rem]">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</span>
            <input
                type="text"
                inputMode="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
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
    const initial = defaultRange(start, end, currentTime, duration);
    const [windowSec, setWindowSec] = useState<number>(8);
    const [range, setRange] = useState(initial);
    const [viewStart, setViewStart] = useState(() => viewStartFor((initial.start + initial.end) / 2, 8, duration));
    const [jogOffset, setJogOffset] = useState(0);

    const barRef = useRef<HTMLDivElement>(null);
    const rangeRef = useRef(range);
    const viewRef = useRef({ start: 0, end: 8 });
    const dragRef = useRef<{ kind: DragKind; pointerId: number } | null>(null);
    const dirtyRef = useRef(false);
    const persistSeq = useRef(0);
    const jogRef = useRef({ holding: false, originX: 0, originT: 0 });

    const viewEnd = viewStart + windowSec;
    viewRef.current = { start: viewStart, end: viewEnd };

    useEffect(() => {
        if (dragRef.current) return;
        if (dirtyRef.current) return;
        if (start == null || end == null) return;
        const next = { start, end };
        rangeRef.current = next;
        setRange(next);
    }, [start, end]);

    useEffect(() => {
        setViewStart(viewStartFor((rangeRef.current.start + rangeRef.current.end) / 2, windowSec, duration));
    }, [windowSec, duration]);

    const persist = (nextStart: number, nextEnd: number, seek?: 'start' | 'end') => {
        const clamped = clampRange(nextStart, nextEnd, duration);
        dirtyRef.current = true;
        persistSeq.current += 1;
        const token = persistSeq.current;
        rangeRef.current = clamped;
        setRange(clamped);
        const result = onChangeRange({ start: clamped.start, end: clamped.end });
        void Promise.resolve(result).finally(() => {
            if (persistSeq.current === token) dirtyRef.current = false;
        });
        if (seek) onSeekTo(seek === 'start' ? clamped.start : clamped.end);
        return clamped;
    };

    const timeFromX = (clientX: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        const vs = viewRef.current.start;
        const ve = viewRef.current.end;
        if (!rect || rect.width <= 0) return rangeRef.current.start;
        const ratio = (clientX - rect.left) / rect.width;
        const t = vs + ratio * (ve - vs);
        if (duration > 0) return Math.min(Math.max(t, 0), duration);
        return Math.max(t, 0);
    };

    const secondsPerPx = () => {
        const width = barRef.current?.getBoundingClientRect().width || 0;
        return width > 0 ? windowSec / width : 0.04;
    };

    const applyDrag = (kind: DragKind, clientX: number) => {
        const t = timeFromX(clientX);
        if (kind === 'playhead') {
            onSeekTo(t);
            return;
        }
        const current = rangeRef.current;
        const nextStart = kind === 'start' ? Math.min(t, current.end - MIN_SEG) : current.start;
        const nextEnd = kind === 'end' ? Math.max(t, current.start + MIN_SEG) : current.end;
        const clamped = clampRange(nextStart, nextEnd, duration);
        dirtyRef.current = true;
        rangeRef.current = clamped;
        setRange(clamped);
        onSeekTo(kind === 'start' ? clamped.start : clamped.end);
    };

    const onBarPointerDown = (kind: DragKind) => (event: React.PointerEvent) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { kind, pointerId: event.pointerId };
        applyDrag(kind, event.clientX);
    };

    const onBarPointerMove = (event: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        applyDrag(drag.kind, event.clientX);
    };

    const onBarPointerUp = (event: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (drag.kind === 'start' || drag.kind === 'end') {
            persist(rangeRef.current.start, rangeRef.current.end, drag.kind);
        }
    };

    const onJogDown = (event: React.PointerEvent) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        jogRef.current = { holding: true, originX: event.clientX, originT: currentTime };
        setJogOffset(0);
    };

    const onJogMove = (event: React.PointerEvent) => {
        if (!jogRef.current.holding) return;
        const dx = event.clientX - jogRef.current.originX;
        setJogOffset(Math.max(-140, Math.min(140, dx)));
        onSeekTo(Math.max(0, jogRef.current.originT + dx * secondsPerPx()));
    };

    const onJogUp = () => {
        jogRef.current.holding = false;
        setJogOffset(0);
    };

    const nudge = (which: 'start' | 'end' | 'playhead', delta: number) => {
        if (which === 'playhead') {
            const cap = duration > 0 ? duration : currentTime + Math.abs(delta);
            onSeekTo(Math.min(Math.max(currentTime + delta, 0), cap));
            return;
        }
        if (which === 'start') persist(range.start + delta, range.end, 'start');
        else persist(range.start, range.end + delta, 'end');
    };

    const startPct = ratioInView(range.start, viewStart, viewEnd) * 100;
    const endPct = ratioInView(range.end, viewStart, viewEnd) * 100;
    const playPct = ratioInView(currentTime, viewStart, viewEnd) * 100;
    const widthPct = Math.max(endPct - startPct, 1.2);
    const pointerBind = {
        onPointerMove: onBarPointerMove,
        onPointerUp: onBarPointerUp,
        onPointerCancel: onBarPointerUp,
    };

    return (
        <div className="space-y-3">
            <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Recorte da frase
                    </p>
                    <p className="text-[11px] font-bold tabular-nums text-slate-700">
                        {formatClockPrecise(range.start)} → {formatClockPrecise(range.end)}
                    </p>
                </div>
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
                    {...pointerBind}
                >
                    <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,#64748b_0_2px,transparent_2px_18px)]" />
                    <button
                        type="button"
                        className="absolute inset-0 z-0"
                        aria-label="Posição do áudio"
                        onPointerDown={onBarPointerDown('playhead')}
                        {...pointerBind}
                    />
                    <div
                        className="absolute top-1 bottom-1 rounded-md bg-emerald-400/35 border-2 border-emerald-400 z-10 pointer-events-none"
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                    />
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
                        style={{ left: `${playPct}%` }}
                    />
                    <button
                        type="button"
                        aria-label="Início do trecho"
                        disabled={disabled}
                        onPointerDown={onBarPointerDown('start')}
                        {...pointerBind}
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
                        {...pointerBind}
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
                    aria-label="Arraste: o tempo fica onde você soltar"
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
                    value={range.start}
                    onCommit={(seconds) => persist(seconds, rangeRef.current.end, 'start')}
                />
                <TimeField
                    label="Fim (digite)"
                    value={range.end}
                    onCommit={(seconds) => persist(rangeRef.current.start, seconds, 'end')}
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
                Arraste as alças verdes. Digite 0:16.6 ou 16.6. Arrastar o início para a esquerda encurta a frase anterior, se precisar.
            </p>
        </div>
    );
};

export default PhraseTrimEditor;
