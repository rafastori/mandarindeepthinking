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
  getDocs, // <--- NOVO
  writeBatch // <--- NOVO (Para deletar em lote, mais rápido)
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

  // NOVA FUNÇÃO: DELETA TUDO DE UMA VEZ
  const clearLibrary = async () => {
    if (!userId) return;
    
    try {
        const q = query(collection(db, 'users', userId, 'items'));
        const snapshot = await getDocs(q);
        
        // O Firestore só permite deletar em lotes de 500. 
        // Como é um app pessoal, um batch resolve.
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

  return { items, loading, addItem, deleteItem, clearLibrary };
};