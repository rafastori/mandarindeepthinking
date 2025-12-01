import React from 'react';
import Icon from './Icon';

interface EmptyStateProps {
    msg: string;
    icon?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ msg, icon = "bookmark" }) => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
        <div className="bg-slate-100 p-6 rounded-full mb-4">
            <Icon name={icon} size={32} className="opacity-50" />
        </div>
        <p className="font-medium">{msg}</p>
    </div>
);

export default EmptyState;