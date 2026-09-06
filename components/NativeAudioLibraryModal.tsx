import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useNativeAudioLibrary } from '../hooks/useNativeLessonAudio';
import {
    CHINESEPOD_SUFFIXES,
    SUFFIX_LABELS,
    formatBytes,
    ChinesePodSuffix,
} from '../utils/chinesePodAudio';

interface Props {
    onClose: () => void;
}

const NativeAudioLibraryModal: React.FC<Props> = ({ onClose }) => {
    const {
        summary,
        busy,
        error,
        lastImport,
        supportsDirectoryPicker,
        importFileList,
        importDirectory,
        reconnectDirectory,
        clearLibrary,
        setPreferredSuffix,
        setKeepLargeFiles,
        setImportMode,
        setIntroSkipSeconds,
    } = useNativeAudioLibrary();

    const filesInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const dgOnly = (summary?.importMode || 'dg-only') === 'dg-only';

    useEffect(() => {
        const input = folderInputRef.current;
        if (!input) return;
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
    }, []);

    const handleFiles = async (list: FileList | null, sourceLabel?: string) => {
        if (!list || list.length === 0) return;
        try {
            await importFileList(list, sourceLabel);
        } catch {
            // error already stored in hook
        }
    };

    const handleClear = async () => {
        if (!window.confirm('Remover os MP3 nativos deste aparelho? Os textos, o TTS e os timestamps continuam.')) {
            return;
        }
        await clearLibrary();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="music" size={18} className="text-emerald-600" />
                            Áudio nativo ChinesePod
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Só neste aparelho — os MP3 não vão para a nuvem.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Fechar"
                        aria-label="Fechar"
                    >
                        <Icon name="x" size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-sm font-bold text-emerald-900">Só digestivo (dg)</p>
                        <p className="text-xs text-emerald-800/80 mt-1">
                            Da pasta Baixados, o app guarda só <code className="bg-white/70 px-1 rounded">chinesepod_C2458dg.mp3</code>
                            {' '}(~400 KB). Podcasts, revisões e PDFs são ignorados — o navegador não reescreve a pasta do Android.
                        </p>
                        <div className="mt-2 flex gap-1 bg-white p-1 rounded-lg border border-emerald-100">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setImportMode('dg-only')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold ${dgOnly ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                            >
                                Só digestivo (dg)
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => { setImportMode('include-other'); setShowAdvanced(true); }}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold ${!dgOnly ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                            >
                                Incluir pr/rv
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {supportsDirectoryPicker && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => importDirectory().catch(() => undefined)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50"
                            >
                                <Icon name="folder-open" size={16} />
                                Selecionar pasta
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => filesInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                        >
                            <Icon name="file" size={16} />
                            Selecionar arquivos
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => folderInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 sm:col-span-2"
                        >
                            <Icon name="folder" size={16} />
                            Pasta (mobile / Chrome)
                        </button>
                    </div>

                    <input
                        ref={filesInputRef}
                        type="file"
                        accept="audio/mpeg,audio/mp3,.mp3,audio/mp4,.m4a,audio/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            handleFiles(e.target.files, `${e.target.files?.length || 0} arquivo(s)`);
                            e.target.value = '';
                        }}
                    />
                    <input
                        ref={folderInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            handleFiles(e.target.files, e.target.files?.[0]?.webkitRelativePath?.split('/')[0] || 'Pasta');
                            e.target.value = '';
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                        {showAdvanced ? '▾ Avançado' : '▸ Avançado (podcast / revisão)'}
                    </button>

                    {showAdvanced && (
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Preferir tipo (modo avançado)</p>
                                <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200">
                                    {CHINESEPOD_SUFFIXES.map(suffix => (
                                        <button
                                            key={suffix}
                                            type="button"
                                            disabled={busy || dgOnly}
                                            onClick={() => setPreferredSuffix(suffix as ChinesePodSuffix)}
                                            className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${summary?.preferredSuffix === suffix
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {SUFFIX_LABELS[suffix]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex items-start gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={!!summary?.keepLargeFiles}
                                    disabled={busy || dgOnly}
                                    onChange={(e) => setKeepLargeFiles(e.target.checked)}
                                />
                                <span>
                                    Também guardar podcasts/revisões grandes (~12&nbsp;MB).
                                </span>
                            </label>
                        </div>
                    )}

                    {error && (
                        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {lastImport && (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                            Salvos {lastImport.imported} digestivo(s) · {lastImport.lessons} aula(s)
                            {lastImport.lessonIds.length > 0 ? ` (${lastImport.lessonIds.map(id => `C${id}`).join(', ')})` : ''}.
                            {lastImport.skippedOtherSuffix > 0 ? ` ${lastImport.skippedOtherSuffix} pr/rv ignorado(s).` : ''}
                            {lastImport.skippedUnknown > 0 ? ` ${lastImport.skippedUnknown} outro(s) ignorado(s).` : ''}
                            {lastImport.skippedLarge > 0 ? ` ${lastImport.skippedLarge} grande(s) não copiado(s).` : ''}
                        </p>
                    )}

                    <div className="rounded-xl border border-slate-200 p-3">
                        {summary && summary.fileCount > 0 ? (
                            <>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className="text-sm font-semibold text-slate-800">
                                        {summary.dgCount} digestivo{summary.dgCount === 1 ? '' : 's'} · {summary.lessonCount} aula{summary.lessonCount === 1 ? '' : 's'}
                                    </p>
                                    <p className="text-[11px] text-slate-400">{formatBytes(summary.totalBytes)}</p>
                                </div>
                                {summary.sourceLabel && (
                                    <p className="text-[11px] text-slate-500 mb-2">Origem: {summary.sourceLabel}</p>
                                )}
                                <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-slate-600">
                                    {summary.files.map(file => (
                                        <li key={file.id} className="flex items-center justify-between gap-2">
                                            <span className="truncate">
                                                C{file.lessonId}
                                                {file.suffix ? ` · ${SUFFIX_LABELS[file.suffix]}` : ''}
                                                <span className="text-slate-400"> · {file.fileName}</span>
                                            </span>
                                            <span className="text-slate-400 flex-shrink-0">{formatBytes(file.size)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">Nenhum digestivo na biblioteca ainda.</p>
                        )}
                    </div>

                    {summary?.hasDirectoryHandle && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => reconnectDirectory().catch(() => undefined)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <Icon name="refresh-cw" size={14} />
                            Reconectar pasta (permissão do navegador)
                        </button>
                    )}

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <label className="block text-xs font-bold text-amber-900" htmlFor="library-intro-skip">
                            Pular intro (segundos)
                        </label>
                        <p className="text-[11px] text-amber-800/80 mt-1">
                            Padrão 6s — intro em inglês dos DG ChinesePod. Cada aula pode ajustar no alinhamento.
                        </p>
                        <input
                            id="library-intro-skip"
                            type="number"
                            min={0}
                            max={30}
                            step={0.5}
                            value={summary?.introSkipSeconds ?? 6}
                            disabled={busy}
                            onChange={(e) => setIntroSkipSeconds(Math.max(0, Number(e.target.value) || 0))}
                            className="mt-2 w-24 px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-sm tabular-nums text-amber-950 disabled:opacity-50"
                        />
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        No Android, selecione a pasta ou os arquivos mistos — o app filtra os *dg.mp3.
                        Os arquivos originais em Baixados não são alterados.
                    </p>

                    {summary && summary.fileCount > 0 && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={handleClear}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                            <Icon name="unlink" size={14} />
                            Limpar biblioteca local
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NativeAudioLibraryModal;
