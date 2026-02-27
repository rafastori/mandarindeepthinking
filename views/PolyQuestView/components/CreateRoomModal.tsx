import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import FlagSelect from '../../../components/FlagSelect';
import { SUPPORTED_LANGUAGES, GAME_CONSTANTS } from '../types';
import { validateText } from '../utils';
import { generateRawText } from '../../../services/gemini';
import { GameContentSelectorModal } from '../../DominoView/components/GameContentSelectorModal';
import { useStudyItems } from '../../../hooks/useStudyItems';

interface CreateRoomModalProps {
    onClose: () => void;
    onCreate: (roomName: string, sourceLang: string, targetLang: string, text: string, tokens: string[], difficulty: string, context?: string, selectedFolderIds?: string[]) => void;
    currentUserId: string;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate, currentUserId }) => {
    const [roomName, setRoomName] = useState('');
    const [sourceLang, setSourceLang] = useState('de');
    const [targetLang, setTargetLang] = useState('pt');
    const [text, setText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [difficulty, setDifficulty] = useState('Iniciante');
    const [generating, setGenerating] = useState(false);
    const [context, setContext] = useState<'gemini' | 'library'>('library');
    const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

    const { items: libraryItems } = useStudyItems(currentUserId);

    // Merge all text segments from selected folders into one complete lesson
    React.useEffect(() => {
        if (context === 'library') {
            if (selectedFolderIds.length === 0) {
                setText('');
                return;
            }

            const inFolder = (itemPath?: string) => {
                return selectedFolderIds.some(filterPath => {
                    if (filterPath === '__uncategorized__' && !itemPath) return true;
                    return itemPath === filterPath || itemPath?.startsWith(filterPath + '/');
                });
            };
            const matchingItems = libraryItems.filter(i => inFolder(i.folderPath));

            // Merge all text segments (full lessons) from the folders
            const textItems = matchingItems.filter(i => i.type === 'text' || (!i.type && (i.tokens?.length || 0) > 4));

            if (textItems.length > 0) {
                const mergedText = textItems.map(t => t.chinese).join('\n\n');
                setText(mergedText);
            } else {
                // Fallback: sentences or words
                const wordsWithSentences = matchingItems.filter(i => i.originalSentence);
                if (wordsWithSentences.length > 0) {
                    const merged = Array.from(new Set(wordsWithSentences.map(w => w.originalSentence))).join(' ');
                    setText(merged);
                } else {
                    setText(matchingItems.map(i => i.chinese).join(' '));
                }
            }
        }
    }, [context, selectedFolderIds, libraryItems]);

    const validation = validateText(text, GAME_CONSTANTS.MIN_WORDS);
    const canCreate = roomName.trim().length > 0 && (
        context === 'library'
            ? selectedFolderIds.length > 0 && text.length > 0
            : validation.valid
    );

    const handleCreate = async () => {
        if (!canCreate) return;
        onCreate(roomName.trim(), sourceLang, targetLang, text, [], difficulty, context, selectedFolderIds);
        onClose();
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

                    {/* Dificuldade */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Nível de Dificuldade *
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'Iniciante', label: 'Iniciante', emoji: '🌱' },
                                { id: 'Intermediário', label: 'Intermed.', emoji: '📚' },
                                { id: 'Avançado', label: 'Avançado', emoji: '🎓' }
                            ].map((level) => (
                                <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => setDifficulty(level.id)}
                                    className={`flex-1 min-w-[90px] px-3 py-2.5 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-1.5 ${difficulty === level.id
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    <span>{level.emoji}</span>
                                    <span>{level.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Context Toggle: IA vs Biblioteca */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Fonte do Texto
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                            <button
                                onClick={() => { setContext('library'); setText(''); }}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${context === 'library' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Icon name="book" size={14} /> Minha Biblioteca
                            </button>
                            <button
                                onClick={() => { setContext('gemini'); setText(''); }}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${context === 'gemini' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Texto Base (IA)
                            </button>
                        </div>

                        {context === 'library' ? (
                            <div className="space-y-4">
                                {/* Folder selector */}
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                    <label className="text-xs font-bold text-purple-600 uppercase mb-2 flex items-center gap-1">
                                        <Icon name="folder" size={14} /> Minhas Pastas
                                    </label>
                                    <button
                                        onClick={() => setIsFolderModalOpen(true)}
                                        className="w-full bg-white border-2 border-purple-200 text-purple-700 font-bold py-3 rounded-xl flex items-center justify-between px-4 transition-colors hover:border-purple-400"
                                    >
                                        <span className="truncate">
                                            {selectedFolderIds.length > 0
                                                ? `${selectedFolderIds.length} pasta(s) selecionada(s)`
                                                : 'Escolher Pastas de Estudo...'}
                                        </span>
                                        <Icon name="chevron-right" size={20} />
                                    </button>
                                </div>

                                {/* Text preview */}
                                {text && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-slate-700">
                                                Prévia da Aula
                                            </label>
                                            <span className="text-xs font-semibold text-emerald-600">
                                                {text.split(/\s+/).filter(Boolean).length} palavras
                                            </span>
                                        </div>
                                        <textarea
                                            value={text}
                                            readOnly
                                            rows={4}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 resize-none cursor-default text-sm"
                                        />
                                    </div>
                                )}

                                {selectedFolderIds.length > 0 && !text && (
                                    <p className="text-xs text-amber-600 text-center">
                                        <Icon name="alert-circle" size={14} className="inline mr-1" />
                                        Nenhum conteúdo encontrado nesta pasta.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Texto Base */}
                                <div>
                                    <div className="relative">
                                        <textarea
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            rows={6}
                                            disabled={generating}
                                            placeholder={`Cole aqui um texto em ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name || sourceLang}...\n\nSugerido mais de 30 palavras!`}
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm disabled:opacity-50 transition-all"
                                        />
                                        <span className={`absolute bottom-3 right-3 text-xs font-semibold ${validation.valid ? 'text-emerald-600' : 'text-slate-400'}`}>
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
                                <div className="mt-4">
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Insira um contexto para a IA"
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-700 placeholder:text-slate-400 text-sm"
                                    />
                                </div>

                                {/* Dica + Botão Gerar com IA */}
                                <div className="flex items-center gap-3 mt-4">
                                    <div className="flex-1 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                                        <Icon name="info" size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                                        <p>Cole um texto ou use o botão mágico ✨ para gerar automaticamente.</p>
                                    </div>
                                    <button
                                        onClick={handleGenerateText}
                                        disabled={generating}
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
                            </>
                        )}
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
                        disabled={!canCreate || generating}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                    >
                        <Icon name="plus" size={20} />
                        <span>Criar Sala</span>
                    </button>
                </div>
            </div>

            {/* Modal de Pastas */}
            <GameContentSelectorModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                currentUserId={currentUserId}
                initialSelectedPaths={selectedFolderIds}
                onConfirmSelection={(paths) => setSelectedFolderIds(paths)}
            />
        </div>
    );
};
