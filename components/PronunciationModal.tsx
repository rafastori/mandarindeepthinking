
import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { StudyItem, Keyword } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface PronunciationModalProps {
    data: StudyItem[];
    onClose: () => void;
    onResult: (correct: boolean, word: string, type: string) => void;
}

const PronunciationModal: React.FC<PronunciationModalProps> = ({ data, onClose, onResult }) => {
    const [target, setTarget] = useState<Keyword & { language?: 'zh'|'de' } | null>(null);
    const [status, setStatus] = useState<'idle' | 'listening' | 'success' | 'error'>('idle');
    const [transcript, setTranscript] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const speak = useSpeech();

    useEffect(() => {
        const allKeywords = data.flatMap(s => s.keywords.map(k => ({...k, language: s.language || 'zh'})));
        if (allKeywords.length > 0) {
            const random = allKeywords[Math.floor(Math.random() * allKeywords.length)];
            setTarget(random as any);
        }
    }, [data]);

    const checkSimilarity = (input: string, targetWord: string, language: 'zh' | 'de') => {
        if (!input) return false;
        
        const cleanInput = input.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~() ]/g,"");
        const cleanTarget = targetWord.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~() ]/g,"");
        
        // Exact string match (always enabled)
        if (cleanInput.includes(cleanTarget) || cleanTarget.includes(cleanInput)) return true;

        // Chinese-specific logic (Pinyin fuzzy match)
        if (language === 'zh') {
            try {
                const pinyin = window.pinyinPro?.pinyin;
                if (pinyin) {
                    const pinyinInput = pinyin(cleanInput, { toneType: 'none', type: 'array' }).join('').toLowerCase();
                    const pinyinTarget = pinyin(cleanTarget, { toneType: 'none', type: 'array' }).join('').toLowerCase();
                    return pinyinInput.includes(pinyinTarget) || pinyinTarget.includes(pinyinInput);
                }
            } catch (e) {
                console.error("Error in Pinyin conversion", e);
            }
        }
        
        // German is stricter (no fuzzy logic lib used here for now)
        return false;
    }

    const startListening = () => {
        setErrorMsg('');
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setErrorMsg("Browser does not support Speech Recognition."); 
            return;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            // Set language based on target item
            recognition.lang = target?.language === 'de' ? 'de-DE' : 'zh-CN';
            
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setStatus('listening');
            
            recognition.onresult = (event: any) => {
                const result = event.results[0][0].transcript;
                setTranscript(result);
                
                if (target && checkSimilarity(result, target.word, target.language || 'zh')) {
                    setStatus('success');
                    onResult(true, target.word, 'pronunciation');
                    speak("Muito bem!", 'zh'); // Feedback simples
                    setTimeout(() => {
                        const allKeywords = data.flatMap(s => s.keywords.map(k => ({...k, language: s.language || 'zh'})));
                        setTarget(allKeywords[Math.floor(Math.random() * allKeywords.length)] as any);
                        setStatus('idle');
                        setTranscript('');
                    }, 1500);
                } else if (target) {
                    setStatus('error');
                    onResult(false, target.word, 'pronunciation');
                }
            };

            recognition.onerror = (e: any) => {
                setStatus('idle');
                if (e.error === 'not-allowed') setErrorMsg("Permission denied.");
                else if (e.error === 'no-speech') setErrorMsg("No speech detected.");
                else setErrorMsg("Error: " + e.error);
            };

            recognition.onend = () => { if (status === 'listening') setStatus('idle'); };
            recognition.start();
        } catch (e) { 
            setErrorMsg("Error starting microphone."); 
        }
    };

    if (!target) {
        return (
             <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-pop p-4">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative flex flex-col items-center text-center">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                        <Icon name="x" size={24} />
                    </button>
                    <Icon name="mic" size={48} className="text-slate-300 mb-4" />
                    <p className="text-slate-500">Importe um texto para praticar.</p>
                </div>
            </div>
        );
    }

    const isGerman = target.language === 'de';

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-pop p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative flex flex-col items-center">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <Icon name="x" size={24} />
                </button>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">
                    {isGerman ? 'Pronúncia (Alemão)' : 'Pronúncia (Mandarim)'}
                </h2>
                <div className="mb-8 text-center">
                    <p className={`text-5xl font-bold text-slate-800 mb-2 ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                        {target.word}
                    </p>
                    <p className="text-xl text-brand-600 font-medium">{target.pinyin}</p>
                </div>
                <div className={`w-full bg-slate-50 rounded-xl p-4 mb-6 min-h-[60px] flex items-center justify-center text-center border-2 transition-colors ${status === 'success' ? 'border-brand-500 bg-brand-50' : status === 'error' ? 'border-red-400 bg-red-50' : 'border-slate-100'}`}>
                    {status === 'listening' && <p className="text-slate-400 animate-pulse">Ouvindo...</p>}
                    {(status === 'success' || status === 'error') && <p className={`text-lg ${isGerman ? 'font-sans' : 'font-chinese'} ${status === 'success' ? 'text-brand-700' : 'text-red-600'}`}>{transcript || "..."}</p>}
                    {status === 'idle' && !errorMsg && <p className="text-slate-300 text-sm">Toque e fale</p>}
                    {errorMsg && <p className="text-red-500 text-xs font-bold">{errorMsg}</p>}
                </div>
                <button onMouseDown={startListening} onTouchStart={startListening} className={`p-6 rounded-full shadow-lg transition-all active:scale-95 ${status === 'listening' ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                    <Icon name="mic" size={32} />
                </button>
            </div>
        </div>
    );
};

export default PronunciationModal;
