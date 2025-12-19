import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import 'flag-icons/css/flag-icons.min.css';

interface Option {
    code: string;
    name: string;
    flag: string;
    isoCode: string;
}

interface FlagSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
    placeholder?: string;
}

export const FlagSelect: React.FC<FlagSelectProps> = ({
    options,
    value,
    onChange,
    label,
    disabled = false,
    placeholder = 'Selecione...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.code === value);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (code: string) => {
        onChange(code);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            {label && (
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {label}
                </label>
            )}

            {/* Botão do Select */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between gap-2 px-4 py-3 
                    border rounded-xl transition-all text-left
                    ${disabled
                        ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white border-slate-300 hover:border-emerald-400 cursor-pointer'
                    }
                    ${isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}
                `}
            >
                <div className="flex items-center gap-3">
                    {selectedOption ? (
                        <>
                            <span className={`fi fi-${selectedOption.isoCode} text-xl rounded-sm shadow-sm`}></span>
                            <span className="font-medium text-slate-800">{selectedOption.name}</span>
                        </>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <Icon
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-64 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option.code}
                                type="button"
                                onClick={() => handleSelect(option.code)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                                    ${option.code === value
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }
                                `}
                            >
                                <span className={`fi fi-${option.isoCode} text-xl rounded-sm shadow-sm`}></span>
                                <span className="font-medium">{option.name}</span>
                                {option.code === value && (
                                    <Icon name="check" size={18} className="ml-auto text-emerald-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlagSelect;
