
import React, { useState } from 'react';
import { ResearchBlueprint, ResearchDimension } from '../types';
import { generateResearchBlueprint } from '../services/geminiService';

interface TheoryLabProps {
  onClose: () => void;
  onApplyBlueprint: (blueprint: ResearchBlueprint) => void;
}

const DIMENSION_MAP: Record<string, { en: string, zh: string, icon: string }> = {
  'Agentive (Who)': { en: 'Agentive (Who)', zh: '行动主体维度', icon: '👤' },
  'Textual (What)': { en: 'Textual (What)', zh: '文本特质维度', icon: '📜' },
  'Distributional (Where/When/How)': { en: 'Distributional', zh: '空间流转维度', icon: '📍' },
  'Discursive (Why)': { en: 'Discursive (Why)', zh: '话语建构维度', icon: '💬' },
  'Reception (So what)': { en: 'Reception', zh: '社会接受维度', icon: '🗣️' }
};

const getDimensionLabel = (dimName: string) => {
  // Direct match
  if (DIMENSION_MAP[dimName]) return DIMENSION_MAP[dimName];
  
  // Fuzzy match based on keywords
  const lower = dimName.toLowerCase();
  if (lower.includes('who') || lower.includes('agent')) return DIMENSION_MAP['Agentive (Who)'];
  if (lower.includes('what') || lower.includes('text')) return DIMENSION_MAP['Textual (What)'];
  if (lower.includes('where') || lower.includes('when') || lower.includes('how') || lower.includes('distrib')) return DIMENSION_MAP['Distributional (Where/When/How)'];
  if (lower.includes('why') || lower.includes('discurs')) return DIMENSION_MAP['Discursive (Why)'];
  if (lower.includes('recept') || lower.includes('so what') || lower.includes('impact')) return DIMENSION_MAP['Reception (So what)'];
  
  return { en: dimName, zh: '扩展维度', icon: '🔬' };
};

const TheoryLab: React.FC<TheoryLabProps> = ({ onClose, onApplyBlueprint }) => {
  const [query, setQuery] = useState('19th sinologist translators\' scholarship');
  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<ResearchBlueprint | null>(null);

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setIsGenerating(true);
    try {
      const bp = await generateResearchBlueprint(query);
      setBlueprint(bp);
    } catch (e) {
      alert("AI generation failed. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[900] flex flex-col animate-fadeIn select-none overflow-hidden font-sans">
      <header className="px-12 py-8 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-xl flex items-center justify-center text-slate-400 text-xl transition-all shadow-sm">🏠</button>
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">🔬</div>
          <div className="space-y-0.5">
            <h1 className="text-3xl font-bold text-slate-900 serif leading-none">TAD Lab</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1">Translation as Data framework application</p>
          </div>
        </div>
        <button onClick={onClose} className="text-5xl text-slate-200 hover:text-slate-900 transition-colors leading-none">&times;</button>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-50/20 px-12 py-10 space-y-12 custom-scrollbar">
        <div className="max-w-[1400px] mx-auto bg-white rounded-[2.5rem] p-12 shadow-sm border border-slate-200 flex flex-col gap-10">
          <div className="space-y-4 text-left">
            <label className="block">
              <span className="text-[11px] font-black uppercase text-slate-900 tracking-widest block">Research Inquiry / 研究课题</span>
            </label>
            <textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-32 bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-2xl font-serif italic text-slate-800 outline-none focus:ring-8 ring-indigo-50 transition-all resize-none shadow-inner"
              placeholder="e.g., 'Retranslation of Camões in 20th Century China'..."
            />
          </div>
          <div className="flex justify-end">
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !query.trim()}
              className="px-16 py-6 bg-slate-900 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-2xl active:scale-95"
            >
              {isGenerating ? 'ANALYZING...' : 'PLAN TAD STRATEGY →'}
            </button>
          </div>
        </div>

        {(blueprint || isGenerating) && (
          <div className="max-w-[1400px] mx-auto space-y-10 animate-slideUp pb-32">
            <div className="flex items-center gap-6">
               <div className="h-px bg-slate-200 flex-1"></div>
               <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.6em] whitespace-nowrap">TAD Matrix Strategy Board</h3>
               <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {isGenerating ? (
               <div className="bg-white rounded-[4rem] p-32 border border-slate-200 flex flex-col items-center justify-center gap-8 shadow-sm">
                  <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                  <p className="text-2xl font-serif italic text-slate-400">Constructing Dynamic Research Matrix...</p>
               </div>
            ) : (
              <div className="space-y-6">
                {blueprint?.dimensions.map((dim, idx) => {
                  const label = getDimensionLabel(dim.dimension);
                  return (
                    <div key={idx} className="bg-white rounded-3xl border border-slate-200 flex items-stretch overflow-hidden hover:shadow-2xl transition-all border-l-8 border-l-transparent hover:border-l-emerald-500 group">
                      <div className="w-64 bg-slate-50/50 flex flex-col items-center justify-center p-10 shrink-0 border-r border-slate-100 group-hover:bg-slate-50 transition-colors">
                          <div className="text-4xl mb-4 bg-white w-20 h-20 rounded-3xl flex items-center justify-center shadow-inner border border-slate-50">{label.icon}</div>
                          <h4 className="text-xl font-bold text-slate-800 serif text-center leading-tight">{label.zh}</h4>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">{label.en}</span>
                      </div>
                      <div className="flex-1 p-12 grid grid-cols-1 md:grid-cols-3 gap-16 items-start">
                          <div className="space-y-5">
                              <h5 className="text-[11px] font-black uppercase text-emerald-600 tracking-widest">Key Question</h5>
                              <p className="text-2xl font-serif font-semibold text-slate-900 leading-snug tracking-tight">{dim.coreQuestion}</p>
                          </div>
                          <div className="space-y-5">
                              <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Archival Sources</h5>
                              <div className="flex flex-wrap gap-3">
                                  {dim.dataSources.map(s => <span key={s} className="px-5 py-2.5 bg-slate-100 text-[11px] font-bold text-slate-500 rounded-xl border border-slate-200/40">{s}</span>)}
                              </div>
                          </div>
                          <div className="space-y-5">
                              <h5 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">DH Methods</h5>
                              <div className="flex flex-wrap gap-3">
                                  {dim.dhMethods.map(m => <span key={m} className="px-5 py-2.5 bg-slate-900 text-[10px] font-black uppercase text-white rounded-xl tracking-tighter shadow-lg">{m}</span>)}
                              </div>
                          </div>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-24 p-20 bg-white rounded-[4.5rem] border border-slate-200 shadow-sm space-y-16">
                   <div className="text-center space-y-4">
                      <h5 className="text-[12px] font-black uppercase text-emerald-600 tracking-[0.5em]">TAD Synthesis</h5>
                      <h2 className="text-6xl font-bold text-slate-900 serif leading-tight max-w-5xl mx-auto italic tracking-tight">
                        "{blueprint?.methodology}"
                      </h2>
                   </div>
                </div>

                <div className="flex justify-center pt-24 pb-20">
                    <button 
                      onClick={() => blueprint && onApplyBlueprint(blueprint)}
                      className="px-24 py-10 bg-slate-900 text-white rounded-[3.5rem] font-bold text-sm uppercase tracking-[0.5em] hover:bg-emerald-600 transition-all shadow-2xl hover:scale-105 active:scale-95 ring-[12px] ring-emerald-50"
                    >
                        Apply TAD Framework →
                    </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TheoryLab;
