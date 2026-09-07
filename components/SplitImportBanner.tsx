import React from 'react';
import Icon from './Icon';
import { SplitImportJob } from '../services/localDB';

interface Props {
    jobs: SplitImportJob[];
    busyJobId: string | null;
    busyIndex: number | null;
    onGenerateNext: (jobId: string) => void;
    onGenerateAll: (jobId: string) => void;
    onStop: () => void;
    onDismiss: (jobId: string) => void;
}

const SplitImportBanner: React.FC<Props> = ({
    jobs,
    busyJobId,
    busyIndex,
    onGenerateNext,
    onGenerateAll,
    onStop,
    onDismiss,
}) => {
    const visible = jobs.filter(job => job.chunks.some(c => c.status !== 'done'));
    if (visible.length === 0) return null;

    return (
        <div className="px-3 pt-3 max-w-3xl mx-auto w-full space-y-2">
            {visible.map(job => {
                const done = job.chunks.filter(c => c.status === 'done').length;
                const next = job.chunks.find(c => c.status === 'pending' || c.status === 'error');
                const busy = busyJobId === job.id;
                return (
                    <div key={job.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900">
                        <Icon name="scissors" size={16} className="text-indigo-600 flex-shrink-0" />
                        <p className="text-xs flex-1 min-w-[140px]">
                            <span className="font-bold">{job.parentFolder}</span>
                            {' · '}{done}/{job.chunks.length} pastas
                            {busy && next ? ` · gerando ${job.chunks[busyIndex ?? next.index]?.folderName}…` : ''}
                            {next && !busy ? ` · próxima: ${next.folderName}` : ''}
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
                                            Gerar próxima
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
                );
            })}
        </div>
    );
};

export default SplitImportBanner;
