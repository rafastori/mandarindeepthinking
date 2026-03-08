import { useState, useEffect, useCallback } from 'react';
import { localDB } from '../services/localDB';
import { StudyItem } from '../types';

/**
 * useStudyItems - Hook LOCAL-FIRST para gerenciar itens de estudo.
 * 
 * Todos os dados são lidos e escritos no IndexedDB local.
 * O Firebase é usado APENAS para backup/restore manual (via useCloudSync).
 */
export const useStudyItems = (userId: string | null | undefined) => {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega itens do IndexedDB na inicialização
  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      try {
        const localItems = await localDB.getAllItems();
        if (!cancelled) {
          // Ordena por createdAt descrescente (mais recentes primeiro)
          localItems.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setItems(localItems);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar itens do IndexedDB:', error);
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      }
    };

    loadItems();

    return () => { cancelled = true; };
  }, [userId]);

  // Adiciona um novo item
  const addItem = useCallback(async (data: Omit<StudyItem, 'id'>): Promise<string | null> => {
    if (!userId) return null;

    // Gera um ID único localmente
    const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: StudyItem = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };

    await localDB.putItem(newItem);
    setItems(prev => [newItem, ...prev]);
    return id;
  }, [userId]);

  // Remove um item
  const deleteItem = useCallback(async (id: string) => {
    if (!userId) return;
    await localDB.deleteItem(id);
    setItems(prev => prev.filter(item => item.id !== id));
  }, [userId]);

  // Atualiza um item parcialmente
  // CORREÇÃO CRÍTICA: Busca do IndexedDB (fonte de verdade) ANTES de atualizar
  // Isso garante que atualizações sequenciais, como na reordenação, peguem dados sempre atualizados
  const updateItem = useCallback(async (id: string, data: Partial<StudyItem>) => {
    if (!userId) return;

    // 1. Buscar item DIRETAMENTE do IndexedDB (fonte de verdade)
    const allItemsFromDB = await localDB.getAllItems();
    const currentItem = allItemsFromDB.find(item => item.id === id);

    if (!currentItem) {
      console.warn(`[updateItem] Item ${id} não encontrado no IndexedDB`);
      return;
    }

    // 2. Construir item atualizado com os novos dados
    const updatedItem = { ...currentItem, ...data };

    // 3. Persistir no IndexedDB PRIMEIRO (a fonte de verdade deve ser atualizada primeiro)
    await localDB.putItem(updatedItem);

    // 4. Atualizar state React para refletir a mudança na UI
    setItems(prev => {
      const newItems = prev.map(item => item.id === id ? updatedItem : item);

      // Reordenar se createdAt foi alterado (usado na reordenação manual)
      if (data.createdAt !== undefined) {
        newItems.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      }
      return newItems;
    });
  }, [userId]);

  // Reordena itens de forma atômica (batch write + reload)
  const reorderItems = useCallback(async (updates: { id: string; createdAt: string }[]) => {
    if (!userId || updates.length === 0) return;

    try {
      // 1. Ler todos os itens do IndexedDB (fonte de verdade)
      const allItems = await localDB.getAllItems();

      // 2. Criar mapa de atualizações por ID
      const updateMap = new Map(updates.map(u => [u.id, u.createdAt]));

      // 3. Aplicar as novas datas nos itens
      const updatedItems = allItems.map(item => {
        const newCreatedAt = updateMap.get(item.id as string);
        if (newCreatedAt) {
          return { ...item, createdAt: newCreatedAt };
        }
        return item;
      });

      // 4. Escrever TUDO de volta de uma vez (transação atômica)
      await localDB.bulkPutItems(updatedItems);

      // 5. Recarregar do IndexedDB e reordenar (como o importData faz)
      const reloaded = await localDB.getAllItems();
      reloaded.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setItems(reloaded);

      console.log(`[reorderItems] ${updates.length} itens reordenados com sucesso`);
    } catch (error) {
      console.error('[reorderItems] Erro:', error);
      throw error;
    }
  }, [userId]);

  // Limpa toda a biblioteca local
  const clearLibrary = useCallback(async () => {
    if (!userId) return;
    await localDB.clearItems();
    setItems([]);
    console.log('Biblioteca local limpa com sucesso.');
  }, [userId]);

  // Renomeia ou move uma pasta e seus itens
  const renameFolderLocal = useCallback(async (oldPath: string, newPath: string) => {
    if (!userId) return { success: false, updatedCount: 0 };

    const updatedItems = items.filter(item =>
      item.folderPath === oldPath || item.folderPath?.startsWith(`${oldPath}/`)
    ).map(item => ({
      ...item,
      folderPath: item.folderPath!.replace(oldPath, newPath)
    }));

    if (updatedItems.length > 0) {
      await localDB.bulkPutItems(updatedItems);
      setItems(prev => prev.map(item => {
        const updated = updatedItems.find(u => u.id === item.id);
        return updated || item;
      }));
    }
    return { success: true, updatedCount: updatedItems.length };
  }, [userId, items]);

  // Deleta uma pasta e todos os seus itens
  const deleteFolderLocal = useCallback(async (folderPath: string) => {
    if (!userId) return { success: false, deletedCount: 0 };

    const idsToDelete = items.filter(item =>
      item.folderPath === folderPath || item.folderPath?.startsWith(`${folderPath}/`)
    ).map(item => item.id);

    if (idsToDelete.length > 0) {
      await localDB.bulkDeleteItems(idsToDelete);
      setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));
    }
    return { success: true, deletedCount: idsToDelete.length };
  }, [userId, items]);

  // Remove a categoria de todos os itens da pasta (move para Sem Categoria)
  const uncategorizeFolderLocal = useCallback(async (folderPath: string) => {
    if (!userId) return { success: false, movedCount: 0 };

    const updatedItems = items.filter(item =>
      item.folderPath === folderPath || item.folderPath?.startsWith(`${folderPath}/`)
    ).map(item => ({
      ...item,
      folderPath: null
    }));

    if (updatedItems.length > 0) {
      await localDB.bulkPutItems(updatedItems);
      setItems(prev => prev.map(item => {
        const updated = updatedItems.find(u => u.id === item.id);
        return updated || item;
      }));
    }
    return { success: true, movedCount: updatedItems.length };
  }, [userId, items]);

  // EXPORTAR DADOS: Gera arquivo JSON para download
  const exportData = useCallback((profileData?: { savedIds: string[]; stats: any; totalScore: number }) => {
    if (!userId || items.length === 0) {
      alert('Nenhum dado para exportar!');
      return;
    }

    const defaultName = `backup-memorizatudo-${new Date().toISOString().slice(0, 10)}`;
    const fileName = prompt('Nome do arquivo de backup:', defaultName);
    if (fileName === null) return;

    const payload = {
      version: '2.0.0', // Nova versão local-first
      exportedAt: new Date().toISOString(),
      userId: userId,
      itemCount: items.length,
      data: items.map(item => ({
        id: item.id,
        chinese: item.chinese,
        pinyin: item.pinyin,
        translation: item.translation,
        language: item.language,
        tokens: item.tokens || [],
        keywords: item.keywords || [],
        originalSentence: item.originalSentence || null,
        type: item.type || 'text',
        folderPath: item.folderPath || null,
        createdAt: item.createdAt || null,
      })),
      profile: profileData ? {
        savedIds: profileData.savedIds || [],
        stats: profileData.stats || { correct: 0, wrong: 0, history: [], wordCounts: {} },
        totalScore: profileData.totalScore || 0
      } : null
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || defaultName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [userId, items]);

  // IMPORTAR DADOS: Carrega arquivo JSON e insere no IndexedDB local
  const importData = useCallback(async (file: File, mode: 'merge' | 'replace'): Promise<{
    success: boolean;
    count: number;
    error?: string;
    profile?: { savedIds: string[]; stats: any; totalScore: number } | null;
  }> => {
    if (!userId) return { success: false, count: 0, error: 'Usuário não autenticado' };

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload.data || !Array.isArray(payload.data)) {
        return { success: false, count: 0, error: 'Arquivo inválido: formato incorreto' };
      }

      const validItems = payload.data.filter((item: any) =>
        item.chinese && item.translation
      );

      if (validItems.length === 0) {
        return { success: false, count: 0, error: 'Nenhum item válido encontrado no arquivo' };
      }

      // Se modo 'replace', limpa biblioteca primeiro
      if (mode === 'replace') {
        await localDB.clearItems();
      }

      // Prepara itens para inserção local
      const itemsToInsert: StudyItem[] = validItems.map((item: any) => ({
        id: item.id && typeof item.id === 'string'
          ? item.id
          : `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chinese: item.chinese,
        pinyin: item.pinyin || '',
        translation: item.translation,
        language: item.language || 'zh',
        tokens: item.tokens || [],
        keywords: item.keywords || [],
        originalSentence: item.originalSentence || null,
        type: item.type || 'text',
        folderPath: item.folderPath || null,
        createdAt: item.createdAt || new Date().toISOString(),
      }));

      await localDB.bulkPutItems(itemsToInsert);

      // Recarrega do banco para refletir tudo
      const allItems = await localDB.getAllItems();
      allItems.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setItems(allItems);

      console.log(`Importação local concluída: ${itemsToInsert.length} itens`);

      return {
        success: true,
        count: itemsToInsert.length,
        profile: payload.profile || null
      };

    } catch (error: any) {
      console.error('Erro na importação:', error);
      return { success: false, count: 0, error: error.message || 'Erro ao processar arquivo' };
    }
  }, [userId]);

  return {
    items,
    loading,
    addItem,
    deleteItem,
    updateItem,
    reorderItems,
    clearLibrary,
    exportData,
    importData,
    renameFolderLocal,
    deleteFolderLocal,
    uncategorizeFolderLocal
  };
};