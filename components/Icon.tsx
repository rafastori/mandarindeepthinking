import React from 'react';
import {
    BookOpen,
    List,
    Edit3,
    Edit2,
    Gamepad2,
    FlaskConical,
    Layers,
    Mic,
    BarChart2,
    BrainCircuit,
    ChevronDown,
    ChevronRight,
    Trash2,
    BookmarkMinus,
    Bookmark,
    CheckCircle,
    X,
    Volume2,
    User,
    LogOut,
    Sparkles,
    Info,
    Plus,
    RotateCcw,
    Swords,
    Zap,
    Flame,
    Trophy,
    Download,
    Upload,
    Chrome,
    RefreshCw,
    Save,
    PlusCircle,
    Check,
    AlertCircle,
    LayoutGrid,
    Loader,
    Inbox,
    ArrowLeft,
    Maximize2,
    Minimize2,
    Folder,
    FolderTree,
    FolderPlus,
    Filter
} from 'lucide-react';

export interface IconProps {
    name: string;
    size?: number;
    className?: string;
    fill?: string; // Adicionado para suportar preenchimento
}

const icons: Record<string, React.ElementType> = {
    'book-open': BookOpen,
    'list': List,
    'edit-3': Edit3,
    'edit-2': Edit2,
    'gamepad-2': Gamepad2,
    'flask-conical': FlaskConical,
    'layers': Layers,
    'mic': Mic,
    'bar-chart-2': BarChart2,
    'brain-circuit': BrainCircuit,
    'chevron-down': ChevronDown,
    'chevron-right': ChevronRight,
    'trash-2': Trash2,
    'bookmark-minus': BookmarkMinus,
    'bookmark': Bookmark,
    'check-circle': CheckCircle,
    'x': X,
    'volume-2': Volume2,
    'user': User,
    'log-out': LogOut,
    'sparkles': Sparkles,
    'info': Info,
    'plus': Plus,
    'rotate-ccw': RotateCcw,
    'swords': Swords,
    'zap': Zap,
    'flame': Flame,
    'trophy': Trophy,
    'download': Download,
    'upload': Upload,
    'chrome': Chrome,
    'refresh-cw': RefreshCw,
    'save': Save,
    'plus-circle': PlusCircle,
    'check': Check,
    'alert-circle': AlertCircle,
    'layout-grid': LayoutGrid,
    'loader': Loader,
    'inbox': Inbox,
    'arrow-left': ArrowLeft,
    'maximize-2': Maximize2,
    'minimize-2': Minimize2,
    'folder': Folder,
    'folder-tree': FolderTree,
    'folder-plus': FolderPlus,
    'filter': Filter
};

const Icon: React.FC<IconProps> = ({ name, size = 24, className = '', fill = 'none' }) => {
    const LucideIcon = icons[name];

    if (!LucideIcon) {
        console.warn(`Icon "${name}" not found`);
        return null;
    }

    return <LucideIcon size={size} className={className} fill={fill} />;
};

export default Icon;