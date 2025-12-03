import React, { useState } from 'react';
import Icon from './Icon';
import { processTextWithGemini } from '../services/gemini';
import { StudyItem } from '../types';

interface ImportModalProps {
    onClose: () => void;
    onImport: (items: StudyItem[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [language, setLanguage] = useState<'zh' | 'de'>('zh'); 
    const [mode, setMode] = useState<'direct' | 'translate'>('direct');

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
                    
                    {/* 1. Seleção de Língua */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">1. Escolha a Língua</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setLanguage('zh')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    language === 'zh' 
                                    ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                    : 'border-slate-100 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-xl">🇨🇳</span>
                                <span className="font-bold">Mandarim</span>
                            </button>
                            <button 
                                onClick={() => setLanguage('de')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    language === 'de' 
                                    ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                    : 'border-slate-100 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                <span className="text-xl">🇩🇪</span>
                                <span className="font-bold">Alemão</span>
                            </button>
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
                            {/* CORREÇÃO AQUI: Troquei '->' por '→' */}
                            ✨ Traduzir (PT → {language === 'zh' ? 'ZH' : 'DE'})
                        </button>
                    </div>

                    {/* 3. Área de Texto */}
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Cole aqui seu texto em ${language === 'zh' ? 'Mandarim' : 'Alemão'}...`}
                        className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all resize-none text-slate-700 placeholder:text-slate-300 leading-relaxed"
                    />
                    
                    <div className="mt-2 flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded-lg">
                        <Icon name="info" size={14} className="mt-0.5 flex-shrink-0" />
                        <p>A IA vai segmentar o texto automaticamente.</p>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button 
                        onClick={handleProcess}
                        disabled={loading || !text.trim()}
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