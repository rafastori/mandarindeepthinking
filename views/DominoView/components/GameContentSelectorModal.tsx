import React, { useState, useMemo } from 'react';
import Icon from '../../../components/Icon';
import { useStudyItems } from '../../../hooks/useStudyItems';
import { buildFolderTree, FolderNode, countItemsInFolder } from '../../../services/folderService';

interface GameContentSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserId: string;
    onConfirmSelection: (selectedFolderPaths: string[]) => void;
    initialSelectedPaths?: string[];
}

export const GameContentSelectorModal: React.FC<GameContentSelectorModalProps> = ({
    isOpen,
    onClose,
    currentUserId,
    onConfirmSelection,
    initialSelectedPaths = []
}) => {
    const { items, loading } = useStudyItems(currentUserId);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(initialSelectedPaths));
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    const folderTree = useMemo(() => buildFolderTree(items), [items]);

    const handleToggleSelect = (path: string) => {
        const newSelected = new Set(selectedPaths);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedPaths(newSelected);
    };

    const handleToggleExpand = (path: string) => {
        const newExpanded = new Set(expandedPaths);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedPaths(newExpanded);
    };

    const renderTree = (nodes: FolderNode[], level: number = 0) => {
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = expandedPaths.has(node.path);
            const isSelected = selectedPaths.has(node.path);
            const count = countItemsInFolder(items, node.path);

            if (count === 0) return null; // Hide empty structural folders for games

            return (
                <div key={node.path} className="mb-1">
                    <div
                        className={`flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-brand-50/50' : ''}`}
                        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
                    >
                        {/* Expand/Collapse Button */}
                        <div className="w-6 flex items-center justify-center">
                            {hasChildren ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleExpand(node.path); }}
                                    className="p-1 hover:bg-slate-200 text-slate-400 rounded transition-colors"
                                >
                                    <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={16} />
                                </button>
                            ) : (
                                <span className="w-4" />
                            )}
                        </div>

                        {/* Checkbox */}
                        <button
                            onClick={() => handleToggleSelect(node.path)}
                            className="flex items-center justify-center w-5 h-5 mr-3 rounded border-2 transition-all flex-shrink-0"
                            style={{
                                borderColor: isSelected ? '#10b981' : '#cbd5e1',
                                backgroundColor: isSelected ? '#10b981' : 'transparent'
                            }}
                        >
                            {isSelected && <Icon name="check" size={12} className="text-white" />}
                        </button>

                        {/* Folder Info */}
                        <div
                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                            onClick={() => handleToggleSelect(node.path)}
                        >
                            <Icon name="folder" size={18} className={isSelected ? 'text-brand-500' : 'text-slate-400'} />
                            <span className={`font-medium truncate ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                                {node.name}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-auto whitespace-nowrap">
                                {count} cartas
                            </span>
                        </div>
                    </div>

                    {/* Children */}
                    {hasChildren && isExpanded && (
                        <div className="mt-1">
                            {renderTree(node.children, level + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative z-10">
                    <div>
                        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                            <Icon name="library" className="text-brand-500" />
                            Minha Biblioteca
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {selectedPaths.size === 0 ? 'Nenhuma pasta selecionada.' : `${selectedPaths.size} pasta(s) incluída(s).`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <Icon name="x" size={20} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-white relative">
                    <p className="text-sm text-slate-600 mb-6 bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100">
                        Selecione as pastas da sua biblioteca pessoal para fornecer cartas a esta partida.
                    </p>

                    {loading ? (
                        <div className="p-8 text-center text-slate-400">
                            <Icon name="loader" size={32} className="mx-auto mb-2 opacity-50 animate-spin" />
                            <p className="font-medium text-sm">Carregando biblioteca...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400">
                            <Icon name="folder-open" size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="font-medium text-sm">Sua biblioteca está vazia.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {renderTree(folderTree)}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl relative z-10">
                    <button onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            onConfirmSelection(Array.from(selectedPaths));
                            onClose();
                        }}
                        disabled={selectedPaths.size === 0}
                        className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                    >
                        <Icon name="check" size={18} />
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};
