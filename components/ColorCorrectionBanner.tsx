import React, { useEffect } from 'react';
import Icon from './Icon';
import { ColorJobState } from '../services/colorCorrectionJob';

interface Props {
    job: ColorJobState;
}

const ColorCorrectionBanner: React.FC<Props> = ({ job }) => {
    const visible = job.status === 'running' || job.status === 'done' || job.status === 'error';
    useEffect(() => {
        return undefined;
    }, [job.status]);

    if (!visible || (job.status === 'idle')) return null;

    const ratio = job.total > 0 ? Math.min(1, job.done / job.total) : 0;
    const isError = job.status === 'error';
    const isDone = job.status === 'done';

    return (
        <div className="px-3 pt-3 max-w-3xl mx-auto w-full">
            <div className={`p-3 rounded-xl border ${isError
                ? 'bg-red-50 border-red-100 text-red-900'
                : isDone
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                    : 'bg-amber-50 border-amber-100 text-amber-900'
            }`}>
                <div className="flex items-start gap-2">
                    <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center mt-0.5">
                        {job.status === 'running' ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
                        ) : (
                            <Icon name={isError ? 'alert-circle' : 'palette'} size={16} />
                        )}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">
                            {job.message || (job.status === 'running' ? 'Corrigindo cores…' : 'Correção por cores')}
                        </p>
                        {job.status === 'running' && (
                            <p className="text-[11px] mt-0.5 opacity-80">
                                Em segundo plano — pode abrir outra pasta ou aba. Salvamos a cada 3 frases.
                            </p>
                        )}
                        {job.total > 0 && (
                            <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
                                <div
                                    className={`h-full transition-all ${isError ? 'bg-red-400' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.max(6, ratio * 100)}%` }}
                                />
                            </div>
                        )}
                    </div>
                    {job.total > 0 && (
                        <span className="text-[11px] font-bold tabular-nums">
                            {job.done}/{job.total}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ColorCorrectionBanner;
