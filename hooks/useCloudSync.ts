import { useState, useCallback } from 'react';
import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    orderBy,
    getDocs,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { localDB, LocalProfile, UserComment } from '../services/localDB';
import { StudyItem, SessionRecord } from '../types';
import {
    BACKUP_VERSION,
    FIRESTORE_SAFE_BYTES,
    assembleChunks,
    buildBackupPayload,
    formatBackupError,
    normalizeBackupGraph,
    parseBackupPayload,
    splitUtf8,
} from '../services/backupService';

const MIGRATION_KEY = 'localFirstMigrated';
const CHUNK_PREFIX = 'chunk_';

/**
 * useCloudSync - Hook para backup/restore manual na nuvem.
 *
 * O payload é o mesmo do export JSON (itens + perfil + comentários + sessões).
 * Gravações de voz ficam só no arquivo local (blobs estouram o Firestore).
 *
 * Bibliotecas grandes são fatiadas em documentos `chunk_N` para não passar
 * do limite de 1 MiB por documento do Firestore.
 */

export interface CloudSyncResult {
    backupToCloud: () => Promise<boolean>;
    restoreFromCloud: () => Promise<{ success: boolean; itemCount: number }>;
    migrateFromFirebase: () => Promise<{ success: boolean; itemCount: number; hasData: boolean }>;
    needsMigration: () => boolean;
    isSyncing: boolean;
    lastBackupAt: string | null;
    lastRestoreAt: string | null;
}

interface RestoredBackup {
    items: StudyItem[];
    profile: LocalProfile;
    comments: UserComment[];
    sessions: SessionRecord[];
    source: 'json-inline' | 'json-chunks' | 'legacy-blob' | 'none';
}

async function commitBatches(
    ops: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
    const CHUNK = 450;
    for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) op(batch);
        await batch.commit();
    }
}

async function listBackupDocs(userId: string) {
    const col = collection(db, 'users', userId, 'backups');
    return getDocs(col);
}

async function deleteExtraChunks(userId: string, keepCount: number): Promise<void> {
    const snap = await listBackupDocs(userId);
    const toDelete: string[] = [];
    snap.forEach(d => {
        if (!d.id.startsWith(CHUNK_PREFIX)) return;
        const idx = Number(d.id.slice(CHUNK_PREFIX.length));
        if (!Number.isFinite(idx) || idx >= keepCount) {
            toDelete.push(d.id);
        }
    });
    if (toDelete.length === 0) return;
    await commitBatches(toDelete.map(id => (batch) => {
        batch.delete(doc(db, 'users', userId, 'backups', id));
    }));
}

async function writeCloudBackup(userId: string, payload: ReturnType<typeof buildBackupPayload>): Promise<void> {
    const json = JSON.stringify(payload);
    const dataRef = doc(db, 'users', userId, 'backups', 'data');
    const metaBase = {
        version: BACKUP_VERSION,
        backedUpAt: payload.exportedAt,
        itemCount: payload.itemCount,
        commentCount: payload.comments.length,
        sessionCount: payload.sessions.length,
    };

    if (new TextEncoder().encode(json).length <= FIRESTORE_SAFE_BYTES) {
        await setDoc(dataRef, {
            ...metaBase,
            format: 'json-inline',
            chunkCount: 0,
            payloadJson: json,
        });
        await deleteExtraChunks(userId, 0);
        return;
    }

    const chunks = splitUtf8(json, FIRESTORE_SAFE_BYTES);
    await setDoc(dataRef, {
        ...metaBase,
        format: 'json-chunks',
        chunkCount: chunks.length,
    });

    await commitBatches(chunks.map((text, i) => (batch) => {
        batch.set(doc(db, 'users', userId, 'backups', `${CHUNK_PREFIX}${i}`), { i, t: text });
    }));
    await deleteExtraChunks(userId, chunks.length);
}

async function readChunkedPayload(userId: string, chunkCount: number): Promise<string> {
    const pieces: Array<{ i: number; t: string }> = [];
    for (let i = 0; i < chunkCount; i++) {
        const snap = await getDoc(doc(db, 'users', userId, 'backups', `${CHUNK_PREFIX}${i}`));
        if (!snap.exists()) {
            throw new Error(`Chunk ${i}/${chunkCount} ausente no backup da nuvem.`);
        }
        const data = snap.data();
        pieces.push({ i: typeof data.i === 'number' ? data.i : i, t: String(data.t || '') });
    }
    return assembleChunks(pieces);
}

async function readCloudBackup(userId: string): Promise<RestoredBackup> {
    const backupRef = doc(db, 'users', userId, 'backups', 'data');
    const backupSnap = await getDoc(backupRef);
    if (!backupSnap.exists()) {
        return {
            items: [],
            profile: localDB.getDefaultProfile(),
            comments: [],
            sessions: [],
            source: 'none',
        };
    }

    const backupData = backupSnap.data();
    const format = backupData.format as string | undefined;

    if (format === 'json-inline' && typeof backupData.payloadJson === 'string') {
        const parsed = parseBackupPayload(JSON.parse(backupData.payloadJson));
        const normalized = normalizeBackupGraph({
            items: parsed.data,
            profile: parsed.profile,
            comments: parsed.comments,
        });
        return {
            items: normalized.items,
            profile: normalized.profile || localDB.getDefaultProfile(),
            comments: normalized.comments,
            sessions: parsed.sessions,
            source: 'json-inline',
        };
    }

    if (format === 'json-chunks' && Number(backupData.chunkCount) > 0) {
        const json = await readChunkedPayload(userId, Number(backupData.chunkCount));
        const parsed = parseBackupPayload(JSON.parse(json));
        const normalized = normalizeBackupGraph({
            items: parsed.data,
            profile: parsed.profile,
            comments: parsed.comments,
        });
        return {
            items: normalized.items,
            profile: normalized.profile || localDB.getDefaultProfile(),
            comments: normalized.comments,
            sessions: parsed.sessions,
            source: 'json-chunks',
        };
    }

    // Formato legado (v2.2): itens inline no documento único
    const legacyItems = (backupData.items || backupData.data || []) as StudyItem[];
    const normalized = normalizeBackupGraph({
        items: legacyItems,
        profile: (backupData.profile || localDB.getDefaultProfile()) as LocalProfile,
        comments: (backupData.comments || []) as UserComment[],
    });
    return {
        items: normalized.items,
        profile: normalized.profile || localDB.getDefaultProfile(),
        comments: normalized.comments,
        sessions: (backupData.sessions || []) as SessionRecord[],
        source: 'legacy-blob',
    };
}

export function useCloudSync(userId: string | null | undefined): CloudSyncResult {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
    const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);

    const needsMigration = useCallback((): boolean => {
        if (!userId) return false;
        return !localStorage.getItem(`${MIGRATION_KEY}_${userId}`);
    }, [userId]);

    const backupToCloud = useCallback(async (): Promise<boolean> => {
        if (!userId) {
            alert('Faça login para fazer backup na nuvem.');
            return false;
        }

        setIsSyncing(true);
        try {
            const { items, profile, comments, sessions } = await localDB.exportAll();
            const payload = buildBackupPayload({ items, profile, comments, sessions, userId });
            await writeCloudBackup(userId, payload);

            const timestamp = payload.exportedAt;
            setLastBackupAt(timestamp);
            await localDB.updateProfile({ lastBackupAt: timestamp });

            console.log(`Backup realizado: ${items.length} itens salvos na nuvem.`);
            return true;
        } catch (error) {
            console.error('Erro ao fazer backup:', error);
            alert(`Erro ao fazer backup. ${formatBackupError(error)}`);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    const restoreFromCloud = useCallback(async (): Promise<{ success: boolean; itemCount: number }> => {
        if (!userId) {
            alert('Faça login para restaurar backup da nuvem.');
            return { success: false, itemCount: 0 };
        }

        setIsSyncing(true);
        try {
            const restored = await readCloudBackup(userId);
            if (restored.source === 'none') {
                alert('Nenhum backup encontrado na nuvem.');
                return { success: false, itemCount: 0 };
            }

            const timestamp = new Date().toISOString();
            restored.profile.lastRestoreAt = timestamp;

            await localDB.importAll({
                items: restored.items,
                profile: restored.profile,
                comments: restored.comments,
                sessions: restored.sessions,
            });

            setLastRestoreAt(timestamp);
            setLastBackupAt(restored.profile.lastBackupAt || null);

            console.log(`Restauração concluída (${restored.source}): ${restored.items.length} itens.`);
            return { success: true, itemCount: restored.items.length };
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            alert(`Erro ao restaurar backup. ${formatBackupError(error)}`);
            return { success: false, itemCount: 0 };
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    /**
     * Migração para dispositivo novo ou primeira vez após atualização local-first.
     * Tenta o backup blob (qualquer formato) primeiro; senão lê o Firebase legado.
     */
    const migrateFromFirebase = useCallback(async (): Promise<{ success: boolean; itemCount: number; hasData: boolean }> => {
        if (!userId) return { success: false, itemCount: 0, hasData: false };

        setIsSyncing(true);
        try {
            console.log('🔄 Iniciando migração para dispositivo local...');

            let items: StudyItem[] = [];
            let profile: LocalProfile = localDB.getDefaultProfile();
            let comments: UserComment[] = [];
            let sessions: SessionRecord[] = [];
            let source = 'none';

            try {
                const restored = await readCloudBackup(userId);
                if (restored.source !== 'none') {
                    items = restored.items;
                    profile = restored.profile;
                    comments = restored.comments;
                    sessions = restored.sessions;
                    source = restored.source;
                    console.log(`📦 Backup encontrado (${source}): ${items.length} itens, ${profile.stats?.points || 0} pontos`);
                }
            } catch (e) {
                console.warn('Erro ao ler backup blob, tentando Firebase legado...', e);
            }

            if (source === 'none') {
                try {
                    const itemsQuery = query(
                        collection(db, 'users', userId, 'items'),
                        orderBy('createdAt', 'desc')
                    );
                    const itemsSnap = await getDocs(itemsQuery);
                    items = itemsSnap.docs.map(d => ({
                        id: d.id,
                        ...d.data()
                    } as StudyItem));

                    const userDocSnap = await getDoc(doc(db, 'users', userId));
                    const userData = userDocSnap.exists() ? userDocSnap.data() : {};

                    profile = {
                        savedIds: userData.savedIds || [],
                        stats: userData.stats || { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] },
                        totalScore: userData.totalScore || 0,
                        activeFolderFilters: userData.activeFolderFilters || [],
                        lastBackupAt: new Date().toISOString(),
                    };

                    source = 'firebase-legacy';
                    console.log(`📂 Firebase legado: ${items.length} itens, ${profile.stats?.points || 0} pontos`);

                    const normalized = normalizeBackupGraph({ items, profile, comments });
                    items = normalized.items;
                    profile = normalized.profile || profile;
                    comments = normalized.comments;
                } catch (e) {
                    console.warn('Erro ao ler Firebase legado:', e);
                }
            }

            const hasData = items.length > 0 ||
                (profile.stats?.correct || 0) > 0 ||
                (profile.stats?.points || 0) > 0 ||
                (profile.totalScore || 0) > 0;

            if (!hasData) {
                console.log('📭 Nenhum dado encontrado para migrar (usuário novo).');
                localStorage.setItem(`${MIGRATION_KEY}_${userId}`, new Date().toISOString());
                return { success: true, itemCount: 0, hasData: false };
            }

            await localDB.importAll({ items, profile, comments, sessions });

            if (source === 'firebase-legacy') {
                const payload = buildBackupPayload({ items, profile, comments, sessions, userId });
                await writeCloudBackup(userId, payload);
            }

            localStorage.setItem(`${MIGRATION_KEY}_${userId}`, new Date().toISOString());

            console.log(`✅ Migração concluída (${source}): ${items.length} itens, ${profile.stats?.points || 0} pontos.`);
            return { success: true, itemCount: items.length, hasData: true };

        } catch (error) {
            console.error('Erro na migração:', error);
            localStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'error');
            return { success: false, itemCount: 0, hasData: false };
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    return { backupToCloud, restoreFromCloud, migrateFromFirebase, needsMigration, isSyncing, lastBackupAt, lastRestoreAt };
}
