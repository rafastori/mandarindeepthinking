import { localDB, ColorCorrectionToken } from './localDB';
import { SupportedLanguage } from '../types';
import type { ColorCorrectionInput, ColorCorrectionOutput } from './colorCorrectionLLM';

export const COLOR_JOB_EVENT = 'color-correction-job';
export const COLOR_CORRECTIONS_CHANGE_EVENT = 'colorcorrections-change';
const CHANNEL_NAME = 'memorizatudo-color-corrections';

export type ColorJobStatus = 'idle' | 'running' | 'done' | 'error';

export interface ColorJobState {
    status: ColorJobStatus;
    total: number;
    done: number;
    failed: number;
    message?: string;
}

const idleState = (): ColorJobState => ({
    status: 'idle',
    total: 0,
    done: 0,
    failed: 0,
});

let current: ColorJobState = idleState();
let running = false;
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!channel) {
        try {
            channel = new BroadcastChannel(CHANNEL_NAME);
            channel.onmessage = (event) => {
                const msg = event.data || {};
                if (msg.type === 'corrections' && msg.colorCorrections) {
                    emitCorrections(msg.colorCorrections, false);
                }
                if (msg.type === 'job' && msg.state) {
                    current = msg.state;
                    emitJob(false);
                }
            };
        } catch {
            channel = null;
        }
    }
    return channel;
}

function emitJob(broadcast = true) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(COLOR_JOB_EVENT, { detail: { ...current } }));
    }
    if (broadcast) {
        try {
            getChannel()?.postMessage({ type: 'job', state: { ...current } });
        } catch { /* ignore */ }
    }
}

function emitCorrections(next: Record<string, ColorCorrectionToken[]>, broadcast = true) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(COLOR_CORRECTIONS_CHANGE_EVENT, { detail: next }));
    }
    if (broadcast) {
        try {
            getChannel()?.postMessage({ type: 'corrections', colorCorrections: next });
        } catch { /* ignore */ }
    }
}

export function getColorJobState(): ColorJobState {
    return { ...current };
}

export function isColorJobRunning(): boolean {
    return running || current.status === 'running';
}

export async function applyColorCorrectionPatch(ops: {
    set?: Record<string, ColorCorrectionToken[]>;
    deleteIds?: string[];
}): Promise<Record<string, ColorCorrectionToken[]>> {
    const profile = await localDB.getProfile();
    const next: Record<string, ColorCorrectionToken[]> = { ...(profile.colorCorrections || {}) };
    if (ops.set) {
        for (const [id, tokens] of Object.entries(ops.set)) {
            next[id] = tokens;
        }
    }
    for (const id of ops.deleteIds || []) {
        delete next[id];
    }
    await localDB.updateProfile({ colorCorrections: next });
    emitCorrections(next);
    return next;
}

function outputsToPatch(results: ColorCorrectionOutput[]): Record<string, ColorCorrectionToken[]> {
    const patch: Record<string, ColorCorrectionToken[]> = {};
    for (const r of results) {
        if (!r?.sentenceId || !Array.isArray(r.coloredTranslation) || r.coloredTranslation.length === 0) continue;
        patch[String(r.sentenceId)] = r.coloredTranslation;
    }
    return patch;
}

/**
 * Job em módulo (não depende do React). Continua mesmo se a Leitura desmontar
 * ao abrir outra aba ou pasta.
 */
export async function startColorCorrectionJob(
    sentences: ColorCorrectionInput[],
    targetLanguage: SupportedLanguage = 'zh'
): Promise<ColorCorrectionOutput[]> {
    if (running) {
        throw new Error('Já existe uma correção de cores em andamento.');
    }
    if (!sentences.length) return [];

    getChannel();
    running = true;
    current = {
        status: 'running',
        total: sentences.length,
        done: 0,
        failed: 0,
        message: 'Corrigindo cores em segundo plano…',
    };
    emitJob();

    try {
        const { correctColorHighlights } = await import('./colorCorrectionLLM');
        const results = await correctColorHighlights(sentences, targetLanguage, {
            onBatch: async (batchResults) => {
                const patch = outputsToPatch(batchResults);
                if (Object.keys(patch).length) {
                    try {
                        await applyColorCorrectionPatch({ set: patch });
                    } catch (persistError) {
                        console.error('[ColorCorrection] falha ao gravar lote:', persistError);
                    }
                }
                const added = Object.keys(patch).length || batchResults.length;
                const done = Math.min(current.total, current.done + added);
                current = {
                    ...current,
                    done,
                    message: `Corrigindo cores — ${done}/${current.total}`,
                };
                emitJob();
            },
            onBatchError: async (failedCount) => {
                current = {
                    ...current,
                    failed: current.failed + failedCount,
                    message: `Corrigindo cores — ${current.done}/${current.total} (algumas falharam)`,
                };
                emitJob();
            },
        });

        const allFailed = results.length === 0;
        current = {
            status: allFailed ? 'error' : 'done',
            total: current.total,
            done: results.length,
            failed: current.failed,
            message: allFailed
                ? 'Não foi possível corrigir as cores. Tente de novo.'
                : current.failed
                    ? `Cores atualizadas em ${results.length} frase(s); ${current.failed} falharam.`
                    : `Cores atualizadas em ${results.length} frase(s).`,
        };
        emitJob();
        return results;
    } catch (error) {
        current = {
            ...current,
            status: current.done > 0 ? 'done' : 'error',
            message: current.done > 0
                ? `Cores atualizadas em ${current.done} frase(s); o restante falhou.`
                : 'Erro ao corrigir cores. Tente novamente.',
        };
        emitJob();
        throw error;
    } finally {
        running = false;
        emitJob();
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                if (current.status === 'running') return;
                current = idleState();
                emitJob();
            }, 8000);
        }
    }
}
