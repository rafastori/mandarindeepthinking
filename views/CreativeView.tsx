import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Stats, STUDY_LANGUAGES, SupportedLanguage } from '../types';
import { processTextWithGemini } from '../services/gemini';

interface CreativeViewProps {
    data: StudyItem[];
    savedIds: string[];
    stats: Stats;
    onSave: (item: StudyItem) => void;
}

const CreativeView: React.FC<CreativeViewProps> = ({ data, savedIds, stats, onSave }) => {
    const [generatedItem, setGeneratedItem] = useState<StudyItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [targetLang, setTargetLang] = useState<SupportedLanguage>('zh');

    const activeLanguage = useMemo(() =>
        STUDY_LANGUAGES.find(l => l.code === targetLang) || STUDY_LANGUAGES.find(l => l.code === 'zh')!
        , [targetLang]);

    // 1. Coleta todo o vocabulário salvo
    const allVocabulary = useMemo(() => {
        let words: { text: string, lang: string }[] = [];
        data.forEach(item => {
            if (savedIds.includes(item.id.toString())) {
                words.push({ text: item.chinese, lang: item.language || 'zh' });
            }
            if (item.keywords) {
                item.keywords.forEach(k => {
                    if (savedIds.includes(k.id)) {
                        words.push({ text: k.word, lang: item.language || 'zh' });
                    }
                });
            }
        });
        return words.filter((v, i, a) => a.findIndex(t => (t.text === v.text)) === i);
    }, [data, savedIds]);

    // 2. Filtra palavras da língua selecionada
    const langVocabulary = useMemo(() => {
        return allVocabulary.filter(w => w.lang === targetLang).map(w => w.text);
    }, [allVocabulary, targetLang]);

    const generateStory = async () => {
        if (langVocabulary.length < 3) return;
        setLoading(true);

        const recentErrors = stats.history
            .filter(h => h.type === 'general')
            .map(h => h.word);

        const priorityWords = langVocabulary.filter(w => recentErrors.includes(w));
        const otherWords = langVocabulary.filter(w => !recentErrors.includes(w));
        const shuffledOthers = otherWords.sort(() => 0.5 - Math.random());
        const selectedWords = [...priorityWords, ...shuffledOthers].slice(0, 10);

        try {
            const storyPrompt = `Crie uma história curta, criativa e coerente (máximo 3 frases) em ${activeLanguage.name} usando estas palavras específicas: ${selectedWords.join(', ')}.`;

            // Import the correct service function
            const { generateRawText, processTextWithGemini } = await import('../services/gemini');

            // generateRawText returns a string (the generated story)
            const storyText = await generateRawText(targetLang, storyPrompt);

            if (storyText) {
                // Now we use processTextWithGemini but only for analysis of the story we just created
                // This ensures we get pinyin, translation, and tokens correctly formatted as a StudyItem
                const analysisResult = await processTextWithGemini(storyText, 'direct', targetLang);

                if (analysisResult && analysisResult.length > 0) {
                    setGeneratedItem(analysisResult[0]);
                }
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
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
                <EmptyState msg="Modo Criativo" icon="sparkles" />
                <p className="text-slate-400 text-sm mt-2 mb-6 max-w-xs">
                    Salve pelo menos 3 palavras em
                    <span className="font-bold text-slate-600"> {activeLanguage.name} </span>
                    para criar histórias.
                </p>

                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {STUDY_LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => setTargetLang(lang.code)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${targetLang === lang.code ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300'}`}
                        >
                            {lang.flag} {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 min-h-full flex flex-col items-center justify-center pb-24">
            {!generatedItem ? (
                <div className="text-center w-full max-w-lg">
                    <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon name="sparkles" size={40} className="text-purple-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Histórias com IA</h2>
                    <p className="text-slate-500 text-sm mb-6">Escolha o idioma para criar sua próxima aventura:</p>

                    <div className="flex flex-wrap justify-center gap-2 mb-8 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        {STUDY_LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => setTargetLang(lang.code)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${targetLang === lang.code ? 'bg-white text-purple-700 border-purple-100 shadow-sm' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                <span className="text-lg">{lang.flag}</span>
                                {lang.name}
                            </button>
                        ))}
                    </div>

                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-8 text-left max-w-md mx-auto">
                        <p className="text-purple-800 text-sm font-medium mb-2 flex items-center gap-2">
                            <Icon name="info" size={16} /> Como funciona:
                        </p>
                        <ul className="text-xs text-purple-600 space-y-2 list-disc list-inside">
                            <li>Seleciona até <b>10 palavras</b> que você já salvou.</li>
                            <li>Prioriza palavras que você <b>errou recentemente</b>.</li>
                            <li>A IA escreve uma história curta usando esse vocabulário.</li>
                        </ul>
                    </div>

                    <button
                        onClick={generateStory}
                        disabled={loading}
                        className="w-full max-w-sm bg-purple-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>Criando em {activeLanguage.name}...</>
                        ) : (
                            `Gerar História em ${activeLanguage.name}`
                        )}
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-slate-100 animate-pop">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider">
                            História em {activeLanguage.name}
                        </h3>
                        <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-1 rounded font-bold">Gerada por IA</span>
                    </div>

                    <p className={`text-2xl ${['zh', 'ja', 'ko'].includes(targetLang) ? 'font-chinese' : 'font-sans'} text-slate-800 leading-loose mb-4`}>
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
