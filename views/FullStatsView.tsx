import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import { useDetailedStats } from '../hooks/useDetailedStats';
import { analyzeStudyStats } from '../services/gemini';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';


import { StudyItem } from '../types';

interface FullStatsViewProps {
    detailedStats: ReturnType<typeof useDetailedStats>;
    libraryData: StudyItem[];
    onPlayAudio: (text: string, lang?: string) => void;
    onClose: () => void;
}

const FullStatsView: React.FC<FullStatsViewProps> = ({ detailedStats, libraryData, onPlayAudio, onClose }) => {
    const { sessions, dayStats, loading, getMostDifficultWords, getWeeklyComparison, getRetentionRate, getInactiveDays, getDailyGoalProgress, getChartData } = detailedStats;
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'charts' | 'ai'>('overview');
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Derived metrics
    const totalTimeMinutes = Math.round(dayStats.reduce((acc, d) => acc + d.totalTime, 0) / 60);
    const totalCorrect = dayStats.reduce((acc, d) => acc + d.totalCorrect, 0);
    const totalWrong = dayStats.reduce((acc, d) => acc + d.totalWrong, 0);
    const globalAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;

    const weeklyFormat = useMemo(() => getWeeklyComparison(), [dayStats]);
    const retentionFormat = useMemo(() => getRetentionRate(), [sessions]);
    const dailyGoalFormat = useMemo(() => getDailyGoalProgress(20), [dayStats]);
    const inactiveDays = useMemo(() => getInactiveDays(), [dayStats]);
    const difficultWords = useMemo(() => getMostDifficultWords(5), [sessions]);

    const handleGenerateAI = async () => {
        setIsAnalyzing(true);
        try {
            const dataToAnalyze = {
                totalSessions: sessions.length,
                totalDays: dayStats.length,
                avgTimePerDay: dayStats.length > 0 ? Math.round(totalTimeMinutes / dayStats.length) : 0,
                avgAccuracy: globalAccuracy,
                mostDifficultWords: difficultWords,
                streakDays: inactiveDays === 0 ? 1 : 0,
                recentTrend: retentionFormat.change >= 0 ? 'improving' : 'declining'
            };
            const text = await analyzeStudyStats(dataToAnalyze);
            setAiAnalysis(text);
        } catch (e) {
            console.error(e);
            setAiAnalysis("Erro ao gerar análise.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExportPDF = async () => {
        setIsAnalyzing(true);
        try {
            // Prepara os dados brutos de estatísticas que a API Python precisará
            const statsData = {
                overview: {
                    totalTimeMinutes,
                    globalAccuracy,
                    totalSessions: sessions.length,
                    dailyGoalPercent: dailyGoalFormat.percent
                },
                difficultWords: difficultWords.map(dw => ({
                    word: dw.word,
                    errorCount: dw.errorCount
                })),
                sessions: dayStats.map(ds => ({
                    date: ds.date,
                    totalMinutes: Math.round(ds.totalTime / 60),
                    correct: ds.totalCorrect,
                    wrong: ds.totalWrong,
                    sessionsCount: ds.sessions.length
                }))
            };

            const response = await fetch('/api/export-pdf.py', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'stats',
                    filename: `Estatisticas_MemorizaTudo_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
                    data: statsData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao exportar PDF');
            }

            // O Python retorna o Blob (PDF gerado)
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Estatisticas_MemorizaTudo_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("PDF Export erro:", e);
            alert("Erro ao exportar PDF. Tente novamente.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const renderHeatmap = () => {
        const days = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (let i = 27; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('sv-SE');
            const dayStat = dayStats.find(ds => ds.date === dateStr);
            const min = dayStat ? Math.round(dayStat.totalTime / 60) : 0;

            let color = 'bg-slate-100';
            if (min > 0) color = 'bg-emerald-200';
            if (min > 10) color = 'bg-emerald-400';
            if (min > 30) color = 'bg-emerald-600';

            days.push(
                <div
                    key={dateStr}
                    className={`w-4 h-4 rounded-sm ${color} transition-colors cursor-pointer hover:ring-2 ring-emerald-300 ring-offset-1`}
                    title={`${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}: ${min} min`}
                />
            );
        }

        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 w-full">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Icon name="calendar-days" size={18} className="text-sky-500" /> Histórico (Últimos 28 dias)
                </h3>
                <div className="flex flex-wrap gap-1.5 justify-start">
                    {days}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <span>Menos</span>
                    <div className="w-3 h-3 rounded-sm bg-slate-100" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-600" />
                    <span>Mais</span>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[70] bg-slate-50/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500">
                <Icon name="loader" size={40} className="text-brand-500 animate-spin mb-4" />
                <p className="font-medium animate-pulse">Calculando estatísticas...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[70] bg-slate-50 flex flex-col overflow-hidden animate-slide-up">
            <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <Icon name="arrow-left" size={20} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="bar-chart-3" size={20} className="text-brand-600" /> Estatísticas Detalhadas
                    </h1>
                </div>
                <button onClick={handleExportPDF} className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-2 font-semibold text-sm" title="Exportar Relatório em PDF">
                    <Icon name="download" size={18} /> <span className="hidden sm:inline">Exportar PDF</span>
                </button>
            </header>

            <div className="flex flex-col h-full items-center overflow-hidden">
                <div className="w-full max-w-4xl px-4 pt-4 pb-2 border-b border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10 flex-shrink-0">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-1 -mx-1">
                        {[
                            { id: 'overview', label: 'Visão Geral', icon: 'layout-grid' },
                            { id: 'sessions', label: 'Diário e Sessões', icon: 'list' },
                            { id: 'charts', label: 'Gráficos', icon: 'bar-chart-2' },
                            { id: 'ai', label: 'Análise Inteligente', icon: 'brain' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as keyof typeof setActiveTab)}
                                className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm flex-shrink-0 ${activeTab === tab.id
                                    ? 'bg-slate-800 text-white shadow-md transform scale-105'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-brand-600'
                                    }`}
                            >
                                <Icon name={tab.icon} size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 w-full overflow-y-auto bg-slate-50/50 p-4 md:p-6" id="pdf-content">
                    <div className="max-w-4xl mx-auto pb-20">

                        {/* VISÃO GERAL */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-pop">
                                {/* Alertas Retenção / Inatividade */}
                                {inactiveDays > 2 && (
                                    <div className="bg-amber-50 shadow-sm border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-start sm:items-center gap-3">
                                        <Icon name="alert-circle" size={24} className="text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                                        <div>
                                            <p className="font-bold">Você está há {inactiveDays} dias sem praticar!</p>
                                            <p className="text-sm opacity-80 mt-1">A sua taxa de retenção natural pode cair substancialmente (Curva de Ebbinghaus). Faça uma curta revisão hoje.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
                                        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center mb-3">
                                            <Icon name="clock" size={20} className="text-sky-500" />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 tracking-tight">{totalTimeMinutes > 60 ? `${Math.floor(totalTimeMinutes / 60)}h ${totalTimeMinutes % 60}m` : `${totalTimeMinutes}m`}</p>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Tempo Total</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                            <Icon name="check-circle" size={20} className="text-emerald-500" />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 tracking-tight">{globalAccuracy}%</p>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Precisão Média</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                                            <Icon name="history" size={20} className="text-purple-500" />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 tracking-tight">{sessions.length}</p>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Sessões Reais</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                                            <Icon name="target" size={20} className="text-amber-500" />
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 tracking-tight">{dailyGoalFormat.percent}%</p>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">Meta: 20 Min/Dia</p>
                                    </div>
                                </div>

                                {renderHeatmap()}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                                            <Icon name="arrow-up-right" size={18} className="text-brand-500" /> Comparação Semanal (Tempo Estudo)
                                        </h3>
                                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl">
                                            <div className="flex-1 border-r border-slate-200">
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Esta Semana</p>
                                                <p className="text-2xl font-black text-slate-700">{Math.round(weeklyFormat.thisWeekTime / 60)} <span className="text-sm font-medium text-slate-400">min</span></p>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Passada</p>
                                                <p className="text-2xl font-black text-slate-700">{Math.round(weeklyFormat.lastWeekTime / 60)} <span className="text-sm font-medium text-slate-400">min</span></p>
                                            </div>
                                            <div className={`flex flex-col items-center justify-center p-3 sm:px-4 rounded-xl shadow-sm ml-2 ${weeklyFormat.percentChange >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                                <Icon name={weeklyFormat.percentChange >= 0 ? 'chevron-up' : 'chevron-down'} size={24} />
                                                <span className="font-black text-base">{Math.abs(weeklyFormat.percentChange)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
                                            <Icon name="alert-circle" size={18} className="text-red-500" /> Palavras Mais Erradas
                                        </h3>
                                        {difficultWords.length === 0 ? (
                                            <p className="text-sm text-slate-400 font-medium">Você ainda não cometeu erros suficientes para gerar essa estatística. Muito bem!</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {difficultWords.map((dw, i) => {
                                                    const matchItem = libraryData.find(item => item.type === 'word' && item.chinese === dw.word);
                                                    const matchKeyword = libraryData.flatMap(item => item.keywords || []).find(k => k.word === dw.word);

                                                    const displayPinyin = matchItem?.pinyin || matchKeyword?.pinyin || '';
                                                    const displayMeaning = matchItem?.translation || matchKeyword?.meaning || '';
                                                    const displayLang = matchItem?.language || matchKeyword?.language || 'zh';

                                                    return (
                                                        <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 transition-colors hover:border-red-200 group">
                                                            <div className="flex flex-col overflow-hidden max-w-[70%]">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-chinese text-lg font-bold text-slate-800">{dw.word}</span>
                                                                    <button
                                                                        onClick={() => onPlayAudio(dw.word, displayLang)}
                                                                        className="p-1 px-1.5 text-slate-400 hover:text-brand-500 hover:bg-white rounded-md transition-colors sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
                                                                        title="Ouvir pronúncia"
                                                                    >
                                                                        <Icon name="volume-2" size={16} />
                                                                    </button>
                                                                </div>
                                                                {(displayPinyin || displayMeaning) && (
                                                                    <div className="text-sm text-slate-500 mt-1 truncate" title={`${displayPinyin} - ${displayMeaning}`}>
                                                                        {displayPinyin && <span className="text-brand-600 font-medium mr-1">{displayPinyin}</span>}
                                                                        <span className="truncate">{displayMeaning}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-bold bg-white shadow-sm border border-red-100 text-red-600 px-2.5 py-1 rounded-full uppercase tracking-wider h-fit flex-shrink-0 ml-2">
                                                                {dw.errorCount} erros
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SESSIONS & LOGS */}
                        {activeTab === 'sessions' && (
                            <div className="space-y-6 animate-slide-up">
                                {dayStats.length === 0 ? (
                                    <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-100 border-dashed">
                                        <Icon name="inbox" size={48} className="text-slate-300 mx-auto mb-4" />
                                        <p className="text-lg font-bold text-slate-600 mb-1">Nenhum dado registrado ainda.</p>
                                        <p className="text-slate-400 text-sm">Vá aprender algumas palavras! As estatísticas aparecerão depois que concluir as sessões de hoje.</p>
                                    </div>
                                ) : (
                                    dayStats.map((ds, idx) => (
                                        <div key={idx} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden transform transition-all hover:shadow-md">
                                            <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
                                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <Icon name="calendar-days" size={18} className="text-brand-500" />
                                                    {new Date(ds.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).replace(/^\w/, c => c.toUpperCase())}
                                                </h3>
                                                <div className="flex gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider items-center flex-wrap">
                                                    <span className="bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{Math.round(ds.totalTime / 60)} Min</span>
                                                    <span className={`px-2 py-1 rounded-md shadow-sm border ${ds.totalWrong === 0 && ds.totalCorrect > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white border-slate-100"}`}>
                                                        {ds.totalCorrect} Acertos / {ds.totalWrong} Erros
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="divide-y divide-slate-50">
                                                {ds.sessions.map((s, sIdx) => {
                                                    const duration = s.endTime ? Math.floor((s.endTime - s.startTime) / 1000) : 0;
                                                    const sAcc = (s.correctAnswers + s.wrongAnswers) > 0 ? Math.round((s.correctAnswers / (s.correctAnswers + s.wrongAnswers)) * 100) : 0;
                                                    return (
                                                        <div key={sIdx} className="p-5 hover:bg-brand-50/30 transition-colors">
                                                            <div className="flex justify-between items-center mb-4">
                                                                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                                                                    <Icon name="clock" size={14} className="text-slate-400" />
                                                                    <span className="text-xs font-bold">{new Date(s.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                                <div className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm border ${sAcc >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                    sAcc >= 50 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                        'bg-red-50 text-red-600 border-red-100'
                                                                    }`}>
                                                                    {sAcc}% Precisão
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-3 md:gap-4 text-center text-xs">
                                                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                                    <p className="font-black text-lg text-slate-700 mb-0.5">{Math.round(duration / 60)}<span className="text-xs font-medium text-slate-400">m</span></p>
                                                                    <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Duração</p>
                                                                </div>
                                                                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                                                                    <p className="font-black text-lg text-emerald-600 mb-0.5">{s.correctAnswers}</p>
                                                                    <p className="text-emerald-500/80 font-medium uppercase tracking-wider text-[10px]">Acertos</p>
                                                                </div>
                                                                <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                                                                    <p className="font-black text-lg text-red-600 mb-0.5">{s.wrongAnswers}</p>
                                                                    <p className="text-red-500/80 font-medium uppercase tracking-wider text-[10px]">Erros</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* GRÁFICOS */}
                        {activeTab === 'charts' && (
                            <div className="space-y-6 animate-pop">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-2">
                                        <Icon name="clock" size={20} className="text-sky-500" /> Evolução de Tempo de Estudo (Últimos 30 Dias)
                                    </h3>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={getChartData(30)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dx={-10} />
                                                <RechartsTooltip cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                                <Line type="monotone" name="Tempo (min)" dataKey="tempo" stroke="#0ea5e9" strokeWidth={4} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#0284c7' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                    <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-2">
                                        <Icon name="target" size={20} className="text-emerald-500" /> Média de Precisão (%)
                                    </h3>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getChartData(15)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dx={-10} />
                                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                                <Bar name="Precisão %" dataKey="precisao" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ANÁLISE IA */}
                        {activeTab === 'ai' && (
                            <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-100 text-center animate-pop">
                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/20 transform rotate-3">
                                    <Icon name="brain-circuit" size={48} className="text-white transform -rotate-3" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Análise Inteligente</h2>
                                <p className="text-slate-500 mb-10 max-w-lg mx-auto font-medium">Nossa IA analisa seu histórico de estudo, frequência, retenção e erros mais comuns para gerar insights valiosos 100% personalizados sobre sua jornada de aprendizagem.</p>

                                {!aiAnalysis && !isAnalyzing && (
                                    <button
                                        onClick={handleGenerateAI}
                                        className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-slate-900/20 transform hover:-translate-y-1 flex items-center justify-center gap-3 mx-auto w-full max-w-xs"
                                    >
                                        <Icon name="sparkles" size={20} className="text-amber-400" />
                                        Gerar Análise Agora
                                    </button>
                                )}

                                {isAnalyzing && (
                                    <div className="py-10 flex flex-col items-center bg-slate-50 rounded-3xl">
                                        <Icon name="loader" size={48} className="text-brand-500 animate-spin mb-6" />
                                        <p className="text-slate-800 font-bold text-lg mb-1">Cruncheando os dados...</p>
                                        <p className="text-slate-500 font-medium text-sm animate-pulse">Consultando o Gemini AI</p>
                                    </div>
                                )}

                                {aiAnalysis && !isAnalyzing && (
                                    <div className="text-left bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-[2rem] p-8 mt-6 shadow-sm">
                                        <div className="prose prose-slate prose-lg max-w-none 
                                            prose-headings:font-black prose-headings:text-slate-800 
                                            prose-strong:text-brand-700
                                            prose-p:text-slate-600 prose-p:font-medium prose-p:leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n\n/g, '<br/><br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullStatsView;
