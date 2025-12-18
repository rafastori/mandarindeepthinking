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

    // LÓGICA NOVA (Compatível com Firebase e HSK)
    const savedItems = useMemo(() => {
        let items: {
            id: string;
            word: string;
            pinyin: string;
            meaning: string;
            sourceId: string;
            language?: 'zh' | 'de' | 'pt' | 'en';
            sentence: { chinese: string; translation: string; language?: 'zh' | 'de' | 'pt' | 'en' };
        }[] = [];

        data.forEach(item => {
            // CASO 1: A palavra é um item importado (Novo sistema Firebase)
            if (savedIds.includes(item.id.toString())) {
                items.push({
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    sourceId: item.id.toString(),
                    language: item.language,
                    sentence: { // Cria um objeto "sentence" falso usando o contexto original
                        chinese: item.originalSentence || item.chinese,
                        translation: "Contexto original", // Como não salvamos a tradução da frase inteira no card único, deixamos genérico ou vazio
                        language: item.language
                    }
                });
            }

            // CASO 2: A palavra está dentro de um texto (Sistema antigo HSK)
            if (item.keywords) {
                item.keywords.forEach(k => {
                    if (savedIds.includes(k.id)) {
                        items.push({
                            ...k,
                            sourceId: k.id,
                            sentence: item // Aqui temos o item pai completo
                        });
                    }
                });
            }
        });

        // Remove duplicatas
        return items.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).reverse();
    }, [savedIds, data]);

    if (savedItems.length === 0) return <EmptyState msg="Marque palavras na Leitura para revisar aqui." icon="bookmark" />;

    return (
        <div className="p-4 space-y-3 pb-24">
            <h2 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Icon name="bookmark" size={20} className="text-brand-600" /> Revisão ({savedItems.length})
            </h2>

            {savedItems.map(item => {
                const isGerman = item.language === 'de' || item.sentence.language === 'de';

                return (
                    <div key={item.id} className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden transition-all duration-300">
                        {/* CABEÇALHO (Sempre visível) */}
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                            <div className="flex-1 min-w-0 pr-2">
                                <h3 className={`${isGerman ? 'font-sans' : 'font-chinese'} text-xl font-bold text-brand-700 truncate`}>{item.word}</h3>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-xs text-slate-400 hover:text-brand-600 font-medium uppercase tracking-wide">
                                    {expandedId === item.id ? 'Recolher' : 'Detalhes'}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(item.sourceId); }}
                                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                                >
                                    <Icon name="trash-2" size={18} />
                                </button>
                            </div>
                        </div>

                        {/* DETALHES (Expansível) */}
                        {expandedId === item.id && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                                <div className="mb-4">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">{isGerman ? 'Pronúncia' : 'Pinyin'}</span>
                                    <p className="font-medium text-brand-600 text-lg">{item.pinyin}</p>
                                    <p className="text-slate-700 mt-2 font-medium">{item.meaning}</p>
                                </div>

                                {/* Contexto */}
                                {item.sentence.chinese && item.sentence.chinese !== item.word && (
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Contexto</span>
                                        <p className={`${isGerman ? 'font-sans' : 'font-chinese'} text-slate-800 mb-1 leading-relaxed`}>
                                            {item.sentence.chinese}
                                        </p>
                                        {/* Só mostra tradução se não for o texto genérico */}
                                        {item.sentence.translation && item.sentence.translation !== "Contexto original" && (
                                            <p className="text-xs text-slate-500 italic">{item.sentence.translation}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ReviewView;