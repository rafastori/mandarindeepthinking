import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { StudyItem } from '../types';

export const useStudyItems = (userId: string | null | undefined) => {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'users', userId, 'items'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const results: StudyItem[] = [];
        querySnapshot.forEach((doc) => {
          // Combina o ID do documento com os dados
          results.push({ id: doc.id, ...doc.data() } as StudyItem);
        });
        setItems(results);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching study items:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const addItem = async (data: Omit<StudyItem, 'id'>) => {
    if (!userId) return;
    
    // Salva o objeto completo (chinese, pinyin, translation, tokens, etc.)
    // Adiciona o timestamp para ordenação
    await addDoc(collection(db, 'users', userId, 'items'), {
      ...data,
      createdAt: serverTimestamp()
    });
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;
    
    await deleteDoc(doc(db, 'users', userId, 'items', id));
  };

  return { items, loading, error, addItem, deleteItem };
};