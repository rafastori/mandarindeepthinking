import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Stats } from '../types';
import { processTextWithGemini } from '../services/gemini';

interface CreativeViewProps {
    data: StudyItem[];
    savedIds: string[];
    stats: Stats; // Recebe as estatísticas para saber o que você errou
    onSave: (item: StudyItem) => void;
}

const CreativeView: React.FC<CreativeViewProps> = ({ data, savedIds, stats, onSave }) => {
    const [generatedItem, setGeneratedItem] = useState<StudyItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [targetLang, setTargetLang] = useState<'zh' | 'de'>('zh'); // Switch de Língua

    // 1. Coleta todo o vocabulário salvo
    const allVocabulary = useMemo(() => {
        let words: {text: string, lang: string}[] = [];
        data.forEach(item => {
            // Novo sistema
            if (savedIds.includes(item.id.toString())) {
                words.push({ text: item.chinese, lang: item.language || 'zh' });
            }
            // Antigo sistema
            if (item.keywords) {
                item.keywords.forEach(k => {
                    if (savedIds.includes(k.id)) {
                        words.push({ text: k.word, lang: item.language || 'zh' });
                    }
                });
            }
        });
        // Remove duplicatas
        return words.filter((v, i, a) => a.findIndex(t => (t.text === v.text)) === i);
    }, [data, savedIds]);

    // 2. Filtra palavras da língua selecionada
    const langVocabulary = useMemo(() => {
        return allVocabulary.filter(w => w.lang === targetLang).map(w => w.text);
    }, [allVocabulary, targetLang]);

    const generateStory = async () => {
        if (langVocabulary.length < 3) return;
        setLoading(true);
        
        // --- LÓGICA DE SELEÇÃO INTELIGENTE (Prioriza Erros) ---
        
        // A. Identifica palavras erradas recentemente
        const recentErrors = stats.history
            .filter(h => h.type === 'general') // Pega erros gerais
            .map(h => h.word);
            
        // B. Separa o vocabulário em "Prioridade" (Erros) e "Outros"
        const priorityWords = langVocabulary.filter(w => recentErrors.includes(w));
        const otherWords = langVocabulary.filter(w => !recentErrors.includes(w));

        // C. Mistura os "Outros" para dar variedade
        const shuffledOthers = otherWords.sort(() => 0.5 - Math.random());

        // D. Junta tudo e corta em 10 (Prioridade vem primeiro)
        const selectedWords = [...priorityWords, ...shuffledOthers].slice(0, 10);
        
        try {
            const langName = targetLang === 'de' ? 'German' : 'Chinese Mandarin';
            const prompt = `
                Create a short, creative story (max 3 sentences) in ${langName} using these specific words: ${selectedWords.join(', ')}.
                The story must make sense.
            `;
            
            // Chama a API passando a língua correta
            const result = await processTextWithGemini(prompt, 'direct', targetLang);
            
            if (result && result.length > 0) {
                setGeneratedItem(result[0]);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao criar história. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    if (langVocabulary.length < 3) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <EmptyState msg="Modo Criativo" icon="sparkles" />
                <p className="text-slate-400 text-sm mt-2 mb-6">
                    Salve pelo menos 3 palavras em 
                    <span className="font-bold text-slate-600"> {targetLang === 'zh' ? 'Mandarim' : 'Alemão'} </span>
                    para criar histórias.
                </p>
                
                {/* Switch de Língua mesmo no estado vazio */}
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button 
                        onClick={() => setTargetLang('zh')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${targetLang === 'zh' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        Mandarim
                    </button>
                    <button 
                        onClick={() => setTargetLang('de')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${targetLang === 'de' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                    >
                        Alemão
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col items-center justify-center pb-24">
            {!generatedItem ? (
                <div className="text-center w-full max-w-sm">
                    <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon name="sparkles" size={40} className="text-purple-600" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Histórias com IA</h2>
                    
                    {/* Switch de Língua */}
                    <div className="flex justify-center mb-6">
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button 
                                onClick={() => setTargetLang('zh')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${targetLang === 'zh' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                🇨🇳 Mandarim
                            </button>
                            <button 
                                onClick={() => setTargetLang('de')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${targetLang === 'de' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                🇩🇪 Alemão
                            </button>
                        </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-8 text-left">
                        <p className="text-purple-800 text-sm font-medium mb-1 flex items-center gap-2">
                            <Icon name="info" size={16} /> Como funciona:
                        </p>
                        <ul className="text-xs text-purple-600 space-y-1 list-disc list-inside">
                            <li>Seleciona até <b>10 palavras</b> aleatórias.</li>
                            <li>Prioriza palavras que você <b>errou recentemente</b>.</li>
                            <li>Cria uma história curta e única.</li>
                        </ul>
                    </div>

                    <button 
                        onClick={generateStory} 
                        disabled={loading}
                        className="w-full bg-purple-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>Criando em {targetLang === 'zh' ? 'Mandarim' : 'Alemão'}...</>
                        ) : (
                            'Gerar História'
                        )}
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-slate-100 animate-pop">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider">
                            História em {targetLang === 'zh' ? 'Mandarim' : 'Alemão'}
                        </h3>
                        <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded font-bold">Gerada por IA</span>
                    </div>
                    
                    <p className={`text-2xl ${targetLang === 'de' ? 'font-sans' : 'font-chinese'} text-slate-800 leading-loose mb-4`}>
                        {generatedItem.chinese}
                    </p>
                    <p className="text-slate-500 italic mb-6 border-l-2 border-purple-200 pl-3">
                        {generatedItem.translation}
                    </p>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setGeneratedItem(null)}
                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Descartar
                        </button>
                        <button 
                            onClick={() => { onSave(generatedItem); setGeneratedItem(null); alert("Salvo na biblioteca!"); }}
                            className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md transition-colors"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreativeView;