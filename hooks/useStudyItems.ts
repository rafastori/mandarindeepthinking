import { useState, useEffect, useCallback } from 'react';
import { localDB } from '../services/localDB';
import { StudyItem } from '../types';
import { compareCreatedAtDesc, normalizeCreatedAt, getTimestamp } from '../utils/dateUtils';

/**
 * useStudyItems - Hook LOCAL-FIRST para gerenciar itens de estudo.
 * 
 * Todos os dados são lidos e escritos no IndexedDB local.
 * O Firebase é usado APENAS para backup/restore manual (via useCloudSync).
 */
export const useStudyItems = (userId: string | null | undefined) => {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Migração de IDs legados:
   *  - Itens antigos podem ter `id: number` OU `id: "2469"` (string que parece número).
   *  - Ambos quebram comparações em vários lugares — convertemos para `legacy_<id>`.
   *  - Sempre verificamos no startup (não é controlado por flag) — é idempotente
   *    e barato; se nada bate o pattern, retorna em <5ms.
   */
  const runLegacyIdMigrationIfNeeded = async (): Promise<void> => {
    try {
      const all = await localDB.getAllItems();

      // Detecta itens problemáticos:
      //  - id é number ou string-numérica ("2469") -> precisa virar legacy_<id>
      //  - createdAt está em formato Firestore Timestamp / Date / inválido
      //    -> normalizar para ISO string (CRÍTICO: senão corrompe Array.sort com NaN)
      const itemsToFix = all.filter(it => {
        const idIsLegacy = typeof it.id === 'number' || (typeof it.id === 'string' && /^\d+$/.test(it.id));
        const createdAtIsString = typeof it.createdAt === 'string';
        const createdAtIsValid = createdAtIsString && !isNaN(Date.parse(it.createdAt));
        return idIsLegacy || !createdAtIsValid;
      });

      if (itemsToFix.length === 0) return;

      const idChanges = itemsToFix.filter(it => typeof it.id === 'number' || /^\d+$/.test(String(it.id)));
      const dateChanges = itemsToFix.filter(it => {
        const ok = typeof it.createdAt === 'string' && !isNaN(Date.parse(it.createdAt));
        return !ok;
      });
      console.log(`[migration] normalizando ${itemsToFix.length} itens (IDs: ${idChanges.length}, createdAt: ${dateChanges.length})`);

      // Apaga as chaves antigas (apenas dos que vão mudar de id)
      const idsToDelete: (string | number)[] = idChanges.map(it => it.id);
      if (idsToDelete.length > 0) await localDB.bulkDeleteItems(idsToDelete);

      // Reescreve TODOS os itens problemáticos com:
      //  - id virando string (legacy_<antigo>) se era número/string-numérica
      //  - createdAt virando ISO string sempre
      const remapped: StudyItem[] = itemsToFix.map(it => {
        const idIsLegacy = typeof it.id === 'number' || (typeof it.id === 'string' && /^\d+$/.test(it.id));
        return {
          ...it,
          id: idIsLegacy ? `legacy_${it.id}` : it.id,
          createdAt: normalizeCreatedAt(it.createdAt),
        };
      });
      await localDB.bulkPutItems(remapped);

      await localDB.updateProfile({ legacyIdsMigratedAt: new Date().toISOString() });
      console.log('[migration] concluída');
    } catch (e) {
      console.error('[migration] falhou (não bloqueia carregamento):', e);
    }
  };

  // Carrega itens do IndexedDB na inicialização (com migração de IDs legados)
  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      try {
        await runLegacyIdMigrationIfNeeded();
        const localItems = await localDB.getAllItems();
        if (!cancelled) {
          // NaN-safe sort (V8 silenciosamente degrada sort se comparator retorna NaN)
          localItems.sort(compareCreatedAtDesc);
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

  // Remove um item (aceita string OU number — IDs antigos são number)
  const deleteItem = useCallback(async (id: string | number) => {
    if (!userId) return;
    await localDB.deleteItem(id);
    // Comparação por String() para suportar IDs numéricos legados
    setItems(prev => prev.filter(item => String(item.id) !== String(id)));
  }, [userId]);

  // Apaga vários de uma vez (batch)
  const deleteManyItems = useCallback(async (ids: (string | number)[]) => {
    if (!userId || ids.length === 0) return;
    await localDB.bulkDeleteItems(ids);
    const idSet = new Set(ids.map(i => String(i)));
    setItems(prev => prev.filter(item => !idSet.has(String(item.id))));
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
        newItems.sort(compareCreatedAtDesc);
      }
      return newItems;
    });
  }, [userId]);

  /**
   * Reordena itens de forma atômica.
   *
   * Estratégia: o caller manda a NOVA ORDEM completa de IDs.
   * Reescrevemos os createdAt em sequência decrescente partindo de Date.now(),
   * 1 segundo por posição. Isso garante que:
   *  - IDs numéricos (legados) ou string funcionam igual (compara via String()).
   *  - Não dependemos de timestamps antigos (que podem estar em formato Firestore,
   *    null, idênticos entre si, ou ausentes).
   *  - A ordenação resultante por createdAt DESC bate exatamente com a ordem pedida.
   */
  const reorderItems = useCallback(async (updates: { id: string | number; createdAt?: string }[]) => {
    if (!userId || updates.length === 0) return;

    try {
      const now = Date.now();
      // Mapa: id -> nova data (1s entre posições, posição 0 = mais recente)
      const updateMap = new Map<string, string>();
      updates.forEach((u, i) => {
        updateMap.set(String(u.id), new Date(now - i * 1000).toISOString());
      });

      // Lê tudo do IndexedDB e aplica novas datas
      const allItems = await localDB.getAllItems();
      let touched = 0;
      const updatedItems = allItems.map(item => {
        const newCreatedAt = updateMap.get(String(item.id));
        if (newCreatedAt) {
          touched++;
          return { ...item, createdAt: newCreatedAt };
        }
        return item;
      });

      if (touched === 0) {
        console.warn('[reorderItems] Nenhum item bateu com os IDs enviados:', updates.slice(0, 3));
      }

      await localDB.bulkPutItems(updatedItems);

      // Recarrega + ordena (NaN-safe — crítico para itens legados)
      const reloaded = await localDB.getAllItems();
      reloaded.sort(compareCreatedAtDesc);
      setItems(reloaded);

      console.log(`[reorderItems] ${touched}/${updates.length} itens reordenados`);
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
      allItems.sort(compareCreatedAtDesc);
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
    deleteManyItems,
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