
import React, { useState, useMemo } from 'react';
import { BibEntry } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area,
    LineChart, Line, Legend
} from 'recharts';

interface StatsDashboardProps {
  data: BibEntry[];
  insights: string;
  onGenerateInsights: () => void;
  isAnalyzing: boolean;
  customColumns: string[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'];

const StatsDashboard: React.FC<StatsDashboardProps> = ({ data, insights, onGenerateInsights, isAnalyzing, customColumns }) => {
    const [selectedDimension, setSelectedDimension] = useState<string>('city');

    // 0. Calculated Metrics (KPIs)
    const kpis = useMemo(() => {
        if (data.length === 0) return null;
        const years = data.map(e => e.publicationYear).filter(Boolean);
        const translators = new Set(data.map(e => e.translator.name));
        return {
            total: data.length,
            yearSpan: `${Math.min(...years)} - ${Math.max(...years)}`,
            mediators: translators.size,
            intensity: (data.length / (Math.max(...years) - Math.min(...years) + 1)).toFixed(1)
        };
    }, [data]);

    // 1. Frequency Data (Categorical)
    const dimensionOptions = useMemo(() => [
        { key: 'city', label: 'Publication Place / 出版地' },
        { key: 'authorName', label: 'Author / 作者' },
        { key: 'translatorName', label: 'Translator / 译者' },
        { key: 'publisher', label: 'Publisher / 出版社' },
        ...customColumns.map(c => ({ key: `custom:${c}`, label: c }))
    ], [customColumns]);

    const categoricalData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(e => {
            let val = '';
            if (selectedDimension === 'authorName') val = e.author.name;
            else if (selectedDimension === 'translatorName') val = e.translator.name;
            else if (selectedDimension === 'city') val = e.city || 'Unknown';
            else if (selectedDimension === 'publisher') val = e.publisher || 'Unknown';
            else if (selectedDimension.startsWith('custom:')) val = e.customMetadata?.[selectedDimension.split(':')[1]] || 'N/A';
            
            if (val && val !== 'Unknown' && val !== 'N/A') {
                counts[val] = (counts[val] || 0) + 1;
            }
        });
        return Object.keys(counts)
            .map(k => ({ name: k, count: counts[k] }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 12);
    }, [data, selectedDimension]);

    // 2. Temporal Data (Time Series)
    const timeTrendData = useMemo(() => {
        const counts: Record<number, number> = {};
        data.forEach(e => { if (e.publicationYear) counts[e.publicationYear] = (counts[e.publicationYear] || 0) + 1; });
        const sortedYears = Object.keys(counts).map(k => parseInt(k)).sort((a,b) => a - b);
        
        let cumulative = 0;
        return sortedYears.map(year => {
            const count = counts[year];
            cumulative += count;
            return { year, count, cumulative };
        });
    }, [data]);

    return (
        <div className="max-w-[1920px] mx-auto p-12 space-y-12 animate-fadeIn bg-slate-50/30 min-h-full">
            
            {/* KPI ROW */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                    { label: 'Total Archives', zh: '档案条目总数', val: kpis?.total || 0, icon: '📚' },
                    { label: 'Active Period', zh: '研究时间跨度', val: kpis?.yearSpan || 'N/A', icon: '⏳' },
                    { label: 'Unique Mediators', zh: '去重中介者总数', val: kpis?.mediators || 0, icon: '👤' },
                    { label: 'Avg Production', zh: '年均翻译产量', val: kpis?.intensity || 0, icon: '📈' }
                ].map((k, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{k.label} / {k.zh}</p>
                            <p className="text-3xl font-bold serif text-slate-900">{k.val}</p>
                        </div>
                        <div className="text-3xl opacity-20 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">{k.icon}</div>
                    </div>
                ))}
            </div>

            {/* AI INSIGHT REPORT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div className="lg:col-span-2 bg-slate-900 rounded-[3.5rem] p-16 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col justify-center min-h-[400px]">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] -mr-40 -mt-40"></div>
                    <div className="relative z-10 space-y-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-2xl">✨</div>
                            <div className="space-y-1">
                                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400">Scholarly Synthesis Report</h3>
                                <p className="text-[10px] text-slate-500 font-mono">TAD.ANALYTICS.CORE_v3.2</p>
                            </div>
                        </div>
                        <div className="h-px w-full bg-slate-800"></div>
                        {insights ? (
                            <div className="prose prose-invert prose-indigo max-w-none">
                                <p className="text-indigo-50/90 font-serif text-3xl italic leading-relaxed border-l-4 border-indigo-500 pl-12 py-2">
                                    {insights}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 opacity-40">
                                <div className="h-5 w-4/5 bg-slate-800 rounded-full animate-pulse"></div>
                                <div className="h-5 w-3/5 bg-slate-800 rounded-full animate-pulse delay-75"></div>
                                <p className="text-indigo-300 font-serif italic text-2xl pt-6">点击下方按钮生成基于档案数据的深度学术洞察报告。</p>
                            </div>
                        )}
                        <button 
                            onClick={onGenerateInsights} 
                            disabled={isAnalyzing || data.length === 0} 
                            className={`mt-6 py-5 px-10 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] transition-all shadow-2xl ${isAnalyzing ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}
                        >
                            {isAnalyzing ? "Analysing Corpus..." : "Generate AI Analysis Report / 生成学术报告"}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-xl flex flex-col justify-between items-center text-center">
                    <div className="space-y-8 py-6">
                        <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto shadow-inner border border-indigo-100/50">🔬</div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold serif text-slate-900">Lab Overview</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Archival Statistics Synthesis</p>
                        </div>
                        <p className="text-sm text-slate-500 font-serif italic leading-relaxed px-4">
                            该模块通过计算翻译学的视角，将异质的档案条目转化为可量化的时空模型与中介网络。
                        </p>
                    </div>
                </div>
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                {/* 1. Temporal Production Chart (时序统计) */}
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm flex flex-col h-[550px] group hover:shadow-2xl transition-all">
                    <div className="flex justify-between items-start mb-12">
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporal Distribution / 时序统计</h3>
                            <h2 className="text-3xl font-bold serif text-slate-900 italic">Production Velocity & Accumulation</h2>
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="year" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', padding: '20px', fontFamily: 'serif'}}
                                    itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                                />
                                <Area type="monotone" name="Annual Output (年产量)" dataKey="count" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                                <Area type="monotone" name="Cumulative Growth (累积增长)" dataKey="cumulative" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Frequency Analysis Chart (频次统计) */}
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm flex flex-col h-[550px] group hover:shadow-2xl transition-all">
                    <div className="flex justify-between items-start mb-12">
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent & Node Dynamics / 频次统计</h3>
                            <h2 className="text-3xl font-bold serif text-slate-900 italic">Frequency Ranking</h2>
                        </div>
                        <select 
                            value={selectedDimension} 
                            onChange={(e) => setSelectedDimension(e.target.value)} 
                            className="bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest p-5 rounded-2xl outline-none text-indigo-600 shadow-inner hover:bg-white transition-all cursor-pointer"
                        >
                            {dimensionOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoricalData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={150} fontSize={11} tick={{fill: '#475569', fontWeight: 800, fontFamily: 'serif'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', padding: '16px'}} />
                                <Bar dataKey="count" name="Frequency (频次)" radius={[0, 15, 15, 0]} barSize={28}>
                                    {categoricalData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* ADDITIONAL SCHOLARLY FOOTNOTE */}
            <div className="pt-12 border-t border-slate-200 flex flex-col items-center">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-300 serif italic">
                    Computation as Interpretation • TAD Statistics Lab v3.2
                </p>
            </div>
        </div>
    );
};

export default StatsDashboard;
