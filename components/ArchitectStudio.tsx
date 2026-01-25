
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { architectDatabaseSchema, ArchitectOutput, SchemaField } from '../services/geminiService';

interface ArchitectStudioProps {
  onClose: () => void;
  onDeploy: (output: ArchitectOutput) => void;
}

const ArchitectStudio: React.FC<ArchitectStudioProps> = ({ onClose, onDeploy }) => {
  const [prompt, setPrompt] = useState('');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [output, setOutput] = useState<ArchitectOutput | null>(null);

  const handleBuild = async () => {
    if (!prompt.trim()) return;
    setIsArchitecting(true);
    try {
      const result = await architectDatabaseSchema(prompt);
      setOutput(result);
    } catch (e) {
      alert("Failed to build schema. Check API Key.");
    } finally {
      setIsArchitecting(false);
    }
  };

  const downloadTemplate = () => {
    if (!output) return;
    
    // Core standard headers plus the custom ones identified by AI
    const headers = [
      'Title', 'Author', 'Year', 'Publisher', 'City', 'Province', 'SourceLang', 'TargetLang',
      ...output.schema.map(f => f.name)
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Translation Data Template");
    
    XLSX.writeFile(workbook, `${output.projectName.replace(/\s+/g, '_')}_Template.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-[#0a192f] z-[950] flex flex-col animate-fadeIn overflow-hidden text-white font-mono">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '200px 200px' }}></div>

      <header className="px-12 py-8 flex items-center justify-between border-b border-white/10 shrink-0 relative z-10 bg-[#0a192f]/80 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 border-2 border-dashed border-indigo-400 rounded-xl flex items-center justify-center text-indigo-400 text-3xl font-bold">A</div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">AI Architect Studio</h1>
            <p className="text-[10px] text-indigo-300 uppercase font-black tracking-[0.3em]">Translation Database Structural Engineering</p>
          </div>
        </div>
        <button onClick={onClose} className="text-5xl font-light hover:text-rose-500 transition-colors">&times;</button>
      </header>

      <main className="flex-1 overflow-y-auto p-12 relative z-10 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-12">
          {!output && !isArchitecting ? (
            <div className="space-y-10 py-20 animate-slideUp">
               <div className="space-y-4 max-w-2xl">
                  <h2 className="text-4xl font-bold text-white serif">Initialize New Project Architecture</h2>
                  <p className="text-slate-400 text-sm leading-relaxed font-sans italic">
                    Describe your archival collection or translation phenomenon. The Architect will engineer a custom database schema, normalization rules, and research metadata tags.
                  </p>
               </div>
               <div className="space-y-6">
                 <textarea 
                   value={prompt} 
                   onChange={e => setPrompt(e.target.value)}
                   placeholder="e.g. A collection of 19th-century missionary translations with detailed notes on printing techniques and censorship instances..."
                   className="w-full h-48 bg-white/5 border border-white/10 rounded-3xl p-8 text-xl font-sans text-indigo-100 outline-none focus:ring-4 ring-indigo-500/20 transition-all resize-none shadow-2xl"
                 />
                 <button 
                   onClick={handleBuild}
                   className="px-12 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.4em] transition-all shadow-3xl shadow-indigo-500/20 active:scale-95"
                 >
                   Generate Structural Blueprint →
                 </button>
               </div>
            </div>
          ) : isArchitecting ? (
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-pulse">
                <div className="w-24 h-24 border-t-4 border-l-4 border-indigo-500 rounded-full animate-spin"></div>
                <p className="text-xl tracking-widest uppercase font-black text-indigo-400">Engineering Schema Matrics...</p>
                <div className="text-[10px] text-slate-500 flex gap-4">
                    <span>GEN_TABLE_V1.0</span>
                    <span>NORMALIZING_ENTITIES</span>
                    <span>MAPPING_DH_RELATIONS</span>
                </div>
            </div>
          ) : (
            <div className="space-y-12 animate-fadeIn pb-24">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-8">
                     <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 space-y-8">
                        <div className="flex items-center justify-between border-b border-white/10 pb-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Database Schema / 数据库架构</h3>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">{output.schema.length} Fields Defined</span>
                        </div>
                        <div className="space-y-4">
                           {output.schema.map((field, idx) => (
                             <div key={idx} className="group p-6 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all hover:bg-white/10 flex items-start gap-6">
                                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center font-bold text-xs text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">{idx + 1}</div>
                                <div className="flex-1 space-y-2">
                                   <div className="flex items-center gap-4">
                                      <span className="text-lg font-bold text-white">{field.name}</span>
                                      <span className="px-2 py-0.5 bg-slate-800 text-[8px] rounded uppercase font-black text-slate-400 tracking-tighter">{field.type}</span>
                                      {field.isGisRelated && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black">GIS_SUPPORT</span>}
                                   </div>
                                   <p className="text-[10px] text-slate-400 font-sans italic">{field.description}</p>
                                   <div className="pt-2 flex items-center gap-2">
                                      <span className="text-[8px] font-black text-indigo-500 uppercase">Utility:</span>
                                      <span className="text-[9px] text-slate-300 font-sans">{field.scholarlyPurpose}</span>
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-8">
                     <div className="bg-indigo-600 rounded-[3rem] p-10 shadow-3xl text-white space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-100">Project Identity</h3>
                        <h2 className="text-3xl font-bold serif leading-tight">{output.projectName}</h2>
                        <div className="h-px bg-white/20"></div>
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Data Entry Protocol</h4>
                            <p className="text-xs font-sans italic leading-relaxed text-indigo-50/80">{output.dataEntryProtocol}</p>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <button 
                          onClick={downloadTemplate}
                          className="w-full py-6 bg-white/10 border border-white/20 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-white/20 transition-all flex items-center justify-center gap-3"
                        >
                          <span>📥</span> Download Excel Template
                        </button>
                        <button 
                          onClick={() => onDeploy(output)}
                          className="w-full py-8 bg-white text-[#0a192f] rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-400 transition-all active:scale-95"
                        >
                          Deploy Engineering Plan
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ArchitectStudio;
