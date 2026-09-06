import { AlignSentenceInput, LessonAlignment, parseWhisperChunks, TimedChunk, alignSentencesToChunks, hashLessonContent } from '../utils/audioAlignment';
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

export async function autoAlignLesson(options: {
    lessonId: string;
    audioFileId: string;
    blob: Blob;
    sentences: AlignSentenceInput[];
    language?: SupportedLanguage;
    onProgress?: (progress: number, message?: string) => void;
}): Promise<LessonAlignment> {
    const { samples, duration } = await decodeBlobToMono16k(options.blob);
    options.onProgress?.(5, 'Áudio decodificado');

    let chunks: TimedChunk[] = [];
    try {
        const result = await transcribeAudioWithTimestamps(
            samples,
            options.language || 'zh',
            options.onProgress
        );
        chunks = result.chunks;
    } catch (error) {
        console.warn('Whisper alignment falhou, usando divisão proporcional:', error);
    }

    const aligned = alignSentencesToChunks(options.sentences, chunks, duration);
    return {
        lessonId: options.lessonId,
        audioFileId: options.audioFileId,
        contentHash: hashLessonContent(options.sentences),
        duration,
        cues: aligned.cues,
        whisperChunks: chunks,
        method: aligned.method,
        averageScore: aligned.averageScore,
        updatedAt: new Date().toISOString(),
    };
}
