import React from 'react';
import Icon from '../../../components/Icon';

interface ConfidenceBarProps {
    confidence: number; // 0-100
    targetScore?: number;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ confidence }) => {
    const getColor = () => {
        if (confidence > 60) return 'from-emerald-500 to-emerald-600';
        if (confidence > 30) return 'from-yellow-500 to-yellow-600';
        return 'from-red-500 to-red-600';
    };

    const getIcon = () => {
        if (confidence > 60) return 'heart';
        if (confidence > 30) return 'alert-triangle';
        return 'alert-circle';
    };

    return (
        <div className="bg-white rounded-xl p-4 shadow-md border border-slate-200">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon name={getIcon()} size={20} className={confidence > 30 ? 'text-emerald-600' : 'text-red-600'} />
                    <span className="font-bold text-slate-800">Confiança do Grupo</span>
                </div>
                <span className="text-2xl font-bold text-slate-800">{confidence}%</span>
            </div>

            <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getColor()} transition-all duration-500 ease-out`}
                    style={{ width: `${confidence}%` }}
                />
            </div>

            {confidence <= 30 && (
                <p className="text-xs text-red-600 mt-2 font-semibold flex items-center gap-1">
                    <Icon name="alert-triangle" size={14} />
                    Cuidado! A confiança está baixa!
                </p>
            )}
        </div>
    );
};
