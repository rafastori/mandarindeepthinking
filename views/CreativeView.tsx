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
        const wordsNeeded = 3 - langVocabulary.length;
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6">
                {/* Ícone principal com gradiente e animação */}
                <div className="relative mb-6">
                    <div className="bg-gradient-to-br from-purple-100 to-pink-100 w-28 h-28 rounded-full flex items-center justify-center shadow-lg shadow-purple-200/40">
                        <Icon name="sparkles" size={52} className="text-purple-500" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" style={{ animationDuration: '3s' }} />
                    {/* Badge de progresso */}
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                        {langVocabulary.length}/3
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-slate-800 mb-2">Modo Criativo</h2>

                {/* Mensagem com destaque */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 max-w-sm border border-purple-100">
                    <p className="text-slate-600 text-sm">
                        Salve mais <span className="font-bold text-purple-600">{wordsNeeded} {wordsNeeded === 1 ? 'palavra' : 'palavras'}</span> em
                        <span className="font-bold text-purple-600"> {activeLanguage.name} </span>
                        para desbloquear histórias geradas por IA!
                    </p>
                </div>

                {/* Barra de progresso visual */}
                <div className="w-full max-w-xs mb-6">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progresso</span>
                        <span>{langVocabulary.length} de 3 palavras</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${(langVocabulary.length / 3) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Seletor de idiomas melhorado */}
                <p className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-bold">Selecione o idioma</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-md p-3 bg-slate-50 rounded-2xl">
                    {STUDY_LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => setTargetLang(lang.code)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${targetLang === lang.code ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-md scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}
                        >
                            <span>{lang.flag}</span> {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 min-h-full flex flex-col items-center justify-center pb-24">
            {!generatedItem ? (
                <div className="text-center w-full max-w-lg flex flex-col items-center">
                    {/* Ícone com animação sutil */}
                    <div className="relative bg-gradient-to-br from-purple-100 to-pink-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-200/50">
                        <Icon name="sparkles" size={44} className="text-purple-600" />
                        <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" style={{ animationDuration: '3s' }} />
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Histórias com IA</h2>
                    <p className="text-slate-500 text-sm mb-6">Escolha o idioma para criar sua próxima aventura:</p>

                    {/* Seletor de idiomas melhorado */}
                    <div className="flex flex-wrap justify-center gap-2 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        {STUDY_LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => setTargetLang(lang.code)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${targetLang === lang.code ? 'bg-white text-purple-700 border-purple-200 shadow-sm scale-105' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-white/50'}`}
                            >
                                <span className="text-lg">{lang.flag}</span>
                                {lang.name}
                            </button>
                        ))}
                    </div>

                    {/* Contador de palavras disponíveis */}
                    <div className="mb-6 flex items-center justify-center gap-2 text-sm">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${langVocabulary.length >= 3 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            <Icon name="bookmark" size={14} />
                            {langVocabulary.length} palavras salvas em {activeLanguage.name}
                        </span>
                    </div>

                    {/* Info box */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100 mb-8 text-left max-w-md mx-auto">
                        <p className="text-purple-800 text-sm font-medium mb-2 flex items-center gap-2">
                            <Icon name="info" size={16} /> Como funciona:
                        </p>
                        <ul className="text-xs text-purple-600 space-y-2 list-disc list-inside">
                            <li>Seleciona até <b>10 palavras</b> que você já salvou.</li>
                            <li>Prioriza palavras que você <b>errou recentemente</b>.</li>
                            <li>A IA escreve uma história curta usando esse vocabulário.</li>
                        </ul>
                    </div>

                    {/* Botão de gerar melhorado */}
                    <button
                        onClick={generateStory}
                        disabled={loading}
                        className="w-full max-w-sm mx-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-purple-300/50 hover:shadow-xl hover:shadow-purple-300/60 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="animate-pulse">Criando em {activeLanguage.name}...</span>
                            </>
                        ) : (
                            <>
                                <Icon name="sparkles" size={20} />
                                Gerar História em {activeLanguage.name}
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 fade-in duration-300">
                    {/* Header com gradiente */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                                <Icon name="sparkles" size={16} />
                                História em {activeLanguage.name}
                            </h3>
                            <span className="bg-white/20 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-sm">
                                ✨ IA
                            </span>
                        </div>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-6">
                        <p className={`text-2xl ${['zh', 'ja', 'ko'].includes(targetLang) ? 'font-chinese' : 'font-sans'} text-slate-800 leading-loose mb-4`}>
                            {generatedItem.chinese}
                        </p>
                        <div className="bg-slate-50 rounded-xl p-4 mb-6">
                            <p className="text-sm text-slate-600 italic flex items-start gap-2">
                                <Icon name="message-circle" size={16} className="flex-shrink-0 mt-0.5 text-purple-400" />
                                {generatedItem.translation}
                            </p>
                        </div>

                        {/* Botões melhorados */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setGeneratedItem(null)}
                                className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Icon name="rotate-ccw" size={16} />
                                Nova
                            </button>
                            <button
                                onClick={() => { onSave(generatedItem); setGeneratedItem(null); alert("Salvo na biblioteca!"); }}
                                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Icon name="bookmark" size={16} />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreativeView;
