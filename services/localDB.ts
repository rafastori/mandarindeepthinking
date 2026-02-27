/**
 * LocalDB - Serviço de armazenamento local usando IndexedDB
 * 
 * Gerencia todos os dados do app localmente para reduzir custos do Firebase.
 * O Firebase é usado apenas para backup manual e features online (Leaderboard).
 */

import { StudyItem, Stats } from '../types';

const DB_NAME = 'MandarinDeepThinkingDB';
const DB_VERSION = 2;

// Store names
const ITEMS_STORE = 'items';
const PROFILE_STORE = 'profile';
const VOICE_STORE = 'voiceRecordings';

// Profile keys
const PROFILE_KEY = 'userProfile';

export interface LocalProfile {
    savedIds: string[];
    stats: Stats;
    totalScore: number;
    activeFolderFilters: string[];
    lastBackupAt?: string; // ISO date
    lastRestoreAt?: string; // ISO date
}

export interface VoiceRecording {
    wordId: string;     // ID único da palavra/frase
    audioBlob: Blob;    // O áudio gravado
    mimeType: string;   // 'audio/webm' ou 'audio/mp4'
    createdAt: string;  // ISO date
    updatedAt: string;  // ISO date
}

const defaultProfile: LocalProfile = {
    savedIds: [],
    stats: { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] },
    totalScore: 0,
    activeFolderFilters: [],
};

// ============================================================
// Database Initialization
// ============================================================

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Items store - keyPath é 'id'
            if (!db.objectStoreNames.contains(ITEMS_STORE)) {
                db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
            }

            // Profile store - key-value simples
            if (!db.objectStoreNames.contains(PROFILE_STORE)) {
                db.createObjectStore(PROFILE_STORE);
            }

            // Voice recordings store (v2)
            if (!db.objectStoreNames.contains(VOICE_STORE)) {
                db.createObjectStore(VOICE_STORE, { keyPath: 'wordId' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;

            // Reconecta se o DB fechar inesperadamente
            dbInstance.onclose = () => { dbInstance = null; };

            resolve(dbInstance);
        };

        request.onerror = () => {
            console.error('Erro ao abrir IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

// Helper para executar transações
function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    return openDB().then(db => {
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// ============================================================
// Items CRUD
// ============================================================

export const localDB = {
    // --- Items ---

    /** Retorna todos os StudyItems do IndexedDB */
    async getAllItems(): Promise<StudyItem[]> {
        return withStore<StudyItem[]>(ITEMS_STORE, 'readonly', (store) => store.getAll());
    },

    /** Adiciona ou atualiza um item */
    async putItem(item: StudyItem): Promise<void> {
        await withStore(ITEMS_STORE, 'readwrite', (store) => store.put(item));
    },

    /** Remove um item pelo ID */
    async deleteItem(id: string | number): Promise<void> {
        await withStore(ITEMS_STORE, 'readwrite', (store) => store.delete(id as IDBValidKey));
    },

    /** Insere múltiplos itens de uma vez (batch) */
    async bulkPutItems(items: StudyItem[]): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ITEMS_STORE, 'readwrite');
            const store = tx.objectStore(ITEMS_STORE);

            for (const item of items) {
                store.put(item);
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    /** Deleta múltiplos itens de uma vez (batch) */
    async bulkDeleteItems(ids: (string | number)[]): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ITEMS_STORE, 'readwrite');
            const store = tx.objectStore(ITEMS_STORE);

            for (const id of ids) {
                store.delete(id as IDBValidKey);
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    /** Limpa todos os itens */
    async clearItems(): Promise<void> {
        await withStore(ITEMS_STORE, 'readwrite', (store) => store.clear());
    },

    // --- Profile (Stats, SavedIds, Filters) ---

    /** Retorna o perfil local do usuário */
    async getProfile(): Promise<LocalProfile> {
        const result = await withStore<LocalProfile | undefined>(
            PROFILE_STORE, 'readonly',
            (store) => store.get(PROFILE_KEY)
        );
        return result || { ...defaultProfile };
    },

    /** Salva o perfil local */
    async saveProfile(profile: LocalProfile): Promise<void> {
        await withStore(PROFILE_STORE, 'readwrite', (store) => store.put(profile, PROFILE_KEY));
    },

    /** Atualiza parcialmente o perfil */
    async updateProfile(partial: Partial<LocalProfile>): Promise<LocalProfile> {
        const current = await this.getProfile();
        const updated = { ...current, ...partial };
        await this.saveProfile(updated);
        return updated;
    },

    // --- Backup/Restore Helpers ---

    /** Exporta TUDO como um único objeto JSON (para backup na nuvem) */
    async exportAll(): Promise<{ items: StudyItem[]; profile: LocalProfile }> {
        const [items, profile] = await Promise.all([
            this.getAllItems(),
            this.getProfile()
        ]);
        return { items, profile };
    },

    /** Importa dados de um backup (substitui tudo localmente) */
    async importAll(data: { items: StudyItem[]; profile: LocalProfile }): Promise<void> {
        await this.clearItems();
        if (data.items.length > 0) {
            await this.bulkPutItems(data.items);
        }
        await this.saveProfile(data.profile);
    },

    /** Retorna o perfil padrão (útil para reset) */
    getDefaultProfile(): LocalProfile {
        return { ...defaultProfile };
    },

    // --- Voice Recordings ---

    /** Retorna uma gravação de voz pelo wordId */
    async getVoiceRecording(wordId: string): Promise<VoiceRecording | null> {
        const result = await withStore<VoiceRecording | undefined>(
            VOICE_STORE, 'readonly',
            (store) => store.get(wordId)
        );
        return result || null;
    },

    /** Salva ou atualiza uma gravação de voz */
    async saveVoiceRecording(recording: VoiceRecording): Promise<void> {
        await withStore(VOICE_STORE, 'readwrite', (store) => store.put(recording));
    },

    /** Remove uma gravação de voz */
    async deleteVoiceRecording(wordId: string): Promise<void> {
        await withStore(VOICE_STORE, 'readwrite', (store) => store.delete(wordId));
    },

    /** Retorna todos os wordIds que possuem gravação (sem carregar blobs) */
    async getAllVoiceRecordingIds(): Promise<string[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(VOICE_STORE, 'readonly');
            const store = tx.objectStore(VOICE_STORE);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result as string[]);
            request.onerror = () => reject(request.error);
        });
    }
};

export default localDB;
