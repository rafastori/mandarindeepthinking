import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { StudyItem } from '../types';
import { buildFolderTree, FolderNode, countItemsInFolder } from '../services/folderService';

interface FolderTreeProps {
    data: StudyItem[];
    selectedPaths: string[];
    onSelect: (paths: string[]) => void;
    onImportInFolder?: (folderPath: string) => void;
    onRenameFolder?: (oldPath: string, newPath: string) => void;
    onDeleteFolder?: (path: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({
    data,
    selectedPaths,
    onSelect,
    onImportInFolder,
    onRenameFolder,
    onDeleteFolder,
    isOpen,
    onClose
}) => {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    // Qual pasta está com os botões de ação a mostra
    const [activeActionPath, setActiveActionPath] = useState<string | null>(null);

    // Conta itens sem pasta
    const uncategorizedCount = useMemo(() => {
        return data.filter(item => !item.folderPath).length;
    }, [data]);

    // Constrói árvore de pastas
    const folderTree = useMemo(() => buildFolderTree(data), [data]);

    const toggleExpanded = (path: string) => {
        const newExpanded = new Set(expandedPaths);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedPaths(newExpanded);
    };

    // Coleta todos os caminhos descendentes de um nó
    const getAllDescendantPaths = (nodePath: string): string[] => {
        const paths: string[] = [];
        const findNode = (nodes: FolderNode[]): FolderNode | null => {
            for (const node of nodes) {
                if (node.path === nodePath) return node;
                const found = findNode(node.children);
                if (found) return found;
            }
            return null;
        };

        const collectPaths = (node: FolderNode) => {
            node.children.forEach(child => {
                paths.push(child.path);
                collectPaths(child);
            });
        };

        const node = findNode(folderTree);
        if (node) {
            collectPaths(node);
        }
        return paths;
    };

    const toggleSelect = (path: string) => {
        const isCurrentlySelected = selectedPaths.includes(path);
        const descendantPaths = getAllDescendantPaths(path);

        if (isCurrentlySelected) {
            // Desmarcar: remove apenas este path (não afeta filhos)
            const newSelected = selectedPaths.filter(p => p !== path);
            onSelect(newSelected);
        } else {
            // Marcar: adiciona este path E todos os filhos
            const newSelected = new Set([...selectedPaths, path, ...descendantPaths]);
            onSelect(Array.from(newSelected));
        }
    };

    const selectAll = () => {
        // Seleciona todas as pastas + "Sem Categoria"
        const allPaths = [...folderTree.map(f => f.path), '__uncategorized__'];
        onSelect(allPaths);
    };

    const clearSelection = () => {
        onSelect([]);
    };

    const startRename = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPath(path);
        setEditValue(path.split('/').pop() || path);
        setActiveActionPath(null); // fecha o menu de ações
    };

    const confirmRename = () => {
        if (editingPath && editValue.trim() && onRenameFolder) {
            const parts = editingPath.split('/');
            parts[parts.length - 1] = editValue.trim();
            const newPath = parts.join('/');
            if (newPath !== editingPath) {
                onRenameFolder(editingPath, newPath);
            }
        }
        setEditingPath(null);
        setEditValue('');
    };

    const handleDelete = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const itemCount = countItemsInFolder(data, path);
        if (window.confirm(`Tem certeza que deseja excluir a pasta "${path}"?\n\nIsso afetará ${itemCount} item(s).`)) {
            onDeleteFolder?.(path);
        }
        setActiveActionPath(null); // fecha o menu de ações
    };

    const handleContainerClick = (path: string) => {
        if (activeActionPath === path) {
            setActiveActionPath(null); // toggle off se clicar de novo
        } else {
            setActiveActionPath(path);
        }
    };

    const renderFolderNode = (node: FolderNode, depth: number = 0) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = selectedPaths.includes(node.path);
        const hasChildren = node.children.length > 0;
        const isEditing = editingPath === node.path;
        const isActionsVisible = activeActionPath === node.path;

        return (
            <div key={node.path} className="mb-1">
                <div
                    className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl cursor-default transition-all group
                        ${hasChildren ? 'bg-white border-[1px] border-slate-200 hover:border-slate-300 shadow-sm' : 'bg-white border-[1px] border-transparent hover:bg-slate-50 hover:border-slate-100'}
                    `}
                    style={{ marginLeft: `${depth * 24}px` }}
                    onClick={() => handleContainerClick(node.path)}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Impede seleção de texto acidental no duplo clique
                        window.getSelection()?.removeAllRanges();
                        if (hasChildren) toggleExpanded(node.path);
                    }}
                >
                    {/* Folder Icon as Checkbox */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(node.path);
                        }}
                        className={`p-1 -ml-1 rounded-lg shrink-0 transition-all ${isSelected ? 'text-brand-600 scale-110' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                        title={isSelected ? "Desmarcar pasta" : "Selecionar pasta"}
                    >
                        <Icon
                            name="folder"
                            size={isSelected ? 24 : 22}
                            className={isSelected ? "fill-current" : ""}
                        />
                    </button>

                    {/* Name or Edit Input */}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                            className="flex-1 px-3 py-1.5 border border-brand-400 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-0"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className={`flex-1 text-base truncate select-none ${isSelected ? 'font-bold text-brand-800' : 'font-medium text-slate-700'}`}
                        >
                            {node.name}
                        </span>
                    )}

                    {/* Action Buttons (visible ONLY when container is clicked) */}
                    {isActionsVisible && !isEditing ? (
                        <div className="flex items-center gap-1 shrink-0 ml-2 animate-in fade-in slide-in-from-right-4 duration-200">
                            {onImportInFolder && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onImportInFolder(node.path); }}
                                    className="p-2 bg-brand-50 hover:bg-brand-100 rounded-lg text-brand-600 transition-colors"
                                    title="Importar nesta pasta"
                                >
                                    <Icon name="plus" size={18} />
                                </button>
                            )}
                            {onRenameFolder && (
                                <button
                                    onClick={(e) => startRename(node.path, e)}
                                    className="p-2 bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
                                    title="Renomear"
                                >
                                    <Icon name="edit-2" size={18} />
                                </button>
                            )}
                            {onDeleteFolder && (
                                <button
                                    onClick={(e) => handleDelete(node.path, e)}
                                    className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                                    title="Excluir pasta"
                                >
                                    <Icon name="trash-2" size={18} />
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Item Count (visible when actions are NOT visible, or always) */
                        <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${hasChildren ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}
                            title={hasChildren ? "Possui subpastas (duplo clique para expandir)" : `${node.itemCount} itens`}
                        >
                            {node.itemCount}
                        </span>
                    )}
                </div>

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div className="mt-1">
                        {node.children.map(child => renderFolderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Reseta activeActionPath e setEditingPath se a modal fechar
    const handleClose = () => {
        setActiveActionPath(null);
        setEditingPath(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100/95 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200" onClick={() => setActiveActionPath(null)}>
            {/* Header / Top Bar */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm shrink-0" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    <button onClick={handleClose} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                        <Icon name="x" size={24} />
                    </button>
                    <h3 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                        <Icon name="folder-tree" size={24} className="text-brand-600" />
                        Pastas
                    </h3>
                </div>
                <div className="text-sm font-medium text-slate-500">
                    {selectedPaths.length > 0 ? `${selectedPaths.length} selecionada(s)` : 'Mostrando tudo'}
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 p-4 bg-white border-b border-slate-200 shrink-0 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] z-10" onClick={e => e.stopPropagation()}>
                <button
                    onClick={selectAll}
                    className="flex-1 bg-brand-50 text-brand-700 font-bold py-3 rounded-xl hover:bg-brand-100 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                    <Icon name="check-square" size={18} />
                    Selecionar Tudo
                </button>
                <button
                    onClick={clearSelection}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                    <Icon name="square" size={18} />
                    Limpar Seleção
                </button>
            </div>

            {/* Folder List - Scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24" onClick={(e) => setActiveActionPath(null)}>
                <div className="max-w-4xl mx-auto space-y-1">
                    {/* Sem Categoria */}
                    {uncategorizedCount > 0 && (
                        <div
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl cursor-default transition-all mb-2
                                bg-white border-[1px] border-transparent hover:bg-slate-50 hover:border-slate-100
                            `}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelect('__uncategorized__');
                                }}
                                className={`p-1 -ml-1 rounded-lg shrink-0 transition-all ${selectedPaths.includes('__uncategorized__') ? 'text-amber-500 scale-110' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                title={selectedPaths.includes('__uncategorized__') ? "Desmarcar" : "Selecionar"}
                            >
                                <Icon
                                    name="inbox"
                                    size={selectedPaths.includes('__uncategorized__') ? 24 : 22}
                                    className={selectedPaths.includes('__uncategorized__') ? "fill-current" : ""}
                                />
                            </button>

                            <span className={`flex-1 text-base font-medium truncate italic select-none ${selectedPaths.includes('__uncategorized__') ? 'text-amber-800 font-bold' : 'text-slate-600'}`}>
                                Sem Categoria
                            </span>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                {uncategorizedCount}
                            </span>
                        </div>
                    )}

                    {/* Folder Tree */}
                    {folderTree.length > 0 ? (
                        folderTree.map(node => renderFolderNode(node))
                    ) : (
                        <div className="text-center text-slate-400 py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200" onClick={e => e.stopPropagation()}>
                            <Icon name="folder-plus" size={48} className="mx-auto mb-4 opacity-50 text-slate-300" />
                            <p className="text-lg font-bold text-slate-600 mb-1">Nenhuma pasta ainda.</p>
                            <p className="text-sm text-slate-500">Importe um texto para criar sua primeira pasta.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent flex justify-center pb-8 sm:pb-4 pointer-events-none">
                <button
                    onClick={handleClose}
                    className="bg-brand-600 text-white font-bold text-lg py-3 px-12 rounded-full shadow-xl pointer-events-auto hover:bg-brand-700 active:scale-95 transition-all"
                >
                    Concluído
                </button>
            </div>
        </div>
    );
};

export default FolderTree;
