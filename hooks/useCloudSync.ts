import { useState, useCallback } from 'react';
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { localDB, LocalProfile } from '../services/localDB';
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
    migrateFromFirebase: () => Promise<{ success: boolean; itemCount: number }>;
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
            const { items, profile } = await localDB.exportAll();

            const backupData = {
                version: '2.0.0',
                backedUpAt: new Date().toISOString(),
                itemCount: items.length,
                items: items,
                profile: profile,
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

            const timestamp = new Date().toISOString();
            profile.lastRestoreAt = timestamp;

            await localDB.importAll({ items, profile });

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
     * Migração one-time: Lê dados do Firebase legado (coleção items + doc de perfil)
     * e importa para o IndexedDB local. Também cria o primeiro backup blob.
     */
    const migrateFromFirebase = useCallback(async (): Promise<{ success: boolean; itemCount: number }> => {
        if (!userId) return { success: false, itemCount: 0 };

        setIsSyncing(true);
        try {
            console.log('🔄 Iniciando migração do Firebase para local...');

            // 1. Lê todos os itens da coleção legada
            const itemsQuery = query(
                collection(db, 'users', userId, 'items'),
                orderBy('createdAt', 'desc')
            );
            const itemsSnap = await getDocs(itemsQuery);
            const items: StudyItem[] = itemsSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as StudyItem));

            // 2. Lê o perfil legado (doc do usuário)
            const userDocSnap = await getDoc(doc(db, 'users', userId));
            const userData = userDocSnap.exists() ? userDocSnap.data() : {};

            const profile: LocalProfile = {
                savedIds: userData.savedIds || [],
                stats: userData.stats || { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] },
                totalScore: userData.totalScore || 0,
                activeFolderFilters: userData.activeFolderFilters || [],
                lastBackupAt: new Date().toISOString(),
            };

            // 3. Salva no IndexedDB local
            await localDB.importAll({ items, profile });

            // 4. Cria primeiro backup no novo formato (blob)
            const backupData = {
                version: '2.0.0',
                backedUpAt: new Date().toISOString(),
                itemCount: items.length,
                items: items,
                profile: profile,
                migratedFrom: 'firebase-legacy',
            };
            const backupRef = doc(db, 'users', userId, 'backups', 'data');
            await setDoc(backupRef, backupData);

            // 5. Marca como migrado
            localStorage.setItem(`${MIGRATION_KEY}_${userId}`, new Date().toISOString());

            console.log(`✅ Migração concluída: ${items.length} itens migrados para local + backup criado.`);
            return { success: true, itemCount: items.length };

        } catch (error) {
            console.error('Erro na migração:', error);
            // Marca como migrado mesmo em caso de erro para não travar o app
            localStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'error');
            return { success: false, itemCount: 0 };
        } finally {
            setIsSyncing(false);
        }
    }, [userId]);

    return { backupToCloud, restoreFromCloud, migrateFromFirebase, needsMigration, isSyncing, lastBackupAt, lastRestoreAt };
}

