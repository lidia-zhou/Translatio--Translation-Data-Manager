
import React, { useState, useMemo } from 'react';
import { BibEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';

interface StatsDashboardProps {
  data: BibEntry[];
  insights: string;
  onGenerateInsights: () => void;
  isAnalyzing: boolean;
  customColumns: string[];
}

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

const StatsDashboard: React.FC<StatsDashboardProps> = ({ data, insights, onGenerateInsights, isAnalyzing, customColumns }) => {
    const [selectedDimension, setSelectedDimension] = useState<string>('city');

    const dimensionOptions = useMemo(() => [
        { key: 'authorName', label: 'Author / 作者' },
        { key: 'translatorName', label: 'Translator / 译者' },
        { key: 'city', label: 'City / 城市' },
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
            
            if (val) counts[val] = (counts[val] || 0) + 1;
        });
        return Object.keys(counts).map(k => ({ name: k, count: counts[k] })).sort((a,b) => b.count - a.count).slice(0, 10);
    }, [data, selectedDimension]);

    const timeTrendData = useMemo(() => {
        const counts: Record<number, number> = {};
        data.forEach(e => { if (e.publicationYear) counts[e.publicationYear] = (counts[e.publicationYear] || 0) + 1; });
        return Object.keys(counts).map(k => ({ year: parseInt(k), count: counts[k as any] })).sort((a,b) => a.year - b.year);
    }, [data]);

  return (
    <div className="max-w-[1600px] mx-auto p-10 space-y-10 animate-fadeIn bg-slate-50/50 min-h-full">
      
      {/* AI Academic Report Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-16 shadow-2xl relative overflow-hidden border border-slate-800 flex flex-col justify-center min-h-[450px]">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] -mr-32 -mt-32"></div>
            <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20">✨</div>
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold uppercase tracking-[0.4em] text-indigo-400">Computational Humanities Insight</h3>
                        <p className="text-[10px] text-slate-500 font-mono">ARCHIVAL.REPORT.SCAN_v1.0</p>
                    </div>
                </div>
                
                <div className="h-px w-full bg-slate-800"></div>

                {insights ? (
                    <div className="space-y-6">
                        <div className="prose prose-invert prose-indigo max-w-none text-indigo-50 /90 font-serif text-2xl italic leading-relaxed border-l-4 border-indigo-500 pl-10">
                            {insights}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 py-8">
                         <div className="h-4 w-4/5 bg-slate-800 rounded-full animate-pulse"></div>
                         <div className="h-4 w-3/5 bg-slate-800 rounded-full animate-pulse delay-75"></div>
                         <div className="h-4 w-2/3 bg-slate-800 rounded-full animate-pulse delay-150"></div>
                         <p className="text-indigo-300 font-serif italic text-xl pt-6">The system is ready for synthesized cross-archival analysis. Click to engage models.</p>
                    </div>
                )}
            </div>
        </div>
        
        <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-xl flex flex-col justify-between items-center text-center">
            <div className="space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto shadow-inner border border-slate-100">📖</div>
                <h2 className="text-3xl font-bold serif text-slate-800">Research Synthesis</h2>
                <p className="text-sm text-slate-500 font-serif leading-relaxed px-6">Identifies socio-cultural patterns in translation flows, agent clusters, and bibliographic shifts.</p>
            </div>
            <button onClick={onGenerateInsights} disabled={isAnalyzing || data.length === 0} className={`w-full py-6 rounded-[2.2rem] font-bold uppercase text-xs tracking-widest transition-all shadow-2xl ${isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-indigo-600 hover:scale-[1.02]'}`}>
                {isAnalyzing ? "Processing Archives..." : "Generate Analysis Report / 深度分析"}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Trend Area Chart */}
        <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-sm flex flex-col h-[500px]">
            <div className="mb-10">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Temporal Distribution</h3>
                <h2 className="text-3xl font-bold serif text-slate-800">Production Velocity / 时间趋势</h2>
            </div>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeTrendData}>
                        <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                        <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '16px'}} />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={4} fill="url(#areaGradient)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Dynamic Category Chart */}
        <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-sm flex flex-col h-[500px]">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agent Dynamics</h3>
                    <h2 className="text-3xl font-bold serif text-slate-800">Frequency Analysis</h2>
                </div>
                <select value={selectedDimension} onChange={(e) => setSelectedDimension(e.target.value)} className="bg-slate-50 border-none text-[10px] font-bold uppercase tracking-widest p-4 rounded-2xl outline-none text-indigo-600 shadow-inner font-bold">
                    {dimensionOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                </select>
            </div>
            <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoricalData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={140} fontSize={11} tick={{fill: '#475569', fontWeight: 700}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="count" radius={[0, 12, 12, 0]} barSize={24}>
                            {categoricalData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
