import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { processTextWithGemini } from '../services/gemini';
import { localDB, SplitImportJob, SplitImportChunk } from '../services/localDB';
import { nativeAudioLibrary } from '../services/nativeAudioLibrary';
import { StudyItem, SupportedLanguage } from '../types';
import {
    allocateAudioRanges,
    applyChunkAudioOffset,
    buildSplitPreview,
    DEFAULT_TURNS_PER_FOLDER,
    estimateDurationMs,
    extractDialogueTurns,
    folderPrefix,
    getAudioDuration,
} from '../utils/dialogueSplit';

export const SPLIT_JOBS_CHANGE_EVENT = 'splitimportjobs-change';

export interface SplitFolderCue {
    folderPath: string;
    audioLessonId: string;
    start: number;
    end: number;
}

interface CreateJobInput {
    parentFolder: string;
    text: string;
    language: SupportedLanguage;
    mode: 'direct' | 'translate';
    turnsPerFolder?: number;
    audioFile?: File | null;
    split?: boolean;
}

export interface ReadyFolder {
    jobId: string;
    folderPath: string;
    folderName: string;
    parentFolder: string;
    remaining: number;
}

interface GenerateOptions {
    saveItems: (items: StudyItem[], folderPath: string, timeBase?: number) => Promise<void>;
}

export function useSplitImportJobs() {
    const [jobs, setJobs] = useState<SplitImportJob[]>([]);
    const [busyJobId, setBusyJobId] = useState<string | null>(null);
    const [busyIndex, setBusyIndex] = useState<number | null>(null);
    const [lastReady, setLastReady] = useState<ReadyFolder | null>(null);
    const cancelAllRef = useRef(false);
    const busyRef = useRef(false);

    const refresh = useCallback(async () => {
        const next = await localDB.getSplitImportJobs();
        setJobs(next);
    }, []);

    useEffect(() => {
        refresh();
        const onChange = () => { refresh(); };
        window.addEventListener(SPLIT_JOBS_CHANGE_EVENT, onChange);
        return () => window.removeEventListener(SPLIT_JOBS_CHANGE_EVENT, onChange);
    }, [refresh]);

    const createJob = useCallback(async (input: CreateJobInput): Promise<SplitImportJob> => {
        const parent = input.parentFolder.trim().replace(/\/+$/, '');
        const turnsPerFolder = input.turnsPerFolder || DEFAULT_TURNS_PER_FOLDER;
        const useSplit = input.split !== false;
        const preview = useSplit
            ? buildSplitPreview(input.text, parent, turnsPerFolder)
            : [{
                index: 0,
                folderName: folderPrefix(parent),
                folderPath: parent,
                text: input.text.trim(),
                turnCount: extractDialogueTurns(input.text).length || 1,
                estimatedMs: estimateDurationMs(input.text),
                charCount: input.text.trim().length,
            }];
        if (preview.length === 0) {
            throw new Error('Não foi possível dividir o texto.');
        }

        let audioLessonId: string | undefined;
        let audioDuration: number | undefined;
        let withAudio = preview.map(chunk => ({
            ...chunk,
            audioStart: undefined as number | undefined,
            audioEnd: undefined as number | undefined,
        }));

        if (input.audioFile) {
            audioLessonId = folderPrefix(parent);
            audioDuration = await getAudioDuration(input.audioFile);
            await nativeAudioLibrary.putGenericFile(audioLessonId, input.audioFile, input.audioFile.name);
            withAudio = useSplit && preview.length > 1
                ? allocateAudioRanges(preview, audioDuration)
                : withAudio.map(chunk => ({ ...chunk, audioStart: 0, audioEnd: audioDuration }));
        }

        const job: SplitImportJob = {
            id: `split_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            parentFolder: parent,
            language: input.language,
            mode: input.mode,
            turnsPerFolder,
            createdAt: new Date().toISOString(),
            audioLessonId,
            audioDuration,
            chunks: withAudio.map((chunk, index) => ({
                index,
                folderName: chunk.folderName,
                folderPath: chunk.folderPath,
                text: chunk.text,
                turnCount: chunk.turnCount,
                status: 'pending' as const,
                audioStart: chunk.audioStart,
                audioEnd: chunk.audioEnd,
            })),
        };

        await localDB.putSplitImportJob(job);
        await refresh();
        return job;
    }, [refresh]);

    const generateChunk = useCallback(async (
        jobId: string,
        index: number,
        options: GenerateOptions
    ): Promise<{ itemCount: number; folderPath: string }> => {
        const job = await localDB.getSplitImportJob(jobId);
        if (!job) throw new Error('Importação não encontrada.');
        const chunk = job.chunks[index];
        if (!chunk) throw new Error('Subpasta não encontrada.');
        if (chunk.status === 'done') {
            return { itemCount: chunk.itemCount || 0, folderPath: chunk.folderPath };
        }
        if (busyRef.current) {
            throw new Error('Já existe uma pasta sendo gerada. Aguarde terminar.');
        }

        busyRef.current = true;
        setBusyJobId(jobId);
        setBusyIndex(index);
        const nextChunks: SplitImportChunk[] = job.chunks.map(c =>
            c.index === index ? { ...c, status: 'processing', error: undefined } : c
        );
        await localDB.putSplitImportJob({ ...job, chunks: nextChunks });
        await refresh();

        try {
            let items = await processTextWithGemini(chunk.text, job.mode, job.language);
            if (job.audioDuration != null && chunk.audioStart != null) {
                items = applyChunkAudioOffset(items, chunk.audioStart, chunk.audioEnd);
            }
            const createdAt = Date.parse(job.createdAt);
            const timeBase = (Number.isFinite(createdAt) ? createdAt : Date.now()) - index * 1_000_000;
            await options.saveItems(items, chunk.folderPath, timeBase);

            const latest = await localDB.getSplitImportJob(jobId);
            if (!latest) throw new Error('Importação sumiu durante o processamento.');
            const doneChunks = latest.chunks.map(c =>
                c.index === index
                    ? { ...c, status: 'done' as const, itemCount: items.length, error: undefined }
                    : c
            );
            await localDB.putSplitImportJob({ ...latest, chunks: doneChunks });
            await refresh();
            const remaining = doneChunks.filter(c => c.status !== 'done').length;
            setLastReady({
                jobId,
                folderPath: chunk.folderPath,
                folderName: chunk.folderName,
                parentFolder: latest.parentFolder,
                remaining,
            });
            return { itemCount: items.length, folderPath: chunk.folderPath };
        } catch (error: any) {
            const latest = await localDB.getSplitImportJob(jobId);
            if (latest) {
                await localDB.putSplitImportJob({
                    ...latest,
                    chunks: latest.chunks.map(c =>
                        c.index === index
                            ? { ...c, status: 'error' as const, error: error?.message || 'Falha na IA' }
                            : c
                    ),
                });
                await refresh();
            }
            throw error;
        } finally {
            busyRef.current = false;
            setBusyJobId(null);
            setBusyIndex(null);
        }
    }, [refresh]);

    const generateNext = useCallback(async (jobId: string, options: GenerateOptions) => {
        const job = await localDB.getSplitImportJob(jobId);
        if (!job) throw new Error('Importação não encontrada.');
        const next = job.chunks.find(c => c.status === 'pending' || c.status === 'error');
        if (!next) return { done: true, itemCount: 0, folderPath: null as string | null };
        const result = await generateChunk(jobId, next.index, options);
        return { done: false, itemCount: result.itemCount, folderPath: result.folderPath };
    }, [generateChunk]);

    const generateChunkByPath = useCallback(async (folderPath: string, options: GenerateOptions) => {
        const list = await localDB.getSplitImportJobs();
        for (const job of list) {
            const chunk = job.chunks.find(c => c.folderPath === folderPath);
            if (chunk && chunk.status !== 'done') {
                return generateChunk(job.id, chunk.index, options);
            }
        }
        throw new Error('Nenhuma subpasta pendente com esse caminho.');
    }, [generateChunk]);

    const generateAllRemaining = useCallback(async (jobId: string, options: GenerateOptions) => {
        cancelAllRef.current = false;
        let generated = 0;
        while (!cancelAllRef.current) {
            const job = await localDB.getSplitImportJob(jobId);
            if (!job) break;
            const next = job.chunks.find(c => c.status === 'pending' || c.status === 'error');
            if (!next) break;
            await generateChunk(jobId, next.index, options);
            generated += 1;
        }
        return generated;
    }, [generateChunk]);

    const stopGenerateAll = useCallback(() => {
        cancelAllRef.current = true;
    }, []);

    const dismissJob = useCallback(async (jobId: string) => {
        await localDB.deleteSplitImportJob(jobId);
        await refresh();
    }, [refresh]);

    const clearLastReady = useCallback(() => setLastReady(null), []);

    /** Liga um MP3/WAV escolhido à pasta. Se houver split, o arquivo é o diálogo inteiro e cada subpasta ganha o recorte. */
    const attachAudioToFolder = useCallback(async (folderPath: string, file: File) => {
        const path = folderPath.trim().replace(/\/+$/, '');
        if (!path || path === '__uncategorized__') {
            throw new Error('Selecione uma pasta para ligar o áudio.');
        }

        const list = await localDB.getSplitImportJobs();
        const job = list.find(j =>
            j.parentFolder === path || j.chunks.some(c => c.folderPath === path)
        );

        if (job) {
            const audioLessonId = folderPrefix(job.parentFolder);
            const audioDuration = await getAudioDuration(file);
            await nativeAudioLibrary.putGenericFile(audioLessonId, file, file.name);
            const ranged = allocateAudioRanges(
                job.chunks.map(chunk => ({ ...chunk, charCount: (chunk.text || '').length })),
                audioDuration
            );
            await localDB.putSplitImportJob({
                ...job,
                audioLessonId,
                audioDuration,
                chunks: ranged.map(({ charCount: _ignored, ...chunk }) => chunk),
            });
            await refresh();
            return { audioLessonId, shared: true as const };
        }

        const audioLessonId = folderPrefix(path);
        await nativeAudioLibrary.putGenericFile(audioLessonId, file, file.name);
        return { audioLessonId, shared: false as const };
    }, [refresh]);

    const folderCues = useMemo<SplitFolderCue[]>(() => {
        const cues: SplitFolderCue[] = [];
        for (const job of jobs) {
            if (!job.audioLessonId) continue;
            for (const chunk of job.chunks) {
                if (chunk.audioStart == null || chunk.audioEnd == null) continue;
                cues.push({
                    folderPath: chunk.folderPath,
                    audioLessonId: job.audioLessonId,
                    start: chunk.audioStart,
                    end: chunk.audioEnd,
                });
            }
        }
        return cues;
    }, [jobs]);

    const getFolderAudioCue = useCallback((folderPath?: string | null): SplitFolderCue | null => {
        if (!folderPath) return null;
        return folderCues.find(c => c.folderPath === folderPath) || null;
    }, [folderCues]);

    const activeJobs = useMemo(
        () => jobs.filter(job => job.chunks.some(c => c.status !== 'done')),
        [jobs]
    );

    return {
        jobs,
        activeJobs,
        busyJobId,
        busyIndex,
        createJob,
        generateChunk,
        generateChunkByPath,
        generateNext,
        generateAllRemaining,
        stopGenerateAll,
        dismissJob,
        attachAudioToFolder,
        getFolderAudioCue,
        lastReady,
        clearLastReady,
        refresh,
    };
}
