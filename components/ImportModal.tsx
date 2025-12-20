import React, { useState } from 'react';
import Icon from './Icon';
import { processTextWithGemini, generateRawText } from '../services/gemini';
import { StudyItem, SupportedLanguage, STUDY_LANGUAGES } from '../types';
import 'flag-icons/css/flag-icons.min.css';

interface ImportModalProps {
    onClose: () => void;
    onImport: (items: StudyItem[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
    const [text, setText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [language, setLanguage] = useState<SupportedLanguage>('zh');
    const [mode, setMode] = useState<'direct' | 'translate'>('direct');

    // Encontrar nome do idioma selecionado
    const selectedLangName = STUDY_LANGUAGES.find(l => l.code === language)?.name || language.toUpperCase();

    const handleGenerateText = async () => {
        setGenerating(true);
        try {
            const generatedText = await generateRawText(language, aiPrompt);
            setText(generatedText);
        } catch (error) {
            console.error(error);
            alert("Falha ao gerar texto. Tente novamente.");
        } finally {
            setGenerating(false);
        }
    };

    const handleProcess = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const results = await processTextWithGemini(text, mode, language);
            onImport(results);
            onClose();
        } catch (error) {
            console.error(error);
            alert("Falha ao processar texto. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Icon name="plus" size={20} className="text-brand-600" />
                        Importar Texto
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <Icon name="x" size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">

                    {/* 1. Seleção de Língua - Grid dinâmico */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">1. Escolha a Língua</label>
                        <div className="grid grid-cols-4 gap-2">
                            {STUDY_LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => setLanguage(lang.code)}
                                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all ${language === lang.code
                                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                                        : 'border-slate-100 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    <span className={`fi fi-${lang.isoCode} text-2xl rounded-sm`}></span>
                                    <span className="font-medium text-xs">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Modo de Tradução */}
                    <div className="mb-4 flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setMode('direct')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'direct' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                        >
                            Texto Original
                        </button>
                        <button
                            onClick={() => setMode('translate')}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'translate' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                        >
                            ✨ Traduzir (PT → {selectedLangName})
                        </button>
                    </div>

                    {/* 3. Área de Texto */}
                    <div className="relative">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={`Cole aqui seu texto em ${selectedLangName}...`}
                            className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all resize-none text-slate-700 placeholder:text-slate-300 leading-relaxed"
                        />
                    </div>

                    {/* 4. Campo de prompt para IA personalizada */}
                    <div className="mt-3">
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Insira um contexto para a IA"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all text-slate-700 placeholder:text-slate-400 text-sm"
                        />
                    </div>

                    {/* 5. Dica + Botão Gerar com IA */}
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded-lg">
                            <Icon name="info" size={14} className="mt-0.5 flex-shrink-0" />
                            <p>Cole um texto ou use o botão mágico ✨ para gerar automaticamente.</p>
                        </div>
                        <button
                            onClick={handleGenerateText}
                            disabled={generating || loading}
                            title={`Gerar texto em ${selectedLangName} com IA`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg font-medium text-sm whitespace-nowrap"
                        >
                            {generating ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Icon name="wand-2" size={18} />
                                    <span className="hidden sm:inline">Gerar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={handleProcess}
                        disabled={loading || generating || !text.trim()}
                        className="w-full bg-brand-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Icon name="sparkles" size={20} />
                                Processar Texto
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;