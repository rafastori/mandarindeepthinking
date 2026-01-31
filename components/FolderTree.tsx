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

    const toggleSelect = (path: string) => {
        const newSelected = selectedPaths.includes(path)
            ? selectedPaths.filter(p => p !== path)
            : [...selectedPaths, path];
        onSelect(newSelected);
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
    };

    const renderFolderNode = (node: FolderNode, depth: number = 0) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = selectedPaths.includes(node.path);
        const hasChildren = node.children.length > 0;
        const isEditing = editingPath === node.path;

        return (
            <div key={node.path}>
                <div
                    className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group
                        ${isSelected ? 'bg-brand-100 text-brand-700' : 'hover:bg-slate-100'}
                    `}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => toggleSelect(node.path)}
                >
                    {/* Expand/Collapse */}
                    {hasChildren ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(node.path); }}
                            className="p-0.5 hover:bg-slate-200 rounded"
                        >
                            <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={14} className="text-slate-400" />
                        </button>
                    ) : (
                        <span className="w-5" />
                    )}

                    {/* Checkbox */}
                    <div
                        className={`
                            w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                            ${isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300'}
                        `}
                    >
                        {isSelected && <Icon name="check" size={10} />}
                    </div>

                    {/* Folder Icon */}
                    <Icon name="folder" size={16} className={isSelected ? 'text-brand-600' : 'text-slate-400'} />

                    {/* Name or Edit Input */}
                    {isEditing ? (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                            className="flex-1 px-2 py-0.5 border border-brand-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
                    )}

                    {/* Item Count */}
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded-full">
                        {node.itemCount}
                    </span>

                    {/* Action Buttons (visible on hover) */}
                    <div className="hidden group-hover:flex items-center gap-1">
                        {onImportInFolder && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onImportInFolder(node.path); }}
                                className="p-1 hover:bg-brand-100 rounded text-brand-600"
                                title="Importar nesta pasta"
                            >
                                <Icon name="plus" size={14} />
                            </button>
                        )}
                        {onRenameFolder && (
                            <button
                                onClick={(e) => startRename(node.path, e)}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500"
                                title="Renomear"
                            >
                                <Icon name="edit-2" size={14} />
                            </button>
                        )}
                        {onDeleteFolder && (
                            <button
                                onClick={(e) => handleDelete(node.path, e)}
                                className="p-1 hover:bg-red-100 rounded text-red-500"
                                title="Excluir pasta"
                            >
                                <Icon name="trash-2" size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div>
                        {node.children.map(child => renderFolderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
                onClick={onClose}
            />

            {/* Sidebar Drawer */}
            <div className={`
                fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0 md:shadow-none md:border-r md:border-slate-200
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="folder-tree" size={18} className="text-brand-600" />
                        Pastas
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg md:hidden">
                        <Icon name="x" size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 p-3 border-b border-slate-100 bg-slate-50">
                    <button
                        onClick={selectAll}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 hover:bg-brand-50 rounded"
                    >
                        Selecionar Tudo
                    </button>
                    <button
                        onClick={clearSelection}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 hover:bg-slate-100 rounded"
                    >
                        Limpar
                    </button>
                    <span className="ml-auto text-xs text-slate-400">
                        {selectedPaths.length > 0 ? `${selectedPaths.length} selecionada(s)` : 'Mostrando tudo'}
                    </span>
                </div>

                {/* Folder List */}
                <div className="overflow-y-auto flex-1 p-2" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                    {/* Sem Categoria */}
                    {uncategorizedCount > 0 && (
                        <div
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
                                ${selectedPaths.includes('__uncategorized__') ? 'bg-amber-100 text-amber-700' : 'hover:bg-slate-100'}
                            `}
                            onClick={() => toggleSelect('__uncategorized__')}
                        >
                            <span className="w-5" />
                            <div
                                className={`
                                    w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                                    ${selectedPaths.includes('__uncategorized__') ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}
                                `}
                            >
                                {selectedPaths.includes('__uncategorized__') && <Icon name="check" size={10} />}
                            </div>
                            <Icon name="inbox" size={16} className="text-amber-500" />
                            <span className="flex-1 text-sm font-medium text-slate-600 italic">Sem Categoria</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 rounded-full">
                                {uncategorizedCount}
                            </span>
                        </div>
                    )}

                    {/* Folder Tree */}
                    {folderTree.length > 0 ? (
                        folderTree.map(node => renderFolderNode(node))
                    ) : (
                        <div className="text-center text-slate-400 py-8">
                            <Icon name="folder-plus" size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhuma pasta ainda.</p>
                            <p className="text-xs mt-1">Importe um texto para criar sua primeira pasta.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default FolderTree;
