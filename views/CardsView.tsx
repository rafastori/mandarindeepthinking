import React, { useState, useEffect, useCallback } from 'react';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { StudyItem } from '../types';
import { getSavedItems, CardItem } from '../utils/cardUtils';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { Star } from 'lucide-react';

interface CardsViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
    activeFolderFilters?: string[];
    studyMoreIds?: string[];
    onToggleStudyMore?: (wordId: string) => void;
    showOnlyErrors?: boolean;
    wordCounts?: Record<string, any>;
}

const CardsView: React.FC<CardsViewProps> = ({ data, savedIds, onResult, activeFolderFilters = [], studyMoreIds = [], onToggleStudyMore, showOnlyErrors = false, wordCounts = {} }) => {
    const { speak, stop, playingId } = usePuterSpeech();

    // Estado para inverter lados (Definição <-> Palavra)
    const [invertSide, setInvertSide] = useState(false);

    // Refs para dados estáveis (Snapshot)
    const dataSnapshotRef = React.useRef<{ data: StudyItem[], savedIds: string[] } | null>(null);
    if (!dataSnapshotRef.current && data.length > 0) {
        dataSnapshotRef.current = { data, savedIds };
    }

    // Chave estável para filtros
    const filtersKey = React.useMemo(() => (activeFolderFilters || []).sort().join(','), [activeFolderFilters]);

    // Estado da Sessão
    const [deck, setDeck] = useState<CardItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Função que cria o baralho (Extraída para ser usada no Início e no Reiniciar)
    const createNewDeck = useCallback(() => {
        setIsLoading(true);

        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;
        const currentSavedIds = snapshot.savedIds;

        // Filtra dados por pasta se houver filtros ativos
        // 1. Identifica palavras permitidas (que aparecem nos textos das pastas selecionadas)
        const allowedWords = new Set<string>();
        const clean = (text: string) => text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, "").trim();

        if (activeFolderFilters.length > 0) {
            currentData.forEach(item => {
                if (item.type !== 'word') {
                    // Verifica se o TEXTO está na pasta
                    const inFolder = activeFolderFilters.some(filterPath => {
                        if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                        return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                    });

                    if (inFolder) {
                        item.tokens?.forEach(t => allowedWords.add(clean(t)));
                        item.keywords?.forEach(k => allowedWords.add(clean(k.word)));
                    }
                }
            });
        }

        // 2. Filtra dados (União: Está na pasta OU é uma palavra que aparece na pasta)
        const filteredData = activeFolderFilters.length === 0 ? currentData : currentData.filter(item => {
            // Verifica pasta explícita
            const explicitMatch = activeFolderFilters.some(filterPath => {
                if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
            });

            if (explicitMatch) return true;

            // Verifica associação dinâmica (apenas para cards de palavra)
            if (item.type === 'word' && allowedWords.has(clean(item.chinese))) {
                return true;
            }

            return false;
        });

        // 3. NOVIDADE: Aplica filtro global de Erros (State Lifted do ReviewView)
        const errorFilteredData = showOnlyErrors
            ? filteredData.filter(item => {
                if (item.type === 'word') {
                    // Ignora items que não tem um erro registrado na estatística
                    const chinese = item.chinese || '';
                    return (wordCounts[chinese]?.wrong || 0) > 0;
                }
                // Textos não possuem cartão próprio neste nível de drill-down
                return false;
            })
            : filteredData;

        const items = getSavedItems(errorFilteredData, currentSavedIds);

        if (items.length > 0) {
            const shuffled = [...items].sort(() => 0.5 - Math.random());
            // Boost: duplicate study-more items for 2x frequency
            const withBoost = shuffled.flatMap(card =>
                studyMoreIds.includes(card.sourceId) ? [card, { ...card, id: card.id + '-boost' }] : [card]
            );
            const reShuffle = withBoost.sort(() => 0.5 - Math.random());
            setDeck(reShuffle);
        } else {
            setDeck([]);
        }

        setCurrentIndex(0);
        setFlipped(false);
        setIsFinished(false);
        setIsLoading(false);
    }, [filtersKey]); // Depende APENAS da chave de filtros (estável)

    // EFEITO DE INICIALIZAÇÃO COM TRAVA DE SEGURANÇA 🔒
    // EFEITO DE INICIALIZAÇÃO E REAÇÃO A FILTROS
    useEffect(() => {
        // Inicializa ou recria o baralho se houver mudança dependente profunda (dados core)
        if (data.length > 0) {
            createNewDeck();
        }
    }, [data.length, showOnlyErrors]); // Inicializa quando dados chegam OU erro toggle muda

    // Recria se FILTROS mudarem (usando a chave estável)
    useEffect(() => {
        createNewDeck();
    }, [filtersKey]);

    const handleRestart = () => {
        createNewDeck(); // Força a recriação manual
    };

    // --- RENDERIZAÇÃO ---

    if (isLoading && deck.length === 0) return <div className="flex h-full items-center justify-center text-slate-400">Embaralhando...</div>;

    if (isFinished) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in zoom-in duration-300">
                <div className="bg-blue-100 p-6 rounded-full mb-6 shadow-sm">
                    <Icon name="layers" size={64} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Sessão Concluída!</h2>
                <p className="text-slate-500 mb-8 max-w-xs">
                    Você revisou <span className="font-bold text-slate-700">{deck.length} cartas</span>.
                </p>
                <button
                    onClick={handleRestart}
                    className="bg-brand-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Icon name="rotate-ccw" size={20} />
                    Revisar Novamente
                </button>
            </div>
        );
    }

    if (deck.length === 0) return <EmptyState msg="Sem cards para revisar." icon="layers" />;

    const card = deck[currentIndex];

    // Proteção se o índice sair do limite
    if (!card) return null;

    const isGerman = card.language === 'de';

    const getFontSize = (text: string) => {
        if (text.length > 20) return 'text-2xl';
        if (text.length > 12) return 'text-4xl';
        return 'text-6xl';
    };

    const next = (correct: boolean) => {
        // 1. Vira a carta
        setFlipped(false);

        // 2. Registra resultado
        onResult(correct, card.word);

        // 3. Aguarda animação (250ms) para trocar o conteúdo
        setTimeout(() => {
            if (currentIndex < deck.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsFinished(true);
            }
        }, 250);
    };

    return (
        <div className="p-6 h-full flex flex-col items-center justify-center max-w-md mx-auto pb-24">
            <div className="w-full mb-4 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Card {currentIndex + 1} de {deck.length}</span>

                <button
                    onClick={() => setInvertSide(!invertSide)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${invertSide ? 'bg-brand-100 text-brand-600' : 'hover:bg-slate-100'}`}
                    title="Inverter lados (Definição primeiro)"
                >
                    <Icon name="arrow-left-right" size={14} />
                    <span>{invertSide ? 'Invertido' : 'Normal'}</span>
                </button>

                <span>{Math.round(((currentIndex + 1) / deck.length) * 100)}%</span>
            </div>

            <div className="relative w-full aspect-[3/4] cursor-pointer perspective-1000 group" onClick={() => setFlipped(!flipped)}>
                <div className={`w-full h-full transition-all duration-500 transform-style-3d shadow-2xl rounded-2xl ${flipped ? 'rotate-y-180' : ''}`}>

                    {/* FRENTE */}
                    <div className="absolute inset-0 bg-white rounded-2xl flex flex-col items-center justify-center backface-hidden border-b-4 border-slate-100 p-4">
                        <span className="text-xs text-slate-400 uppercase tracking-widest mb-4">
                            {invertSide ? 'Definição' : (isGerman ? 'Palavra' : 'Hanzi')}
                        </span>

                        <h2 className={`${invertSide ? 'text-2xl font-medium' : getFontSize(card.word) + ' ' + (isGerman ? 'font-sans' : 'font-chinese') + ' font-bold'} text-slate-800 text-center break-words w-full`}>
                            {invertSide ? card.meaning : card.word}
                        </h2>

                        {/* Botão de áudio (Só mostra na frente se NÃO estiver invertido, ou se quiser dar a dica do áudio) */}
                        {!invertSide && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const audioId = `card-front-${currentIndex}`;
                                    if (playingId === audioId) {
                                        stop();
                                    } else {
                                        speak(card.word, (card.language || 'zh') as 'zh' | 'de' | 'pt' | 'en', audioId);
                                    }
                                }}
                                className={`mt-4 p-3 rounded-full transition-colors ${playingId === `card-front-${currentIndex}` ? 'bg-brand-600 text-white animate-pulse' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'}`}
                                title="Ouvir pronúncia"
                            >
                                <Icon name={playingId === `card-front-${currentIndex}` ? 'square' : 'volume-2'} size={24} />
                            </button>
                        )}

                        <span className="mt-4 text-xs text-brand-500 font-bold">Toque para virar</span>
                    </div>

                    {/* VERSO */}
                    <div className="absolute inset-0 bg-slate-800 rounded-2xl flex flex-col items-center justify-center rotate-y-180 backface-hidden text-white p-6 text-center">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className={`text-3xl ${isGerman ? 'font-sans' : 'font-chinese'} font-bold break-words`}>
                                {card.word}
                            </h2>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const audioId = `card-back-${currentIndex}`;
                                    if (playingId === audioId) {
                                        stop();
                                    } else {
                                        speak(card.word, (card.language || 'zh') as 'zh' | 'de' | 'pt' | 'en', audioId);
                                    }
                                }}
                                className={`p-2 rounded-full transition-colors flex-shrink-0 ${playingId === `card-back-${currentIndex}` ? 'bg-white/40 text-white animate-pulse' : 'bg-white/20 text-white hover:bg-white/30'}`}
                                title="Ouvir pronúncia"
                            >
                                <Icon name={playingId === `card-back-${currentIndex}` ? 'square' : 'volume-2'} size={20} />
                            </button>
                        </div>
                        <p className="text-brand-400 text-xl mb-4">{card.pinyin}</p>

                        <p className="text-lg mb-6 opacity-90">{card.meaning}</p>

                        {card.context && card.context !== card.word && (
                            <div className={`bg-white/10 p-3 rounded text-sm italic ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                                {card.context}
                            </div>
                        )}

                        {/* Study More toggle */}
                        {onToggleStudyMore && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleStudyMore(card.sourceId);
                                }}
                                className={`mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${studyMoreIds.includes(card.sourceId)
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/20'
                                    }`}
                                title={studyMoreIds.includes(card.sourceId) ? 'Remover de Estudar Mais' : 'Marcar para Estudar Mais'}
                            >
                                <Star className={`w-3.5 h-3.5 ${studyMoreIds.includes(card.sourceId) ? 'fill-current' : ''}`} />
                                {studyMoreIds.includes(card.sourceId) ? 'Estudar Mais ✓' : 'Estudar Mais'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`flex gap-4 mt-8 w-full transition-opacity duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={(e) => { e.stopPropagation(); next(false); }} className="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold shadow-sm active:scale-95 transition-transform">Errei</button>
                <button onClick={(e) => { e.stopPropagation(); next(true); }} className="flex-1 py-3 rounded-xl bg-brand-100 text-brand-700 font-bold shadow-sm active:scale-95 transition-transform">Acertei</button>
            </div>
        </div>
    );
};

export default CardsView;