import React, { useEffect } from 'react';
import Icon from './Icon';
import { SplitImportJob } from '../services/localDB';
import { ReadyFolder } from '../hooks/useSplitImportJobs';

interface Props {
    jobs: SplitImportJob[];
    busyJobId: string | null;
    busyIndex: number | null;
    lastReady?: ReadyFolder | null;
    onGenerateNext: (jobId: string) => void;
    onGenerateAll: (jobId: string) => void;
    onStop: () => void;
    onDismiss: (jobId: string) => void;
    onOpenFolder?: (folderPath: string) => void;
    onClearReady?: () => void;
}

const SplitImportBanner: React.FC<Props> = ({
    jobs,
    busyJobId,
    busyIndex,
    lastReady,
    onGenerateNext,
    onGenerateAll,
    onStop,
    onDismiss,
    onOpenFolder,
    onClearReady,
}) => {
    useEffect(() => {
        if (!lastReady) return undefined;
        const timer = window.setTimeout(() => onClearReady?.(), 12000);
        return () => window.clearTimeout(timer);
    }, [lastReady, onClearReady]);

    const visible = jobs.filter(job => job.chunks.some(c => c.status !== 'done'));
    if (visible.length === 0 && !lastReady) return null;

    return (
        <div className="px-3 pt-3 max-w-3xl mx-auto w-full space-y-2">
            {visible.map(job => {
                const done = job.chunks.filter(c => c.status === 'done').length;
                const processing = job.chunks.find(c => c.status === 'processing');
                const next = job.chunks.find(c => c.status === 'pending' || c.status === 'error');
                const busy = busyJobId === job.id;
                const current = processing || (busy ? job.chunks[busyIndex ?? next?.index ?? 0] : null);
                const ratio = job.chunks.length > 0 ? done / job.chunks.length : 0;
                const failed = next?.status === 'error';
                return (
                    <div key={job.id} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                {busy ? (
                                    <span className="h-3.5 w-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                                ) : (
                                    <Icon name="scissors" size={16} className="text-indigo-600" />
                                )}
                            </span>
                            <p className="text-xs flex-1 min-w-[140px]">
                                <span className="font-bold">{job.parentFolder}</span>
                                {' · '}{done}/{job.chunks.length} pastas
                                {busy && current ? ` · gerando ${current.folderName}…` : ''}
                                {!busy && next && !failed ? ` · próxima: ${next.folderName}` : ''}
                                {failed ? ` · erro em ${next.folderName}` : ''}
                                <span className="block text-[11px] text-indigo-700/80 mt-0.5">
                                    Em segundo plano — pode continuar usando o app
                                </span>
                            </p>
                            <div className="flex items-center gap-1.5">
                                {busy ? (
                                    <button
                                        type="button"
                                        onClick={onStop}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-slate-600 border border-slate-200"
                                    >
                                        Pausar
                                    </button>
                                ) : (
                                    <>
                                        {next && (
                                            <button
                                                type="button"
                                                onClick={() => onGenerateNext(job.id)}
                                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white"
                                            >
                                                {failed ? 'Tentar de novo' : 'Gerar próxima'}
                                            </button>
                                        )}
                                        {next && job.chunks.filter(c => c.status !== 'done').length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => onGenerateAll(job.id)}
                                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-indigo-700 border border-indigo-200"
                                            >
                                                Todas
                                            </button>
                                        )}
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onDismiss(job.id)}
                                    className="p-1 text-indigo-400 hover:text-indigo-700"
                                    title="Dispensar fila (não apaga pastas já geradas)"
                                >
                                    <Icon name="x" size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.round(ratio * 100)}%` }}
                            />
                        </div>
                    </div>
                );
            })}
            {lastReady && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900">
                    <Icon name="check-circle" size={16} className="text-emerald-600 flex-shrink-0" />
                    <p className="text-xs flex-1 min-w-[140px]">
                        <span className="font-bold">{lastReady.folderName}</span> pronta e disponível
                        {lastReady.remaining > 0 ? ` · faltam ${lastReady.remaining}` : ''}
                    </p>
                    {onOpenFolder && (
                        <button
                            type="button"
                            onClick={() => onOpenFolder(lastReady.folderPath)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white"
                        >
                            Abrir pasta
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClearReady}
                        className="p-1 text-emerald-400 hover:text-emerald-700"
                        title="Dispensar"
                    >
                        <Icon name="x" size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default SplitImportBanner;
