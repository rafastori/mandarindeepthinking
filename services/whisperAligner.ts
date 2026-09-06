import {
    AlignSentenceInput,
    DEFAULT_INTRO_SKIP_SECONDS,
    LessonAlignment,
    TimedChunk,
    alignSentencesToChunks,
    clampIntroSkip,
    extraSkipFromLatinIntro,
    hashLessonContent,
    offsetChunks,
    parseWhisperChunks,
} from '../utils/audioAlignment';
import { SupportedLanguage } from '../types';

const whisperLangMap: Record<string, string> = {
    zh: 'chinese',
    de: 'german',
    ja: 'japanese',
    ko: 'korean',
    fr: 'french',
    es: 'spanish',
    it: 'italian',
    en: 'english',
    pt: 'portuguese',
};

export async function decodeBlobToMono16k(blob: Blob): Promise<{ samples: Float32Array; duration: number }> {
    const context = new AudioContext();
    try {
        const buffer = await context.decodeAudioData(await blob.arrayBuffer());
        const source = buffer.getChannelData(0);
        const duration = buffer.duration;
        if (buffer.sampleRate === 16000) {
            return { samples: source, duration };
        }
        const ratio = 16000 / buffer.sampleRate;
        const length = Math.max(1, Math.round(source.length * ratio));
        const resampled = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const srcIndex = i / ratio;
            const left = Math.floor(srcIndex);
            const right = Math.min(left + 1, source.length - 1);
            const t = srcIndex - left;
            resampled[i] = source[left] * (1 - t) + source[right] * t;
        }
        return { samples: resampled, duration };
    } finally {
        await context.close();
    }
}

function createWorker(): Worker {
    return new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
}

export function transcribeAudioWithTimestamps(
    samples: Float32Array,
    language: SupportedLanguage | 'zh',
    onProgress?: (progress: number, message?: string) => void
): Promise<{ text: string; chunks: TimedChunk[] }> {
    return new Promise((resolve, reject) => {
        const worker = createWorker();
        const timeout = window.setTimeout(() => {
            worker.terminate();
            reject(new Error('O Whisper demorou demais. Tente de novo ou alinhe na mão.'));
        }, 180000);

        worker.onmessage = (event: MessageEvent) => {
            const { status, progress, transcript, chunks, error, message } = event.data || {};
            if (status === 'progress' && typeof progress === 'number') {
                onProgress?.(progress, 'Carregando Whisper…');
            } else if (status === 'processing') {
                onProgress?.(100, message || 'Transcrevendo o digestivo…');
            } else if (status === 'result') {
                window.clearTimeout(timeout);
                worker.terminate();
                resolve({
                    text: String(transcript || ''),
                    chunks: parseWhisperChunks(chunks),
                });
            } else if (status === 'error') {
                window.clearTimeout(timeout);
                worker.terminate();
                reject(new Error(error || 'Falha no Whisper'));
            }
        };

        worker.onerror = (err) => {
            window.clearTimeout(timeout);
            worker.terminate();
            reject(err);
        };

        worker.postMessage({ type: 'load' });
        worker.postMessage({
            type: 'transcribe',
            audio: samples,
            language: whisperLangMap[language] || 'chinese',
            returnTimestamps: true,
        });
    });
}

function sliceFromSeconds(samples: Float32Array, skipSeconds: number, sampleRate = 16000): Float32Array {
    const start = Math.min(Math.floor(skipSeconds * sampleRate), Math.max(samples.length - sampleRate, 0));
    return samples.subarray(Math.max(start, 0));
}

export async function autoAlignLesson(options: {
    lessonId: string;
    audioFileId: string;
    blob: Blob;
    sentences: AlignSentenceInput[];
    language?: SupportedLanguage;
    introSkipSeconds?: number;
    onProgress?: (progress: number, message?: string) => void;
}): Promise<LessonAlignment> {
    const { samples, duration } = await decodeBlobToMono16k(options.blob);
    const requestedSkip = clampIntroSkip(
        options.introSkipSeconds ?? DEFAULT_INTRO_SKIP_SECONDS,
        duration
    );
    options.onProgress?.(5, requestedSkip > 0
        ? `Pulando intro de ${requestedSkip.toFixed(1).replace('.', ',')}s…`
        : 'Áudio decodificado');

    const sliced = requestedSkip > 0 ? sliceFromSeconds(samples, requestedSkip) : samples;
    let chunks: TimedChunk[] = [];
    let effectiveSkip = requestedSkip;
    try {
        const result = await transcribeAudioWithTimestamps(
            sliced,
            options.language || 'zh',
            options.onProgress
        );
        const relative = result.chunks;
        const leftover = extraSkipFromLatinIntro(relative);
        effectiveSkip = clampIntroSkip(requestedSkip + leftover, duration);
        chunks = offsetChunks(
            leftover > 0 ? relative.filter(c => c.end > leftover + 0.05).map(c => ({
                ...c,
                start: c.start - leftover,
                end: c.end - leftover,
            })) : relative,
            effectiveSkip
        );
    } catch (error) {
        console.warn('Whisper alignment falhou, usando divisão proporcional:', error);
    }

    const aligned = alignSentencesToChunks(options.sentences, chunks, duration, effectiveSkip);
    return {
        lessonId: options.lessonId,
        audioFileId: options.audioFileId,
        contentHash: hashLessonContent(options.sentences),
        duration,
        cues: aligned.cues,
        whisperChunks: chunks,
        method: aligned.method,
        averageScore: aligned.averageScore,
        introSkipSeconds: effectiveSkip,
        updatedAt: new Date().toISOString(),
    };
}
