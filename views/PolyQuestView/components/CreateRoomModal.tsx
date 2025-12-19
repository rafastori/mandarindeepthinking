import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import FlagSelect from '../../../components/FlagSelect';
import { SUPPORTED_LANGUAGES, GAME_CONSTANTS } from '../types';
import { validateText } from '../utils';
import { generateRawText, tokenizeTextWithAI } from '../../../services/gemini';

interface CreateRoomModalProps {
    onClose: () => void;
    onCreate: (roomName: string, sourceLang: string, targetLang: string, text: string, tokens: string[]) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate }) => {
    const [roomName, setRoomName] = useState('');
    const [sourceLang, setSourceLang] = useState('de');
    const [targetLang, setTargetLang] = useState('pt');
    const [text, setText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [tokenizing, setTokenizing] = useState(false);

    const validation = validateText(text, GAME_CONSTANTS.MIN_WORDS);
    const canCreate = roomName.trim().length > 0 && validation.valid;

    const handleCreate = async () => {
        if (!canCreate) return;

        setTokenizing(true);
        try {
            // Tokenizar texto com IA antes de criar sala
            const tokens = await tokenizeTextWithAI(text, sourceLang);
            onCreate(roomName.trim(), sourceLang, targetLang, text, tokens);
            onClose();
        } catch (error) {
            console.error("Failed to tokenize text:", error);
            alert("Erro ao processar texto. Tente novamente.");
        } finally {
            setTokenizing(false);
        }
    };

    const handleGenerateText = async () => {
        setGenerating(true);
        try {
            const aiText = await generateRawText(sourceLang, aiPrompt);
            setText(aiText);
        } catch (error) {
            console.error("Failed to generate text:", error);
            alert("Erro ao gerar texto com IA. Tente novamente.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-2xl z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-slate-800">Criar Nova Sala</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Icon name="x" size={24} className="text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Nome da Sala */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Nome da Sala *
                        </label>
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="Ex: Sala de Alemão - Iniciantes"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Idiomas com FlagSelect */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FlagSelect
                                options={SUPPORTED_LANGUAGES}
                                value={sourceLang}
                                onChange={setSourceLang}
                                label="Idioma estudado *"
                            />
                            <p className="text-xs text-slate-500 mt-1">Idioma do texto original</p>
                        </div>

                        <div>
                            <FlagSelect
                                options={SUPPORTED_LANGUAGES}
                                value={targetLang}
                                onChange={setTargetLang}
                                label="Idioma nativo *"
                            />
                            <p className="text-xs text-slate-500 mt-1">Idioma para traduzir</p>
                        </div>
                    </div>

                    {/* Texto Base */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700">
                                Texto Base *
                            </label>
                        </div>
                        <div className="relative">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                rows={6}
                                disabled={generating}
                                placeholder={`Cole aqui um texto em ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name || sourceLang}...\n\nSugerido mais de 30 palavras!`}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm disabled:opacity-50 transition-all"
                            />
                            <span className={`absolute bottom-3 right-3 text-xs font-semibold ${validation.valid ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                {validation.wordCount} palavras
                            </span>
                        </div>
                        {!validation.valid && validation.error && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <Icon name="alert-circle" size={14} />
                                {validation.error}
                            </p>
                        )}
                        {validation.valid && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                <Icon name="check-circle" size={14} />
                                Texto válido!
                            </p>
                        )}
                    </div>

                    {/* Campo de prompt para IA */}
                    <div>
                        <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Se desejar que a IA gere um texto mais específico descreva aqui"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm"
                        />
                    </div>

                    {/* Dica + Botão Gerar com IA */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                            <Icon name="info" size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                            <p>Cole um texto ou use o botão mágico ✨ para gerar automaticamente.</p>
                        </div>
                        <button
                            onClick={handleGenerateText}
                            disabled={generating || tokenizing}
                            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-semibold text-sm whitespace-nowrap"
                        >
                            {generating ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Icon name="wand-2" size={18} />
                                    <span>Gerar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 rounded-b-2xl flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-slate-700 hover:bg-slate-200 rounded-xl font-semibold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate || generating || tokenizing}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                    >
                        {tokenizing ? (
                            <>
                                <Icon name="loader" size={20} className="animate-spin" />
                                <span>Processando...</span>
                            </>
                        ) : (
                            <>
                                <Icon name="plus" size={20} />
                                <span>Criar Sala</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
