import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc
} from 'firebase/firestore';

const BATCH_LIMIT = 400; // Firestore limit é 500, usamos 400 por segurança

/**
 * Renomeia uma pasta, atualizando o folderPath de todos os itens que começam com oldPath.
 * Suporta renomear pastas pai (ex: "Aula 1" -> "Módulo 1" também atualiza "Aula 1/Gramática")
 */
export const renameFolder = async (
    userId: string,
    oldPath: string,
    newPath: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> => {
    try {
        const itemsRef = collection(db, 'users', userId, 'items');

        // Busca itens que começam com oldPath (para pegar subpastas também)
        // Firestore não tem "startsWith", então buscamos >= oldPath e < oldPath + '\uf8ff'
        const q = query(
            itemsRef,
            where('folderPath', '>=', oldPath),
            where('folderPath', '<', oldPath + '\uf8ff')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, updatedCount: 0 };
        }

        // Dividir em batches se necessário
        const docs = snapshot.docs;
        let updatedCount = 0;

        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + BATCH_LIMIT);

            chunk.forEach((docSnap) => {
                const currentPath = docSnap.data().folderPath as string;
                // Substitui apenas o prefixo oldPath pelo newPath
                const updatedPath = currentPath.replace(oldPath, newPath);
                batch.update(doc(db, 'users', userId, 'items', docSnap.id), {
                    folderPath: updatedPath
                });
            });

            await batch.commit();
            updatedCount += chunk.length;
        }

        return { success: true, updatedCount };
    } catch (error: any) {
        console.error('Erro ao renomear pasta:', error);
        return { success: false, updatedCount: 0, error: error.message };
    }
};

/**
 * Move itens de uma pasta para outra (ou para "Sem Categoria" se targetPath for null)
 */
export const moveItemsToFolder = async (
    userId: string,
    itemIds: string[],
    targetPath: string | null
): Promise<{ success: boolean; movedCount: number; error?: string }> => {
    try {
        let movedCount = 0;

        for (let i = 0; i < itemIds.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            const chunk = itemIds.slice(i, i + BATCH_LIMIT);

            chunk.forEach((itemId) => {
                batch.update(doc(db, 'users', userId, 'items', itemId), {
                    folderPath: targetPath
                });
            });

            await batch.commit();
            movedCount += chunk.length;
        }

        return { success: true, movedCount };
    } catch (error: any) {
        console.error('Erro ao mover itens:', error);
        return { success: false, movedCount: 0, error: error.message };
    }
};

/**
 * Deleta uma pasta e todos os seus itens
 */
export const deleteFolderWithItems = async (
    userId: string,
    folderPath: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
    try {
        const itemsRef = collection(db, 'users', userId, 'items');

        // Busca itens que começam com folderPath
        const q = query(
            itemsRef,
            where('folderPath', '>=', folderPath),
            where('folderPath', '<', folderPath + '\uf8ff')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, deletedCount: 0 };
        }

        const docs = snapshot.docs;
        let deletedCount = 0;

        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + BATCH_LIMIT);

            chunk.forEach((docSnap) => {
                batch.delete(doc(db, 'users', userId, 'items', docSnap.id));
            });

            await batch.commit();
            deletedCount += chunk.length;
        }

        return { success: true, deletedCount };
    } catch (error: any) {
        console.error('Erro ao deletar pasta:', error);
        return { success: false, deletedCount: 0, error: error.message };
    }
};

/**
 * Move todos os itens de uma pasta para "Sem Categoria" (folderPath = null)
 */
export const uncategorizeFolder = async (
    userId: string,
    folderPath: string
): Promise<{ success: boolean; movedCount: number; error?: string }> => {
    try {
        const itemsRef = collection(db, 'users', userId, 'items');

        const q = query(
            itemsRef,
            where('folderPath', '>=', folderPath),
            where('folderPath', '<', folderPath + '\uf8ff')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, movedCount: 0 };
        }

        const docs = snapshot.docs;
        let movedCount = 0;

        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + BATCH_LIMIT);

            chunk.forEach((docSnap) => {
                batch.update(doc(db, 'users', userId, 'items', docSnap.id), {
                    folderPath: null
                });
            });

            await batch.commit();
            movedCount += chunk.length;
        }

        return { success: true, movedCount };
    } catch (error: any) {
        console.error('Erro ao descategorizar pasta:', error);
        return { success: false, movedCount: 0, error: error.message };
    }
};

/**
 * Extrai lista única de pastas a partir dos itens
 */
export const extractFolderPaths = (items: { folderPath?: string | null }[]): string[] => {
    const folders = new Set<string>();

    items.forEach(item => {
        if (item.folderPath) {
            folders.add(item.folderPath);

            // Também adiciona pastas pai (ex: "A/B/C" adiciona "A" e "A/B")
            const parts = item.folderPath.split('/');
            let path = '';
            for (let i = 0; i < parts.length - 1; i++) {
                path = path ? `${path}/${parts[i]}` : parts[i];
                folders.add(path);
            }
        }
    });

    return Array.from(folders).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

/**
 * Conta itens em uma pasta (incluindo subpastas)
 */
export const countItemsInFolder = (
    items: { folderPath?: string | null }[],
    folderPath: string
): number => {
    return items.filter(item =>
        item.folderPath === folderPath ||
        item.folderPath?.startsWith(folderPath + '/')
    ).length;
};

/**
 * Agrupa itens por pasta em estrutura de árvore
 */
export interface FolderNode {
    name: string;
    path: string;
    itemCount: number;
    children: FolderNode[];
}

export const buildFolderTree = (items: { folderPath?: string | null }[]): FolderNode[] => {
    const root: FolderNode[] = [];
    const nodeMap = new Map<string, FolderNode>();

    // Primeiro, coleta todas as pastas únicas
    const folders = extractFolderPaths(items);

    folders.forEach(path => {
        const parts = path.split('/');
        let currentPath = '';

        parts.forEach((part, index) => {
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!nodeMap.has(currentPath)) {
                const node: FolderNode = {
                    name: part,
                    path: currentPath,
                    itemCount: countItemsInFolder(items, currentPath),
                    children: []
                };
                nodeMap.set(currentPath, node);

                if (index === 0) {
                    root.push(node);
                } else {
                    const parent = nodeMap.get(parentPath);
                    if (parent) {
                        parent.children.push(node);
                    }
                }
            }
        });
    });

    return root;
};
