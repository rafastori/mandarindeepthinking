import React, { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon';
import { UserComment } from '../../services/localDB';

interface CommentDialogProps {
    target: { type: 'word' | 'sentence'; key: string; preview: string };
    existing: UserComment[];
    onClose: () => void;
    onAdd: (text: string) => Promise<UserComment>;
    onUpdate: (id: string, text: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const CommentDialog: React.FC<CommentDialogProps> = ({ target, existing, onClose, onAdd, onUpdate, onDelete }) => {
    const [draft, setDraft] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = async () => {
        if (!draft.trim()) return;
        await onAdd(draft);
        setDraft('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="message-circle" size={20} className="text-amber-500" />
                        Comentário
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <Icon name="x" size={20} />
                    </button>
                </div>

                <div className="mb-3 p-2 bg-slate-50 rounded-lg text-sm text-slate-600 border-l-2 border-amber-400">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-2">
                        {target.type === 'word' ? 'palavra' : 'frase'}
                    </span>
                    <span className="font-medium text-slate-700">{target.preview}</span>
                </div>

                {existing.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                        {existing.map(c => (
                            <div key={c.id} className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-sm">
                                {editingId === c.id ? (
                                    <>
                                        <textarea
                                            value={editingText}
                                            onChange={(e) => setEditingText(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-sm"
                                            rows={2}
                                        />
                                        <div className="flex gap-2 mt-1.5 text-xs">
                                            <button onClick={async () => { await onUpdate(c.id, editingText); setEditingId(null); }} className="text-emerald-700 font-medium">Salvar</button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-500">Cancelar</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-700 whitespace-pre-wrap">{c.text}</p>
                                        <div className="flex gap-3 mt-1.5 text-[11px] text-slate-400">
                                            <span>{new Date(c.updatedAt).toLocaleString('pt-BR')}</span>
                                            <button onClick={() => { setEditingId(c.id); setEditingText(c.text); }} className="hover:text-blue-600">Editar</button>
                                            <button onClick={() => onDelete(c.id)} className="hover:text-rose-600">Excluir</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={existing.length > 0 ? 'Adicionar outro comentário…' : 'Escreva seu comentário…'}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    rows={3}
                />

                <div className="flex justify-end gap-2 mt-3">
                    <button onClick={onClose} className="px-3 py-1.5 text-slate-500 text-sm">Fechar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={!draft.trim()}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommentDialog;
