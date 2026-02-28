import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../Icon';
import { repositoryService, RepositoryNode } from '../../services/repositoryService';
import { StudyItem, STUDY_LANGUAGES } from '../../types';

interface RepositoryModalProps {
    onClose: () => void;
    onImportSuccess: (items: StudyItem[], folderPath: string) => void;
}

export const RepositoryModal: React.FC<RepositoryModalProps> = ({ onClose, onImportSuccess }) => {
    const [tree, setTree] = useState<RepositoryNode[]>([]);
    const [currentPath, setCurrentPath] = useState<RepositoryNode[]>([]);
    const [selectedFile, setSelectedFile] = useState<RepositoryNode | null>(null);
    const [rawText, setRawText] = useState<string>('');
    const [loadingText, setLoadingText] = useState(false);

    // Import flow states
    const [showImportForm, setShowImportForm] = useState(false);
    const [targetFolder, setTargetFolder] = useState('');
    const [loadingImport, setLoadingImport] = useState(false);

    // Auto Sync States
    const [syncStatus, setSyncStatus] = useState<string | null>(null);

    useEffect(() => {
        try {
            const root = repositoryService.getRepositoryTree();
            setTree(root);

            if (import.meta.env.DEV) {
                setSyncStatus("Verificando...");
                repositoryService.runFullAutoSync((msg) => {
                    setSyncStatus(msg);
                    if (msg === "Sincronização concluída" || msg === "Repositório OK") {
                        setTimeout(() => setSyncStatus(null), 3500);
                        // Refresh tree
                        setTree(repositoryService.getRepositoryTree());
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao carregar repositório:", error);
        }
    }, []);

    const currentDirectory = useMemo(() => {
        if (currentPath.length === 0) return tree;
        const lastNode = currentPath[currentPath.length - 1];
        return lastNode.children || [];
    }, [tree, currentPath]);

    const handleNodeClick = async (node: RepositoryNode) => {
        if (node.type === 'folder') {
            setCurrentPath([...currentPath, node]);
            setSelectedFile(null);
            setShowImportForm(false);
        } else {
            setSelectedFile(node);
            setShowImportForm(false);
            if (node.txtKey) {
                setLoadingText(true);
                try {
                    const text = await repositoryService.getRawText(node.txtKey);
                    setRawText(text);
                } catch (error) {
                    console.error("Erro ao ler txt", error);
                    setRawText("Erro ao carregar pré-visualização do texto.");
                } finally {
                    setLoadingText(false);
                }
            }
        }
    };

    const handleBack = () => {
        setCurrentPath(currentPath.slice(0, -1));
        setSelectedFile(null);
        setShowImportForm(false);
    };

    const handleConfirmImport = async () => {
        if (!selectedFile || !selectedFile.jsonKey) return;

        if (!targetFolder.trim()) {
            alert('Por favor, defina uma pasta de destino para a importação.');
            return;
        }

        setLoadingImport(true);
        try {
            const data = await repositoryService.getJsonData(selectedFile.jsonKey);
            let items = data.items || data;

            if (!Array.isArray(items)) {
                throw new Error("Formato JSON inválido. Esperado um array de itens.");
            }

            const langObj = STUDY_LANGUAGES.find(l => l.name === selectedFile.language);
            const targetLangCode = langObj ? langObj.code : 'zh';

            items = items.map((item: any) => ({
                ...item,
                language: targetLangCode
            }));

            // Sucesso! Passa pro callback
            onImportSuccess(items, targetFolder.trim());
            onClose();
        } catch (error: any) {
            console.error('Erro na importação', error);
            alert(error.message || 'Erro ao importar texto do repositório.');
        } finally {
            setLoadingImport(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-50 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* EXPLORER PANE */}
                <div className={`${selectedFile ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 bg-white border-r border-slate-200 flex-col h-full`}>
                    {/* Header */}
                    <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <Icon name="library" size={20} className="text-brand-600" />
                            Repositório
                        </h2>
                        {/* Close button on mobile only */}
                        <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                            <Icon name="x" size={20} />
                        </button>
                    </div>

                    {/* Navigation Bar (Breadcrumbs) */}
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-sm shrink-0 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => {
                                setCurrentPath([]);
                                setSelectedFile(null);
                                setShowImportForm(false);
                            }}
                            className={`flex items-center gap-1 shrink-0 ${currentPath.length === 0 ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Icon name="home" size={14} /> Raiz
                        </button>

                        {currentPath.map((node, index) => (
                            <React.Fragment key={index}>
                                <Icon name="chevron-right" size={14} className="text-slate-300 shrink-0" />
                                <button
                                    onClick={() => {
                                        setCurrentPath(currentPath.slice(0, index + 1));
                                        setSelectedFile(null);
                                        setShowImportForm(false);
                                    }}
                                    className={`shrink-0 truncate max-w-[100px] ${index === currentPath.length - 1 ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {node.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Dev Mode Sync Banner */}
                    {syncStatus && (
                        <div className="bg-amber-100 text-amber-800 text-xs py-2 px-4 border-b border-amber-200 flex items-center justify-between shrink-0 font-medium">
                            <span className="flex items-center gap-2">
                                <Icon name="refresh-cw" size={14} className="animate-spin" />
                                {syncStatus}
                            </span>
                        </div>
                    )}

                    {/* File List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {currentPath.length > 0 && (
                            <button
                                onClick={handleBack}
                                className="w-full text-left px-3 py-3 mb-1 text-sm text-slate-500 hover:bg-slate-100 rounded-xl flex items-center gap-3 transition-colors"
                            >
                                <Icon name="corner-left-up" size={18} />
                                Voltar
                            </button>
                        )}

                        {currentDirectory.length === 0 && (
                            <div className="p-4 text-center text-slate-400 text-sm mt-10">
                                Pasta vazia.
                            </div>
                        )}

                        {currentDirectory.map((node, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleNodeClick(node)}
                                className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all mb-1
                                    ${selectedFile?.name === node.name
                                        ? 'bg-brand-100 text-brand-800 font-medium'
                                        : 'hover:bg-slate-100 text-slate-700'
                                    }`}
                            >
                                {node.type === 'folder' ? (
                                    <Icon name="folder" size={20} className="text-brand-500 shrink-0" />
                                ) : (
                                    <Icon name="file-text" size={20} className="text-slate-400 shrink-0" />
                                )}
                                <span className="truncate">{node.name.replace('.txt', '')}</span>
                                {node.type === 'folder' && <Icon name="chevron-right" size={16} className="ml-auto text-slate-300 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PREVIEW/IMPORT PANE */}
                <div className={`${!selectedFile ? 'hidden md:flex' : 'flex'} w-full md:w-2/3 bg-slate-50 flex-col h-full relative`}>
                    {/* Mobile Header */}
                    {selectedFile && (
                        <div className="md:hidden px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
                            <button
                                onClick={() => { setSelectedFile(null); setShowImportForm(false); }}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium text-sm"
                            >
                                <Icon name="arrow-left" size={18} />
                                Voltar para Pastas
                            </button>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                    )}

                    {/* Desktop Close Button */}
                    <button onClick={onClose} className="hidden md:flex absolute top-4 right-4 z-10 p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                        <Icon name="x" size={20} />
                    </button>

                    {!selectedFile ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Icon name="book-open" size={32} className="text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-500">Selecione um texto para visualizar</p>
                            <p className="text-sm mt-2 max-w-sm">Navegue pelas pastas à esquerda para encontrar textos prontos para importar para a sua biblioteca.</p>
                        </div>
                    ) : (
                        <>
                            {/* Preview Header */}
                            <div className="px-8 pt-8 pb-4 shrink-0 pr-16">
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                                    {selectedFile.name.replace('.txt', '')}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                    <span className="flex items-center gap-1 bg-slate-200 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                                        <Icon name="globe" size={12} />
                                        {selectedFile.language}
                                    </span>
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="flex-1 overflow-y-auto px-8 pb-8 relative">
                                {loadingText ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-h-full">
                                        <div className="prose prose-slate max-w-none space-y-4">
                                            {rawText.split('\n').map((line, i) => (
                                                <p key={i} className="text-slate-700 leading-relaxed text-lg font-serif">
                                                    {line || <br />}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Import Form / Actions Bottom Bar */}
                            <div className="shrink-0 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                                {!showImportForm ? (
                                    <div className="flex justify-between items-center px-4">
                                        <p className="text-sm text-slate-500">
                                            Gostou deste texto?
                                        </p>
                                        <button
                                            onClick={() => {
                                                setTargetFolder(selectedFile.name.replace('.txt', '')); // pre-fill suggestion
                                                setShowImportForm(true);
                                            }}
                                            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-200 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Icon name="download" size={20} />
                                            Importar Texto
                                        </button>
                                    </div>
                                ) : (
                                    <div className="animate-in slide-in-from-bottom-4">
                                        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                            <Icon name="settings-2" size={18} className="text-brand-500" />
                                            Configurações de Importação
                                        </h4>
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                                    Salvar na Pasta (Obrigatório)
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Icon name="folder" size={16} className="text-slate-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={targetFolder}
                                                        onChange={(e) => setTargetFolder(e.target.value)}
                                                        placeholder="Ex: Alemão Pessoal / Texto 1"
                                                        className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-700"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-end gap-2 shrink-0 pt-4 md:pt-0">
                                                <button
                                                    onClick={() => setShowImportForm(false)}
                                                    className="px-4 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                                                    disabled={loadingImport}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleConfirmImport}
                                                    disabled={loadingImport || !targetFolder.trim()}
                                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                                                >
                                                    {loadingImport ? (
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    ) : (
                                                        <Icon name="check" size={20} />
                                                    )}
                                                    {loadingImport ? 'Importando...' : 'Confirmar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RepositoryModal;
