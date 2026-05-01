import { useState, useCallback } from 'react';
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { localDB, LocalProfile, UserComment } from '../services/localDB';
import { StudyItem } from '../types';

const MIGRATION_KEY = 'localFirstMigrated';

/**
 * useCloudSync - Hook para backup/restore manual na nuvem.
 * 
 * Salva TODOS os dados locais como um único documento JSON no Firestore.
 * Custo: 1 escrita por backup, 1 leitura por restore.
 * 
 * Também inclui migração one-time do Firebase legado para IndexedDB.
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

export function useCloudSync(userId: string | null | undefined): CloudSyncResult {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
    const [lastRestoreAt, setLastRestoreAt] = useState<string | null>(null);

    // Verifica se precisa migrar (primeira vez após atualização)
    const needsMigration = useCallback((): boolean => {
        if (!userId) return false;
        return !localStorage.getItem(`${MIGRATION_KEY}_${userId}`);
    }, [userId]);

    // Backup: Local -> Cloud (1 escrita no Firestore)
    const backupToCloud = useCallback(async (): Promise<boolean> => {
        if (!userId) {
            alert('Faça login para fazer backup na nuvem.');
            return false;
        }

        setIsSyncing(true);
        try {
            const { items, profile, comments } = await localDB.exportAll();

            const backupData = {
                version: '2.1.0',
                backedUpAt: new Date().toISOString(),
                itemCount: items.length,
                items: items,
                profile: profile,
                comments: comments,
            };

            const backupRef = doc(db, 'users', userId, 'backups', 'data');
            await setDoc(backupRef, backupData);

            const timestamp = new Date().toISOString();
            setLastBackupAt(timestamp);
            await localDB.updateProfile({ lastBackupAt: timestamp });

            console.log(`Backup realizado: ${items.length} itens salvos na nuvem.`);
            return true;

        } catch (error) {
            console.error('Erro ao fazer backup:', error);
            alert('Erro ao fazer backup. Tente novamente.');
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    // Restore: Cloud -> Local (1 leitura do Firestore)
    const restoreFromCloud = useCallback(async (): Promise<{ success: boolean; itemCount: number }> => {
        if (!userId) {
            alert('Faça login para restaurar backup da nuvem.');
            return { success: false, itemCount: 0 };
        }

        setIsSyncing(true);
        try {
            const backupRef = doc(db, 'users', userId, 'backups', 'data');
            const backupSnap = await getDoc(backupRef);

            if (!backupSnap.exists()) {
                alert('Nenhum backup encontrado na nuvem.');
                return { success: false, itemCount: 0 };
            }

            const backupData = backupSnap.data();
            const items: StudyItem[] = backupData.items || [];
            const profile: LocalProfile = backupData.profile || localDB.getDefaultProfile();
            const comments: UserComment[] = backupData.comments || [];

            const timestamp = new Date().toISOString();
            profile.lastRestoreAt = timestamp;

            await localDB.importAll({ items, profile, comments });

            setLastRestoreAt(timestamp);
            setLastBackupAt(profile.lastBackupAt || null);

            console.log(`Restauração concluída: ${items.length} itens restaurados da nuvem.`);
            return { success: true, itemCount: items.length };

        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            alert('Erro ao restaurar backup. Tente novamente.');
            return { success: false, itemCount: 0 };
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    /**
     * Migração para dispositivo novo ou primeira vez após atualização local-first.
     * 
     * Estratégia: Tenta backup blob PRIMEIRO (mais recente), senão lê Firebase legado.
     * Isso garante que dados novos (criados após a primeira migração) não se percam.
     */
    const migrateFromFirebase = useCallback(async (): Promise<{ success: boolean; itemCount: number; hasData: boolean }> => {
        if (!userId) return { success: false, itemCount: 0, hasData: false };

        setIsSyncing(true);
        try {
            console.log('🔄 Iniciando migração para dispositivo local...');

            let items: StudyItem[] = [];
            let profile: LocalProfile = localDB.getDefaultProfile();
            let comments: UserComment[] = [];
            let source = 'none';

            // 1. Tenta restaurar do backup blob (dados mais recentes)
            try {
                const backupRef = doc(db, 'users', userId, 'backups', 'data');
                const backupSnap = await getDoc(backupRef);

                if (backupSnap.exists()) {
                    const backupData = backupSnap.data();
                    items = backupData.items || [];
                    profile = backupData.profile || localDB.getDefaultProfile();
                    comments = backupData.comments || [];
                    source = 'backup-blob';
                    console.log(`📦 Backup blob encontrado: ${items.length} itens, ${profile.stats?.points || 0} pontos`);
                }
            } catch (e) {
                console.warn('Erro ao ler backup blob, tentando Firebase legado...', e);
            }

            // 2. Se não encontrou backup blob, tenta Firebase legado
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
                } catch (e) {
                    console.warn('Erro ao ler Firebase legado:', e);
                }
            }

            // 3. Verifica se há dados para migrar (itens OU stats com progresso)
            const hasData = items.length > 0 ||
                (profile.stats?.correct || 0) > 0 ||
                (profile.stats?.points || 0) > 0 ||
                (profile.totalScore || 0) > 0;

            if (!hasData) {
                console.log('📭 Nenhum dado encontrado para migrar (usuário novo).');
                localStorage.setItem(`${MIGRATION_KEY}_${userId}`, new Date().toISOString());
                return { success: true, itemCount: 0, hasData: false };
            }

            // 4. Salva no IndexedDB local
            await localDB.importAll({ items, profile, comments });

            // 5. Se veio do Firebase legado, cria backup blob para próximo dispositivo
            if (source === 'firebase-legacy') {
                const backupData = {
                    version: '2.1.0',
                    backedUpAt: new Date().toISOString(),
                    itemCount: items.length,
                    items: items,
                    profile: profile,
                    comments: comments,
                    migratedFrom: source,
                };
                const backupRef = doc(db, 'users', userId, 'backups', 'data');
                await setDoc(backupRef, backupData);
            }

            // 6. Marca como migrado
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

