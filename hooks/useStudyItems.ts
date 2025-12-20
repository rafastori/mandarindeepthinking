import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { StudyItem } from '../types';

export const useStudyItems = (userId: string | null | undefined) => {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'users', userId, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyItem)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const addItem = async (data: Omit<StudyItem, 'id'>) => {
    if (!userId) return null;
    const docRef = await addDoc(collection(db, 'users', userId, 'items'), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'items', id));
  };

  // NOVA FUNÇÃO: Atualiza um item (ex: trocar idioma)
  const updateItem = async (id: string, data: Partial<StudyItem>) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'items', id), data);
  };

  // NOVA FUNÇÃO: DELETA TUDO DE UMA VEZ
  const clearLibrary = async () => {
    if (!userId) return;

    try {
      const q = query(collection(db, 'users', userId, 'items'));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log("Biblioteca limpa com sucesso.");
    } catch (error) {
      console.error("Erro ao limpar biblioteca:", error);
      throw error;
    }
  };

  // EXPORTAR DADOS: Gera arquivo JSON para download
  const exportData = () => {
    if (!userId || items.length === 0) {
      alert("Nenhum dado para exportar!");
      return;
    }

    const payload = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      userId: userId,
      itemCount: items.length,
      data: items.map(item => ({
        chinese: item.chinese,
        pinyin: item.pinyin,
        translation: item.translation,
        language: item.language,
        tokens: item.tokens || [],
        keywords: item.keywords || [],
        originalSentence: item.originalSentence || null,
      }))
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-memorizatudo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // IMPORTAR DADOS: Carrega arquivo JSON e insere no Firestore
  const importData = async (file: File, mode: 'merge' | 'replace'): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!userId) return { success: false, count: 0, error: "Usuário não autenticado" };

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      // Validação básica
      if (!payload.data || !Array.isArray(payload.data)) {
        return { success: false, count: 0, error: "Arquivo inválido: formato incorreto" };
      }

      // Filtra itens válidos (devem ter chinese e translation)
      const validItems = payload.data.filter((item: any) =>
        item.chinese && item.translation
      );

      if (validItems.length === 0) {
        return { success: false, count: 0, error: "Nenhum item válido encontrado no arquivo" };
      }

      // Se modo 'replace', limpa biblioteca primeiro
      if (mode === 'replace') {
        await clearLibrary();
      }

      // Insere em batches (limite de 500 por batch do Firestore)
      const BATCH_SIZE = 400;
      let imported = 0;

      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const chunk = validItems.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((item: any) => {
          const docRef = doc(collection(db, 'users', userId, 'items'));
          batch.set(docRef, {
            chinese: item.chinese,
            pinyin: item.pinyin || '',
            translation: item.translation,
            language: item.language || 'zh',
            tokens: item.tokens || [],
            keywords: item.keywords || [],
            originalSentence: item.originalSentence || null,
            createdAt: serverTimestamp()
          });
        });

        await batch.commit();
        imported += chunk.length;
      }

      console.log(`Importação concluída: ${imported} itens`);
      return { success: true, count: imported };

    } catch (error: any) {
      console.error("Erro na importação:", error);
      return { success: false, count: 0, error: error.message || "Erro ao processar arquivo" };
    }
  };

  return { items, loading, addItem, deleteItem, updateItem, clearLibrary, exportData, importData };
};
