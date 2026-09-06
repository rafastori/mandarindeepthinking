import { useState, useEffect, useCallback } from 'react';
import { localDB, LocalProfile } from '../services/localDB';
import { StudyItem, SessionRecord } from '../types';
import { compareCreatedAtDesc, normalizeCreatedAt } from '../utils/dateUtils';
import {
  buildBackupPayload,
  deserializeVoiceRecordings,
  downloadJsonFile,
  extractItems,
  hasBackupExtras,
  mergeProfiles,
  normalizeBackupGraph,
  parseBackupPayload,
  payloadHasContent,
  serializeVoiceRecordings,
} from '../services/backupService';

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
      createdAt: data.createdAt || new Date().toISOString(),
    };

    await localDB.putItem(newItem);
    setItems(prev => [newItem, ...prev].sort(compareCreatedAtDesc));
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
    const currentItem = allItemsFromDB.find(item => String(item.id) === String(id));

    if (!currentItem) {
      console.warn(`[updateItem] Item ${id} não encontrado no IndexedDB`);
      return;
    }

    // 2. Construir item atualizado com os novos dados
    const updatedItem = { ...currentItem, ...data, id: currentItem.id };

    // 3. Persistir no IndexedDB PRIMEIRO (a fonte de verdade deve ser atualizada primeiro)
    await localDB.putItem(updatedItem);

    // 4. Atualizar state React para refletir a mudança na UI
    setItems(prev => {
      const newItems = prev.map(item => String(item.id) === String(id) ? updatedItem : item);
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

  // EXPORTAR TEXTO/PASTA: biblioteca completa (todos os campos do item), sem stats/perfil.
  const exportData = useCallback((_profileData?: { savedIds: string[]; stats: any; totalScore: number }) => {
    if (!userId || items.length === 0) {
      alert('Nenhum dado para exportar!');
      return;
    }

    const defaultName = `textos-memorizatudo-${new Date().toISOString().slice(0, 10)}`;
    const fileName = prompt('Nome do arquivo:', defaultName);
    if (fileName === null) return;

    const payload = {
      version: '2.0.0',
      kind: 'library-only',
      exportedAt: new Date().toISOString(),
      userId,
      itemCount: items.length,
      data: items.map(item => ({
        ...item,
        createdAt: normalizeCreatedAt(item.createdAt),
      })),
      profile: null,
    };

    downloadJsonFile(payload, fileName || defaultName);
  }, [userId, items]);

  // EXPORTAR BACKUP COMPLETO: paridade com a nuvem + gravações de voz (base64).
  const exportFullBackup = useCallback(async () => {
    if (!userId) {
      alert('Faça login para exportar seus dados.');
      return;
    }

    const { items: allItems, profile, comments, sessions, voiceRecordings } = await localDB.exportAll();
    const serializedVoice = await serializeVoiceRecordings(voiceRecordings);
    const payload = buildBackupPayload({
      items: allItems,
      profile,
      comments,
      sessions,
      voiceRecordings: serializedVoice,
      userId,
    });

    if (!payloadHasContent(payload)) {
      alert('Nenhum dado para exportar!');
      return;
    }

    const defaultName = `backup-memorizatudo-${new Date().toISOString().slice(0, 10)}`;
    const fileName = prompt('Nome do arquivo de backup:', defaultName);
    if (fileName === null) return;

    downloadJsonFile(payload, fileName || defaultName);
  }, [userId]);

  const importData = useCallback(async (file: File, mode: 'merge' | 'replace'): Promise<{
    success: boolean;
    count: number;
    error?: string;
    profile?: { savedIds: string[]; stats: any; totalScore: number } | null;
    reload?: boolean;
  }> => {
    if (!userId) return { success: false, count: 0, error: 'Usuário não autenticado' };

    try {
      const raw = JSON.parse(await file.text());
      const parsed = parseBackupPayload(raw);
      const rawItems = extractItems(raw);
      const isFullBackup = hasBackupExtras(raw);

      if (rawItems.length === 0 && !isFullBackup) {
        return { success: false, count: 0, error: 'Arquivo inválido: nenhum item ou backup encontrado' };
      }

      const normalized = normalizeBackupGraph({
        items: rawItems,
        profile: parsed.profile,
        comments: parsed.comments,
        voiceRecordings: parsed.voiceRecordings,
      });
      const itemsToInsert = normalized.items;
      const comments = normalized.comments.filter(c => c && c.id);
      const sessions: SessionRecord[] = Array.isArray(parsed.sessions)
        ? parsed.sessions.filter((s): s is SessionRecord => !!(s && s.id))
        : [];
      const voiceRecordings = deserializeVoiceRecordings(normalized.voiceRecordings);

      if (itemsToInsert.length === 0 && !isFullBackup) {
        return { success: false, count: 0, error: 'Nenhum item válido encontrado no arquivo' };
      }

      const currentProfile = await localDB.getProfile();
      const incomingProfile: LocalProfile | null = normalized.profile;
      const finalProfile = isFullBackup
        ? mergeProfiles(currentProfile, incomingProfile, mode)
        : currentProfile;

      if (mode === 'replace' && isFullBackup) {
        await localDB.importAll({
          items: itemsToInsert,
          profile: finalProfile,
          comments,
          sessions,
          voiceRecordings: parsed.voiceRecordings !== undefined ? voiceRecordings : undefined,
        });
      } else {
        if (mode === 'replace') {
          await localDB.clearItems();
        }
        if (itemsToInsert.length > 0) {
          await localDB.bulkPutItems(itemsToInsert);
        }

        if (isFullBackup) {
          await localDB.saveProfile(finalProfile);

          if (mode === 'replace') await localDB.clearComments();
          for (const c of comments) {
            await localDB.putComment(c);
          }

          if (mode === 'replace') await localDB.clearSessions();
          for (const s of sessions) {
            await localDB.saveSession(s);
          }

          if (parsed.voiceRecordings !== undefined) {
            if (mode === 'replace') {
              await localDB.clearVoiceRecordings();
              await localDB.bulkPutVoiceRecordings(voiceRecordings);
            } else {
              const existingIds = new Set(await localDB.getAllVoiceRecordingIds());
              const toAdd = voiceRecordings.filter(v => !existingIds.has(v.wordId));
              await localDB.bulkPutVoiceRecordings(toAdd);
            }
          }
        }
      }

      const allItems = await localDB.getAllItems();
      allItems.sort(compareCreatedAtDesc);
      setItems(allItems);

      console.log(`Importação local concluída: ${itemsToInsert.length} itens (mode=${mode}, full=${isFullBackup})`);

      const returnedProfile = isFullBackup
        ? {
          savedIds: finalProfile.savedIds || [],
          stats: finalProfile.stats || null,
          totalScore: finalProfile.totalScore || 0,
        }
        : null;

      const voiceImported = parsed.voiceRecordings !== undefined && voiceRecordings.length > 0;

      return {
        success: true,
        count: itemsToInsert.length,
        profile: returnedProfile,
        reload: mode === 'replace' || voiceImported,
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
    exportFullBackup,
    importData,
    renameFolderLocal,
    deleteFolderLocal,
    uncategorizeFolderLocal
  };
};