import React, { useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { processTextWithGemini, generateRawText } from '../services/gemini';
import { StudyItem, SupportedLanguage, STUDY_LANGUAGES } from '../types';
import { extractFolderPaths } from '../services/folderService';
import {
    buildSplitPreview,
    DEFAULT_TURNS_PER_FOLDER,
    estimateDurationMs,
    formatMinutes,
    isLargeImportText,
} from '../utils/dialogueSplit';
import { SplitImportJob } from '../services/localDB';
import 'flag-icons/css/flag-icons.min.css';

interface ImportModalProps {
    onClose: () => void;
    onImport: (items: StudyItem[], folderPath: string, timeBase?: number) => void | Promise<void>;
    existingItems?: StudyItem[];
    initialFolder?: string;
    onCreateSplitJob?: (input: {
        parentFolder: string;
        text: string;
        language: SupportedLanguage;
        mode: 'direct' | 'translate';
        turnsPerFolder: number;
        audioFile?: File | null;
    }) => Promise<SplitImportJob>;
    onGenerateSplitChunk?: (jobId: string, index: number) => Promise<void>;
    onGenerateAllSplit?: (jobId: string) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({
    onClose,
    onImport,
    existingItems = [],
    initialFolder = '',
    onCreateSplitJob,
    onGenerateSplitChunk,
    onGenerateAllSplit,
}) => {
    const [text, setText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState('');
    const [language, setLanguage] = useState<SupportedLanguage>('zh');
    const [mode, setMode] = useState<'direct' | 'translate'>('direct');
    const [folderPath, setFolderPath] = useState(initialFolder);
    const [folderError, setFolderError] = useState(false);
    const [showFolderDropdown, setShowFolderDropdown] = useState(false);
    const [splitEnabled, setSplitEnabled] = useState(false);
    const [turnsPerFolder, setTurnsPerFolder] = useState(DEFAULT_TURNS_PER_FOLDER);
    const [generateMode, setGenerateMode] = useState<'first' | 'all'>('first');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [textFileName, setTextFileName] = useState<string | null>(null);
    const textFileRef = useRef<HTMLInputElement>(null);
    const audioFileRef = useRef<HTMLInputElement>(null);

    const existingFolders = useMemo(() => extractFolderPaths(existingItems), [existingItems]);
    const filteredFolders = useMemo(() => {
        if (!folderPath.trim()) return existingFolders;
        return existingFolders.filter(f => f.toLowerCase().includes(folderPath.toLowerCase()));
    }, [existingFolders, folderPath]);
    const selectedLangName = STUDY_LANGUAGES.find(l => l.code === language)?.name || language.toUpperCase();
    const largeText = isLargeImportText(text);
    const preview = useMemo(
        () => (splitEnabled && folderPath.trim() && text.trim()
            ? buildSplitPreview(text, folderPath.trim(), turnsPerFolder)
            : []),
        [splitEnabled, folderPath, text, turnsPerFolder]
    );

    const handleGenerateText = async () => {
        setGenerating(true);
        try {
            const generatedText = await generateRawText(language, aiPrompt);
            setText(generatedText);
        } catch (error) {
            console.error(error);
            alert('Falha ao gerar texto. Tente novamente.');
        } finally {
            setGenerating(false);
        }
    };

    const handleTextFile = async (file: File) => {
        const content = await file.text();
        setText(content);
        setTextFileName(file.name);
        if (isLargeImportText(content)) setSplitEnabled(true);
        if (!folderPath.trim()) {
            const base = file.name.replace(/\.[^.]+$/, '').trim();
            if (base) setFolderPath(base);
        }
    };

    const handleProcess = async () => {
        if (!folderPath.trim()) {
            setFolderError(true);
            alert('⚠️ Por favor, defina uma pasta para organizar este texto.');
            return;
        }
        if (!text.trim()) return;

        setLoading(true);
        setProgress('');
        try {
            if (splitEnabled && preview.length > 1 && onCreateSplitJob) {
                setProgress(`Preparando ${preview.length} subpastas…`);
                const job = await onCreateSplitJob({
                    parentFolder: folderPath.trim(),
                    text,
                    language,
                    mode,
                    turnsPerFolder,
                    audioFile,
                });

                if (generateMode === 'all' && onGenerateAllSplit) {
                    onClose();
                    await onGenerateAllSplit(job.id);
                    return;
                }

                setProgress(`Gerando ${job.chunks[0]?.folderName} com DeepSeek…`);
                await onGenerateSplitChunk?.(job.id, 0);
                const rest = job.chunks.length - 1;
                alert(
                    rest > 0
                        ? `✅ ${job.chunks[0].folderName} pronta. Faltam ${rest} subpasta(s) — gere a próxima no menu de pastas quando quiser.`
                        : `✅ ${job.chunks[0].folderName} importada.`
                );
                onClose();
                return;
            }

            const results = await processTextWithGemini(text, mode, language);
            await onImport(results, folderPath.trim());
            onClose();
        } catch (error) {
            console.error(error);
            alert('Falha ao processar texto. Tente novamente.');
        } finally {
            setLoading(false);
            setProgress('');
        }
    };

    const selectFolder = (folder: string) => {
        setFolderPath(folder);
        setFolderError(false);
        setShowFolderDropdown(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Icon name="plus" size={20} className="text-brand-600" />
                        Importar Texto
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <Icon name="x" size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Icon name="folder" size={12} />
                            1. Pasta / Título <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={folderPath}
                                onChange={(e) => {
                                    setFolderPath(e.target.value);
                                    setFolderError(false);
                                    setShowFolderDropdown(true);
                                }}
                                onFocus={() => setShowFolderDropdown(true)}
                                placeholder="Ex: NLM ou Curso/Aula 1"
                                className={`w-full p-3 rounded-xl border-2 focus:ring-4 transition-all text-slate-700 placeholder:text-slate-400 text-sm ${folderError
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/10'
                                    }`}
                            />
                            {folderPath && (
                                <button
                                    onClick={() => setFolderPath('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <Icon name="x" size={16} />
                                </button>
                            )}
                            {showFolderDropdown && filteredFolders.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {filteredFolders.map(folder => (
                                        <button
                                            key={folder}
                                            onClick={() => selectFolder(folder)}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-brand-50 flex items-center gap-2 transition-colors"
                                        >
                                            <Icon name="folder" size={14} className="text-brand-500" />
                                            {folder}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {folderError && (
                            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                <Icon name="alert-circle" size={12} />
                                Campo obrigatório - defina uma pasta
                            </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                            No split automático vira pasta-mãe (ex: NLM → NLM/NLM01, NLM/NLM02)
                        </p>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">2. Escolha a Língua</label>
                        <div className="grid grid-cols-4 gap-2">
                            {STUDY_LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => setLanguage(lang.code)}
                                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all ${language === lang.code
                                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                                        : 'border-slate-100 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    <span className={`fi fi-${lang.isoCode} text-2xl rounded-sm`}></span>
                                    <span className="font-medium text-xs">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4 flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setMode('direct')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'direct' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                        >
                            Texto Original
                        </button>
                        <button
                            onClick={() => setMode('translate')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'translate' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                        >
                            ✨ Traduzir (PT → {selectedLangName})
                        </button>
                    </div>

                    <div className="mb-3 flex gap-2">
                        <input
                            ref={textFileRef}
                            type="file"
                            accept=".txt,.text,.md,.srt"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleTextFile(file);
                                e.target.value = '';
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => textFileRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-600 hover:border-brand-400 hover:bg-brand-50 text-sm font-medium"
                        >
                            <Icon name="file-text" size={16} />
                            {textFileName ? textFileName : 'Carregar arquivo .txt'}
                        </button>
                    </div>

                    <div className="relative">
                        <textarea
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                if (!splitEnabled && isLargeImportText(e.target.value)) setSplitEnabled(true);
                            }}
                            placeholder={`Cole aqui seu texto em ${selectedLangName} ou carregue um arquivo…`}
                            className="w-full h-36 p-4 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all resize-none text-slate-700 placeholder:text-slate-300 leading-relaxed"
                        />
                    </div>

                    {largeText && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
                            <Icon name="scissors" size={14} className="mt-0.5 flex-shrink-0" />
                            Texto longo (~{formatMinutes(estimateDurationMs(text))}).
                            Recomendamos dividir em subpastas de ~1 minuto.
                        </p>
                    )}

                    <label className="mt-4 flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={splitEnabled}
                            onChange={(e) => setSplitEnabled(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600"
                        />
                        <span className="text-sm font-medium text-slate-700">Dividir em subpastas automaticamente</span>
                    </label>

                    {splitEnabled && (
                        <div className="mt-3 space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">
                                    Diálogos por subpasta (média ~1 min = 12 falas)
                                </label>
                                <input
                                    type="number"
                                    min={4}
                                    max={40}
                                    value={turnsPerFolder}
                                    onChange={(e) => setTurnsPerFolder(Math.max(4, Number(e.target.value) || DEFAULT_TURNS_PER_FOLDER))}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
                                />
                            </div>
                            {preview.length > 0 && (
                                <p className="text-xs text-slate-600">
                                    {preview.length} pastas: {preview[0].folderPath} … {preview[preview.length - 1].folderPath}
                                </p>
                            )}
                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-1">Geração com DeepSeek</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setGenerateMode('first')}
                                        className={`p-2 rounded-lg border-2 text-xs font-medium ${generateMode === 'first' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}
                                    >
                                        Só a primeira agora
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setGenerateMode('all')}
                                        className={`p-2 rounded-lg border-2 text-xs font-medium ${generateMode === 'all' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}
                                    >
                                        Todas em sequência
                                    </button>
                                </div>
                            </div>
                            <div>
                                <input
                                    ref={audioFileRef}
                                    type="file"
                                    accept="audio/*,.mp3,.m4a,.wav,.aac"
                                    className="hidden"
                                    onChange={(e) => {
                                        setAudioFile(e.target.files?.[0] || null);
                                        e.target.value = '';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => audioFileRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-brand-400 text-xs font-medium"
                                >
                                    <Icon name="music" size={14} />
                                    {audioFile ? audioFile.name : 'Áudio original (opcional) — será cortado por pasta'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-3">
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Insira um contexto para a IA"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all text-slate-700 placeholder:text-slate-400 text-sm"
                        />
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded-lg">
                            <Icon name="info" size={14} className="mt-0.5 flex-shrink-0" />
                            <p>Cole um texto, carregue um .txt ou use o botão mágico ✨.</p>
                        </div>
                        <button
                            onClick={handleGenerateText}
                            disabled={generating || loading}
                            title={`Gerar texto em ${selectedLangName} com IA`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium text-sm whitespace-nowrap"
                        >
                            {generating ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Icon name="wand-2" size={18} />
                                    <span className="hidden sm:inline">Gerar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    {progress && (
                        <p className="text-xs text-brand-700 mb-2 text-center">{progress}</p>
                    )}
                    <button
                        onClick={handleProcess}
                        disabled={loading || generating || !text.trim()}
                        className="w-full bg-brand-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Icon name="sparkles" size={20} />
                                {splitEnabled && preview.length > 1
                                    ? (generateMode === 'first' ? `Processar ${preview[0]?.folderName || '1ª pasta'}` : `Processar ${preview.length} pastas`)
                                    : 'Processar Texto'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
