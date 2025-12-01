
import React from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface ReadingViewProps {
    data: StudyItem[];
    savedIds: string[];
    onToggleSave: (id: string) => void;
    onOpenImport: () => void;
    onDeleteText?: (id: string | number) => void;
}

const ReadingView: React.FC<ReadingViewProps> = ({ data, savedIds, onToggleSave, onOpenImport, onDeleteText }) => {
    const speak = useSpeech();

    const renderSentence = (sentence: StudyItem) => {
        const isGerman = sentence.language === 'de';
        
        return sentence.tokens.map((token, i) => {
            const kw = sentence.keywords.find(k => k.word === token);
            
            if (kw) {
                const isSaved = savedIds.includes(kw.id);
                return (
                    <span 
                        key={i} 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onToggleSave(kw.id); 
                            if(!isSaved) speak(kw.word, sentence.language || 'zh'); 
                        }} 
                        className={`inline-block px-1 mx-0.5 rounded cursor-pointer transition-colors border-b-2 mb-1 ${isSaved ? 'bg-brand-100 text-brand-800 border-brand-500 font-medium' : 'hover:bg-slate-100 border-slate-300 border-dotted'}`}
                    >
                        {token}
                    </span>
                );
            } 
            return <span key={i} className="mx-0.5">{token}</span>;
        });
    };

    return (
        <div className="p-4 space-y-4 pb-24 relative min-h-full">
            {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <EmptyState msg="Sua biblioteca está vazia." icon="book-open" />
                    <p className="text-slate-400 text-sm mt-2 max-w-xs">Toque no botão + abaixo para importar um texto e começar seus estudos.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex items-center gap-2 text-sm text-slate-500">
                        <Icon name="info" size={16} /><span>Toque nas palavras para salvar.</span>
                    </div>
                    
                    {data.map((item) => {
                        const isImported = typeof item.id === 'string';
                        const isGerman = item.language === 'de';
                        return (
                            <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start gap-4">
                                    <div className={`${isGerman ? 'font-sans font-medium' : 'font-chinese'} text-xl leading-loose text-slate-800 flex-1 break-words pt-1`}>
                                        {renderSentence(item)}
                                    </div>
                                    
                                    <div className="flex flex-col gap-3 flex-shrink-0 ml-1">
                                        <button 
                                            onClick={() => speak(item.chinese, item.language || 'zh')} 
                                            className="text-brand-600 bg-brand-50 p-3 rounded-full hover:bg-brand-100 transition-colors shadow-sm"
                                            title="Ouvir Pronúncia"
                                        >
                                            <Icon name="volume-2" size={20} />
                                        </button>

                                        {isImported && onDeleteText && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteText(item.id); }}
                                                className="text-slate-400 bg-slate-50 p-3 rounded-full hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                                title="Remover Texto"
                                            >
                                                <Icon name="trash-2" size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-50">
                                    <p className="text-slate-500 text-sm italic">{item.translation}</p>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            <div className="fixed bottom-24 right-6 z-40">
                <button 
                    onClick={onOpenImport}
                    className="bg-brand-600 text-white p-4 rounded-full shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center animate-pop"
                >
                    <Icon name="plus" size={24} />
                </button>
            </div>
        </div>
    );
};

export default ReadingView;
