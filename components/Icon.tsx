import React from 'react';
import { 
    BrainCircuit, Mic, BarChart2, BookOpen, List, 
    PenTool, Gamepad2, FlaskConical, Layers, Bookmark,
    Info, Volume2, X, Activity, History, Trash2,
    Trophy, RefreshCw, CheckCircle, XCircle,
    FilePlus, Wand2, AlertCircle, Plus, Languages,
    LogOut, User
} from 'lucide-react';

interface IconProps {
    name: string;
    size?: number;
    className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, className = "" }) => {
    const icons: Record<string, React.ElementType> = {
        'brain-circuit': BrainCircuit,
        'mic': Mic,
        'bar-chart-2': BarChart2,
        'book-open': BookOpen,
        'list': List,
        'pen-tool': PenTool,
        'gamepad-2': Gamepad2,
        'flask-conical': FlaskConical,
        'layers': Layers,
        'bookmark': Bookmark,
        'info': Info,
        'volume-2': Volume2,
        'x': X,
        'activity': Activity,
        'history': History,
        'trash-2': Trash2,
        'trophy': Trophy,
        'refresh-cw': RefreshCw,
        'check-circle': CheckCircle,
        'x-circle': XCircle,
        'file-plus': FilePlus,
        'wand-2': Wand2,
        'alert-circle': AlertCircle,
        'plus': Plus,
        'languages': Languages,
        'log-out': LogOut,
        'user': User
    };

    const LucideIcon = icons[name];
    if (!LucideIcon) return null;

    return <LucideIcon size={size} className={className} />;
};

export default Icon;