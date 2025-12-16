import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import { SUPPORTED_LANGUAGES, GAME_CONSTANTS } from '../types';
import { validateText } from '../utils';

interface CreateRoomModalProps {
    onClose: () => void;
    onCreate: (roomName: string, sourceLang: string, targetLang: string, text: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate }) => {
    const [roomName, setRoomName] = useState('');
    const [sourceLang, setSourceLang] = useState('de');
    const [targetLang, setTargetLang] = useState('pt');
    const [text, setText] = useState('');

    const validation = validateText(text, GAME_CONSTANTS.MIN_WORDS);
    const canCreate = roomName.trim().length > 0 && validation.valid;

    const handleCreate = () => {
        if (canCreate) {
            onCreate(roomName.trim(), sourceLang, targetLang, text);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-2xl">
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                        />
                    </div>

                    {/* Idiomas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Idioma de Origem *
                            </label>
                            <select
                                value={sourceLang}
                                onChange={(e) => setSourceLang(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Idioma do texto original</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Idioma de Destino *
                            </label>
                            <select
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1">Idioma para traduzir</p>
                        </div>
                    </div>

                    {/* Texto Base */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700">
                                Texto Base *
                            </label>
                            <span className={`text-xs font-semibold ${validation.valid ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                {validation.wordCount} / {GAME_CONSTANTS.MIN_WORDS} palavras
                            </span>
                        </div>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={8}
                            placeholder={`Cole aqui um texto em ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name || sourceLang}...\n\nMínimo de ${GAME_CONSTANTS.MIN_WORDS} palavras.`}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono text-sm"
                        />
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

                    {/* Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <Icon name="info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-700">
                                <p className="font-semibold mb-1">Dica:</p>
                                <p>Escolha um texto interessante e adequado ao nível dos jogadores. Textos de notícias, histórias curtas ou artigos funcionam bem!</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 rounded-b-2xl flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <Icon name="plus" size={20} />
                        <span>Criar Sala</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
