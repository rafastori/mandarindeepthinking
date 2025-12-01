
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';

interface ReviewViewProps {
    data: StudyItem[];
    savedIds: string[];
    onRemove: (id: string) => void;
}

const ReviewView: React.FC<ReviewViewProps> = ({ data, savedIds, onRemove }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    const savedItems = useMemo(() => { 
        let items: any[] = []; 
        data.forEach(s => s.keywords.forEach(k => { 
            if (savedIds.includes(k.id)) items.push({ ...k, sentence: s }); 
        })); 
        return items; 
    }, [savedIds, data]);

    if (savedItems.length === 0) return <EmptyState msg="Marque palavras na Leitura para revisar aqui." />;

    return (
        <div className="p-4 space-y-3 pb-24">
            <h2 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Icon name="bookmark" size={20} className="text-brand-600"/> Revisão ({savedItems.length})
            </h2>
            {savedItems.map(item => {
                const isGerman = item.sentence.language === 'de';
                return (
                    <div key={item.id} className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                            <h3 className={`${isGerman ? 'font-sans' : 'font-chinese'} text-xl font-bold text-brand-700`}>{item.word}</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="text-xs text-slate-400 hover:text-brand-600 font-medium uppercase tracking-wide">
                                    {expandedId === item.id ? 'Recolher' : 'Detalhes'}
                                </button>
                                <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600">
                                    <Icon name="trash-2" size={18} />
                                </button>
                            </div>
                        </div>
                        {expandedId === item.id && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-pop">
                                <div className="mb-3">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">{isGerman ? 'Pronúncia (IPA)' : 'Pinyin'}</span>
                                    <p className="font-medium text-brand-600 text-lg">{item.pinyin}</p>
                                    <p className="text-slate-600 mt-2">{item.meaning}</p>
                                </div>
                                <div className="bg-white p-3 rounded border border-slate-200">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Contexto</span>
                                    <p className={`${isGerman ? 'font-sans' : 'font-chinese'} text-slate-800 mb-1`}>{item.sentence.chinese}</p>
                                    <p className="text-xs text-slate-500 italic">{item.sentence.translation}</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ReviewView;
