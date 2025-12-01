
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
    const [mode, setMode] = useState<'direct' | 'translate'>('direct');
    const [targetLanguage, setTargetLanguage] = useState<'zh' | 'de'>('zh');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImport = async () => {
        if (!text.trim()) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const items = await processTextWithGemini(text, mode, targetLanguage);
            onImport(items);
            onClose();
        } catch (err: any) {
            console.error(err);
            if (err.message && err.message.includes("BACKEND_NOT_FOUND")) {
                setError("Erro de conexão: Backend não encontrado.");
            } else if (err.message === "API_KEY_MISSING") {
                setError("Chave de API necessária.");
            } else {
                setError("Falha ao processar texto.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-pop">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="file-plus" size={20} className="text-brand-600"/> Importar Texto
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                        <Icon name="x" size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    
                    {/* Language Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                         <button 
                            onClick={() => setTargetLanguage('zh')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${targetLanguage === 'zh' ? 'bg-white text-brand-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <span className="font-chinese text-base mr-1">中</span> Mandarim
                        </button>
                        <button 
                            onClick={() => setTargetLanguage('de')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${targetLanguage === 'de' ? 'bg-white text-brand-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <span className="text-base mr-1">DE</span> Alemão
                        </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        <button 
                            onClick={() => setMode('direct')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'direct' ? 'bg-white text-brand-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <Icon name="pen-tool" size={16} /> Texto Original
                        </button>
                        <button 
                            onClick={() => setMode('translate')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'translate' ? 'bg-white text-brand-700 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <Icon name="languages" size={16} /> Traduzir (PT)
                        </button>
                    </div>

                    <p className="text-sm text-slate-500 mb-4 min-h-[40px]">
                        {mode === 'direct' 
                            ? `Cole um texto já em ${targetLanguage === 'zh' ? 'Mandarim' : 'Alemão'}. A IA irá estruturar para estudo.`
                            : `Cole um texto em Português. A IA traduzirá para ${targetLanguage === 'zh' ? 'Mandarim' : 'Alemão'} e criará a lição.`}
                    </p>
                    
                    <textarea 
                        className="w-full h-48 p-4 rounded-xl border-2 border-slate-200 focus:border-brand-500 focus:ring-0 outline-none resize-none text-lg text-slate-700 bg-slate-50 transition-colors placeholder:text-slate-300"
                        placeholder={mode === 'direct' ? `Cole seu texto em ${targetLanguage === 'zh' ? 'chinês' : 'alemão'} aqui...` : "Digite em português aqui..."}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={isLoading}
                        style={{ fontFamily: (targetLanguage === 'zh' && mode === 'direct') ? "'Noto Sans SC', sans-serif" : "'Inter', sans-serif" }}
                    />

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                            <Icon name="alert-circle" size={16} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <button 
                        onClick={handleImport}
                        disabled={isLoading || !text.trim()}
                        className={`w-full py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all ${isLoading || !text.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 active:scale-95 shadow-brand-200'}`}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Processando...
                            </>
                        ) : (
                            <>
                                <Icon name="wand-2" size={18} />
                                {mode === 'translate' ? 'Traduzir e Criar' : 'Processar Texto'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
