
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BibEntry, ViewMode, Gender, ResearchBlueprint, Project } from './types';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import WorldMap from './components/WorldMap';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import { generateResearchBlueprint, generateInsights, geocodeLocation } from './services/geminiService';
import { SAMPLE_ENTRIES } from './constants';

const STORAGE_KEY_PROJECTS = 'translatio_master_v11';
const STORAGE_KEY_ACTIVE_ID = 'translatio_active_id';

const COMMON_LANGUAGES = [
  "English", "Chinese / 中文", "French / Français", "German / Deutsch", 
  "Spanish / Español", "Japanese / 日本語", "Russian / Русский", 
  "Italian / Italiano", "Portuguese", "Latin", "Ancient Greek"
];

const SYSTEM_FIELDS = [
    { key: 'title', label: 'Book Title / 书名', required: true },
    { key: 'authorName', label: 'Author Name / 作者', required: true },
    { key: 'translatorName', label: 'Translator Name / 译者', required: true },
    { key: 'publicationYear', label: 'Year / 年份', required: false },
    { key: 'publisher', label: 'Publisher / 出版社', required: false },
    { key: 'originalCity', label: 'Original City / 原著所在地', required: false },
    { key: 'city', label: 'Pub City / 出版地', required: false },
    { key: 'sourceLanguage', label: 'Source Lang / 源语', required: false },
    { key: 'targetLanguage', label: 'Target Lang / 目标语', required: false },
];

function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ACTIVE_ID));
  const [showProjectOverlay, setShowProjectOverlay] = useState(false);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  const [hasStarted, setHasStarted] = useState(() => !!activeProjectId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<BibEntry | null>(null);
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [importData, setImportData] = useState<any[] | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [statsInsights, setStatsInsights] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  }, [activeProjectId]);

  const handleReturnToWelcome = () => {
    setActiveProjectId(null);
    setHasStarted(false);
    setShowProjectOverlay(false);
    setViewMode('list');
  };

  const createNewProject = (name: string = "New Translation Archive") => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      lastModified: Date.now(),
      entries: [],
      blueprint: null,
      customColumns: []
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setShowProjectOverlay(false);
    return newProj;
  };

  const loadSampleProject = () => {
    const sampleProj: Project = {
      id: `sample-dglab-${Date.now()}`,
      name: "DGLAB 资助下的葡语文学全球传播研究",
      lastModified: Date.now(),
      entries: SAMPLE_ENTRIES,
      blueprint: {
        projectScope: "利用 DGLAB 官方资助目录，分析葡萄牙语文学在跨国流动中的制度化中介路径，特别关注安哥拉作家 Agualusa 的全球化网络。",
        suggestedSchema: [
            { fieldName: "Genre", description: "书籍类别（如童书、严肃文学）", analyticalUtility: "比较不同类别的资助成功率与传播广度", importance: "Critical" },
            { fieldName: "Apoios", description: "资助机构（DGLAB, Camões IP）", analyticalUtility: "映射政府机构在文学外交中的影响力", importance: "Critical" }
        ],
        dataCleaningStrategy: "合并同一出版集团的分社节点；标注安哥拉、莫桑比克作家的原产地坐标以区分于里斯本节点。",
        storageAdvice: "建议采用标准化的 CSV 或 JSON-LD 格式，以便进行跨平台链接分析。",
        methodology: "社会翻译学（Sociology of Translation）路径，聚焦布尔迪厄式的‘象征资本’在翻译中的转化。",
        visualizationStrategy: "使用 Force-Atlas-2 力导向布局展示中心-边缘动态，以及地理流向图展示文学流动的物质性。",
        collectionTips: "从 DGLAB 年度 PDF 中提取时，注意统一出版社名称（例如：Archipelago Books vs Archipelago）。"
      },
      customColumns: ["Genre", "Apoios"]
    };
    setProjects(prev => [sampleProj, ...prev]);
    setActiveProjectId(sampleProj.id);
    setHasStarted(true);
    setViewMode('network');
  };

  const updateActiveProject = (updates: Partial<Project>) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates, lastModified: Date.now() } : p));
  };

  const deleteProject = (id: string) => {
    if (confirm("确定永久删除此项目及其所有书目数据吗？此操作不可撤销。")) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setHasStarted(false);
      }
    }
  };

  const handleApplyBlueprint = () => {
    if (!activeProject?.blueprint) return;
    const fieldsToAdd = activeProject.blueprint.suggestedSchema.map(s => s.fieldName);
    updateActiveProject({ customColumns: Array.from(new Set([...activeProject.customColumns, ...fieldsToAdd])) });
    setViewMode('list');
    alert("研究维度已自动同步到您的书目数据库！");
  };

  const handleAddCustomField = () => {
    const fieldName = prompt("请输入新的研究维度（例如：性别、流派、赞助者）：");
    if (fieldName && activeProject) {
      if (!activeProject.customColumns.includes(fieldName)) {
        updateActiveProject({ customColumns: [...activeProject.customColumns, fieldName] });
      }
      if (editingEntry) {
        setEditingEntry({
          ...editingEntry,
          customMetadata: { ...editingEntry.customMetadata, [fieldName]: '' }
        });
      }
    }
  };

  const handleSaveEntry = async () => {
    if (!editingEntry || !activeProject) return;
    setIsSaving(true);
    
    let entryToSave = { ...editingEntry };
    const sourceLoc = editingEntry.originalCity || '';
    const targetLoc = editingEntry.city || '';
    
    if (sourceLoc || targetLoc) {
      try {
        const sourceCoord = await geocodeLocation(sourceLoc);
        const targetCoord = await geocodeLocation(targetLoc);
        entryToSave.customMetadata = {
          ...(editingEntry.customMetadata || {}),
          sourceCoord,
          targetCoord
        };
      } catch (e) {
        console.error("Geocoding failed", e);
      }
    }

    const entries = [...activeProject.entries];
    if (editingEntry.id === 'new') {
      entries.unshift({ ...entryToSave, id: `ent-${Date.now()}` });
    } else {
      const idx = entries.findIndex(x => x.id === editingEntry.id);
      if (idx !== -1) entries[idx] = entryToSave;
    }
    
    updateActiveProject({ entries });
    setEditingEntry(null);
    setIsSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        if (json.length > 0) {
          setAvailableHeaders(Object.keys(json[0] as object));
          setImportData(json);
          setShowImportMapper(true);
        } else {
          alert("Excel 文件似乎是空的。");
        }
      } catch (err) {
        alert("Excel 解析错误，请检查文件格式。");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleSyncImport = () => {
    if (!importData) return;
    const newEntries: BibEntry[] = importData.map((row, i) => ({
      id: `ent-${Date.now()}-${i}`,
      title: String(row[columnMapping['title']] || 'Untitled'),
      author: { name: String(row[columnMapping['authorName']] || 'Unknown'), gender: Gender.UNKNOWN },
      translator: { name: String(row[columnMapping['translatorName']] || 'Unknown'), gender: Gender.UNKNOWN },
      publicationYear: parseInt(row[columnMapping['publicationYear']]) || 0,
      publisher: String(row[columnMapping['publisher']] || ''),
      originalCity: String(row[columnMapping['originalCity']] || ''),
      city: String(row[columnMapping['city']] || ''),
      sourceLanguage: String(row[columnMapping['sourceLanguage']] || ''),
      targetLanguage: String(row[columnMapping['targetLanguage']] || ''),
      tags: [],
      customMetadata: { ...row }
    }));
    if (!activeProjectId) {
      const timestamp = new Date().toLocaleDateString();
      const newProj: Project = {
        id: `proj-${Date.now()}`,
        name: `Imported Archive ${timestamp}`,
        lastModified: Date.now(),
        entries: newEntries,
        blueprint: null,
        customColumns: []
      };
      setProjects(prev => [newProj, ...prev]);
      setActiveProjectId(newProj.id);
    } else {
      updateActiveProject({ entries: [...newEntries, ...(activeProject?.entries || [])] });
    }
    setShowImportMapper(false);
    setHasStarted(true);
    setImportData(null);
    setViewMode('list');
  };

  const ProjectManager = () => (
    <div className="fixed inset-0 bg-white/98 backdrop-blur-3xl z-[600] flex flex-col p-24 animate-fadeIn overflow-auto text-slate-900">
      <div className="max-w-7xl w-full mx-auto space-y-20">
        <div className="flex justify-between items-end border-b border-slate-100 pb-16">
          <div>
             <h2 className="text-8xl font-bold serif">Project Hub</h2>
             <p className="text-slate-400 font-serif italic text-2xl mt-6">管理您的所有翻译研究实验室与数据集。</p>
          </div>
          <button onClick={() => setShowProjectOverlay(false)} className="text-9xl font-light hover:text-rose-500 transition-colors leading-none">&times;</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {projects.map(p => (
            <div key={p.id} className="p-14 bg-white border border-slate-100 rounded-[5rem] shadow-sm hover:shadow-2xl transition-all group flex flex-col justify-between h-[450px] relative">
              <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="absolute top-12 right-12 text-slate-200 hover:text-rose-500 text-5xl font-light transition-colors z-20">&times;</button>
              <div className="space-y-8">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner">📓</div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Lab Name</label>
                   <input className="w-full text-3xl font-bold serif bg-transparent border-none outline-none focus:bg-slate-50 p-3 rounded-2xl transition-all" value={p.name} onChange={(e) => setProjects(projects.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} />
                </div>
                <div className="flex gap-4">
                   <span className="px-6 py-3 bg-slate-50 text-[11px] font-bold uppercase text-slate-400 rounded-full">{p.entries.length} 记录</span>
                </div>
              </div>
              <button onClick={() => { setActiveProjectId(p.id); setHasStarted(true); setShowProjectOverlay(false); setViewMode('list'); }} className="w-full py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl">Open Laboratory</button>
            </div>
          ))}
          <button onClick={() => createNewProject()} className="p-12 border-4 border-dashed border-slate-50 rounded-[5rem] text-slate-200 hover:text-indigo-400 hover:border-indigo-100 transition-all flex flex-col items-center justify-center gap-8 h-[450px] group">
            <span className="text-8xl group-hover:scale-110 transition-transform">+</span>
            <span className="text-sm font-black uppercase tracking-[0.3em]">New Project</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!hasStarted && !showImportMapper) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <GlobalFlowBackground />
        <div className="relative z-10 max-w-6xl w-full text-center animate-fadeIn space-y-16">
          <div className="w-28 h-28 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white font-serif font-bold text-6xl shadow-2xl mx-auto mb-10 transform -rotate-3 hover:rotate-0 transition-transform">T</div>
          <div className="space-y-6">
            <h1 className="text-9xl font-bold serif text-slate-900 tracking-tighter">Translatio</h1>
            <p className="text-2xl text-slate-500 font-serif max-w-4xl mx-auto italic leading-relaxed">翻译研究数据中心：面向学者的书目编目与网络分析实验室。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full mt-24">
            <button onClick={() => { createNewProject("AI 研究课题实验室"); setViewMode('blueprint'); setHasStarted(true); }} className="group bg-white p-14 rounded-[4rem] border border-slate-100 hover:border-indigo-400 hover:shadow-2xl transition-all text-left">
              <div className="text-6xl mb-8">📐</div>
              <h3 className="text-3xl font-bold mb-4 serif">AI Architect</h3>
              <p className="text-sm text-slate-500">AI 辅助定义研究视角、数据存储与分析方法。</p>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="group bg-white p-14 rounded-[4rem] border border-slate-100 hover:border-emerald-400 hover:shadow-2xl transition-all text-left">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
              <div className="text-6xl mb-8">📊</div>
              <h3 className="text-3xl font-bold mb-4 serif">Excel Import</h3>
              <p className="text-sm text-slate-500">批量录入现有书目数据集。</p>
            </button>
            <button onClick={loadSampleProject} className="group bg-white p-14 rounded-[4rem] border border-slate-100 hover:border-amber-400 hover:shadow-2xl transition-all text-left ring-4 ring-amber-100 ring-offset-8">
              <div className="text-6xl mb-8">📖</div>
              <h3 className="text-3xl font-bold mb-4 serif">Sample: DGLAB</h3>
              <p className="text-sm text-slate-500">加载官方资助目录（60+ 记录，强关联网络）。</p>
            </button>
          </div>
          <div className="pt-20 border-t border-slate-50 flex gap-6 justify-center">
             <button onClick={() => setShowProjectOverlay(true)} className="px-12 py-6 bg-slate-900 text-white rounded-[2.5rem] text-sm font-bold shadow-2xl flex items-center gap-4">📁 管理已有项目 ({projects.length})</button>
          </div>
        </div>
        {showProjectOverlay && <ProjectManager />}
      </div>
    );
  }

  if (showImportMapper && importData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full bg-white rounded-[4rem] shadow-2xl p-20 space-y-12 animate-slideUp">
          <div className="text-center">
            <h2 className="text-4xl font-bold serif mb-4">Batch Mapping / 字段映射</h2>
            <p className="text-slate-400 font-serif italic">将 Excel 列对齐至研究数据库，确保“源语”与“目标语”正确关联。</p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            {SYSTEM_FIELDS.map(f => (
              <div key={f.key} className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{f.label} {f.required && <span className="text-rose-500">*</span>}</label>
                <select className="w-full bg-slate-50 p-5 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-300 transition-all appearance-none cursor-pointer text-sm font-bold" value={columnMapping[f.key] || ''} onChange={e => setColumnMapping({...columnMapping, [f.key]: e.target.value})}>
                  <option value="">-- 跳过 (Skip) --</option>
                  {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-10">
            <button onClick={() => { setShowImportMapper(false); setImportData(null); }} className="px-12 py-7 bg-slate-100 text-slate-400 rounded-3xl font-bold">取消</button>
            <button onClick={handleSyncImport} className="flex-1 py-7 bg-slate-900 text-white rounded-3xl font-bold text-xl shadow-2xl hover:bg-indigo-600 transition-all">同步存档 ({importData.length} 记录)</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30 flex flex-col font-sans">
      <header className="bg-white/95 backdrop-blur-3xl border-b border-slate-100 h-24 flex items-center shrink-0 px-12 sticky top-0 z-[200]">
        <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
             <button onClick={handleReturnToWelcome} className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all text-xl" title="回到欢迎页">🏠</button>
             <div className="flex items-center gap-6 cursor-pointer group" onClick={() => setShowProjectOverlay(true)}>
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold serif text-3xl shadow-xl group-hover:scale-110 transition-transform">T</div>
                <div className="hidden lg:block">
                   <h1 className="text-xl font-bold text-slate-800 serif leading-none">Translatio</h1>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{activeProject?.name}</p>
                </div>
             </div>
          </div>
          <nav className="flex space-x-2 bg-slate-100 p-2 rounded-[2rem]">
            {[
              { id: 'list', label: 'Archive' },
              { id: 'network', label: 'Network Lab' },
              { id: 'stats', label: 'Analytics' },
              { id: 'map', label: 'Global Map' },
              { id: 'blueprint', label: 'Blueprint' }
            ].map((m) => (
              <button key={m.id} onClick={() => setViewMode(m.id as any)} className={`px-10 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-[1.8rem] transition-all ${viewMode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                {m.label}
              </button>
            ))}
          </nav>
          <div className="flex gap-6">
             <button onClick={() => setEditingEntry({ id: 'new', title: '', author: {name: '', gender: Gender.UNKNOWN}, translator: {name: '', gender: Gender.UNKNOWN}, publicationYear: 2024, publisher: '', sourceLanguage: '', targetLanguage: '', tags: [], customMetadata: {} })} className="bg-slate-900 text-white px-10 py-3.5 rounded-2xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-2xl">+ New Entry</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'blueprint' ? (
           <div className="flex-1 overflow-y-auto p-20 bg-slate-50/50 flex flex-col items-center">
              {!activeProject?.blueprint ? (
                 <div className="max-w-3xl w-full bg-white p-20 rounded-[5rem] shadow-2xl space-y-16 animate-slideUp">
                    <div className="text-center space-y-6">
                       <h2 className="text-5xl font-bold serif">Describe Research Context</h2>
                       <p className="text-slate-400 font-serif italic text-xl">输入您的研究课题，AI 将为您策划完整的研究蓝图。</p>
                    </div>
                    <textarea className="w-full h-56 p-10 bg-slate-50 rounded-[3rem] outline-none text-xl font-serif border border-transparent focus:border-indigo-100" placeholder="例如：19世纪末期，欧洲文学在中国的译介网络与权力动态分析..." value={projectInput} onChange={e => setProjectInput(e.target.value)} />
                    <button onClick={async () => {
                        setIsArchitecting(true);
                        try {
                            const bp = await generateResearchBlueprint(projectInput);
                            updateActiveProject({ blueprint: bp, name: bp.projectScope });
                        } catch(e) { alert("AI 分析请求失败，请稍后再试。"); }
                        setIsArchitecting(false);
                    }} disabled={isArchitecting || !projectInput.trim()} className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-bold text-2xl shadow-2xl">
                        {isArchitecting ? "Architecting your Laboratory..." : "Generate Research Blueprint"}
                    </button>
                 </div>
              ) : (
                <div className="max-w-6xl w-full bg-white p-24 rounded-[6rem] shadow-2xl space-y-20 animate-fadeIn relative">
                   <div className="space-y-6 border-b border-slate-100 pb-16">
                      <h2 className="text-6xl font-bold serif leading-tight">{activeProject.blueprint.projectScope}</h2>
                      <div className="flex gap-4">
                         <span className="px-6 py-3 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full">AI Architect Proposal</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                      <div className="space-y-12">
                         <section className="space-y-4">
                            <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">01 Methodology / 分析方法</h4>
                            <p className="text-xl text-slate-700 leading-relaxed font-serif italic">{activeProject.blueprint.methodology}</p>
                         </section>
                         <section className="space-y-4">
                            <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">02 Storage / 存储建议</h4>
                            <p className="text-xl text-slate-700 leading-relaxed font-serif italic">{activeProject.blueprint.storageAdvice}</p>
                         </section>
                         <section className="space-y-4">
                            <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">03 Collection / 收集建议</h4>
                            <p className="text-xl text-slate-700 leading-relaxed font-serif italic">{activeProject.blueprint.collectionTips}</p>
                         </section>
                      </div>

                      <div className="space-y-12 bg-slate-50/50 p-12 rounded-[4rem] border border-slate-100 shadow-inner">
                         <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-indigo-400">Suggested Variables / 建议变量</h4>
                         <div className="space-y-6">
                            {activeProject.blueprint.suggestedSchema.map((s, idx) => (
                               <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-lg font-bold text-slate-900 serif">{s.fieldName}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${s.importance === 'Critical' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-400'}`}>{s.importance}</span>
                                  </div>
                                  <p className="text-sm text-slate-500">{s.description}</p>
                                  <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter mt-2">{s.analyticalUtility}</p>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>

                   <section className="space-y-4 bg-slate-900 p-16 rounded-[4rem] text-white">
                        <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-indigo-300">04 Visualization Strategy / 可视化方案</h4>
                        <p className="text-2xl font-serif italic leading-relaxed">{activeProject.blueprint.visualizationStrategy}</p>
                   </section>

                   <div className="pt-20 border-t border-slate-100 flex gap-8">
                      <button onClick={() => updateActiveProject({ blueprint: null })} className="px-12 py-8 bg-slate-100 text-slate-400 rounded-[3rem] font-bold uppercase text-xs tracking-widest">Discard & Re-design</button>
                      <button onClick={handleApplyBlueprint} className="flex-1 py-8 bg-indigo-600 text-white rounded-[3rem] font-bold text-2xl shadow-2xl hover:bg-indigo-700 transition-all">Apply Data Schema & Start Archiving</button>
                   </div>
                </div>
              )}
           </div>
        ) : viewMode === 'network' ? (
           <div className="flex-1 overflow-hidden">
             <NetworkGraph data={activeProject?.entries || []} customColumns={activeProject?.customColumns || []} blueprint={activeProject?.blueprint || null} onDataUpdate={(newEntries) => updateActiveProject({ entries: newEntries })} />
           </div>
        ) : viewMode === 'stats' ? (
           <div className="flex-1 overflow-y-auto"><StatsDashboard data={activeProject?.entries || []} insights={statsInsights} onGenerateInsights={async () => { setIsAnalyzing(true); try { setStatsInsights(await generateInsights(activeProject?.entries || [])); } finally { setIsAnalyzing(false); } }} isAnalyzing={isAnalyzing} customColumns={activeProject?.customColumns || []} /></div>
        ) : viewMode === 'map' ? (
           <div className="flex-1 overflow-hidden"><WorldMap data={activeProject?.entries || []} /></div>
        ) : (
           <div className="p-12 space-y-12 animate-fadeIn flex-1 overflow-auto">
              <div className="max-w-[1920px] mx-auto w-full flex items-center gap-8">
                 <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-12 flex items-center pointer-events-none text-slate-300">🔍</div>
                    <input type="text" placeholder="Search archive..." className="w-full pl-24 pr-12 py-8 bg-white border border-slate-100 rounded-[3rem] outline-none shadow-sm focus:ring-8 focus:ring-indigo-500/5 transition-all text-2xl serif" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                 </div>
                 {selectedEntryIds.size > 0 && (
                   <button onClick={() => { if(confirm("确定删除所选？")) updateActiveProject({ entries: activeProject!.entries.filter(e => !selectedEntryIds.has(e.id)) }); setSelectedEntryIds(new Set()); }} className="bg-rose-50 text-rose-600 px-12 py-8 rounded-[3rem] font-bold border border-rose-100 shadow-sm animate-slideUp">Delete Selected ({selectedEntryIds.size})</button>
                 )}
              </div>
              
              <div className="bg-white rounded-[5rem] border border-slate-100 overflow-hidden shadow-2xl max-w-[1920px] mx-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 text-[11px] font-black uppercase text-slate-400 tracking-[0.25em] border-b border-slate-100">
                      <tr>
                        <th className="p-12 w-20"><input type="checkbox" onChange={(e) => setSelectedEntryIds(e.target.checked ? new Set(activeProject!.entries.map(x => x.id)) : new Set())} /></th>
                        <th className="p-12">Bibliographic Title</th>
                        <th className="p-12">Author</th>
                        <th className="p-12">Translator</th>
                        <th className="p-12 text-center">Year</th>
                        {activeProject?.customColumns.map(c => <th key={c} className="p-12 text-indigo-400">{c}</th>)}
                        <th className="p-12 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-serif">
                      {activeProject?.entries.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                        <tr key={e.id} className={`hover:bg-indigo-50/10 transition-colors group ${selectedEntryIds.has(e.id) ? 'bg-indigo-50/20' : ''}`}>
                          <td className="p-12"><input type="checkbox" checked={selectedEntryIds.has(e.id)} onChange={() => { const n = new Set(selectedEntryIds); if(n.has(e.id)) n.delete(e.id); else n.add(e.id); setSelectedEntryIds(n); }} /></td>
                          <td className="p-12 font-bold text-slate-800 text-3xl cursor-pointer hover:text-indigo-600 transition-all" onClick={() => setEditingEntry(e)}>{e.title}</td>
                          <td className="p-12 text-slate-600 text-xl">{e.author.name}</td>
                          <td className="p-12 text-indigo-600 text-xl">{e.translator.name}</td>
                          <td className="p-12 text-center text-slate-400 font-mono text-xl">{e.publicationYear}</td>
                          {activeProject?.customColumns.map(c => <td key={c} className="p-12 text-sm text-indigo-300 font-mono">{e.customMetadata?.[c] || '—'}</td>)}
                          <td className="p-12 text-center"><button onClick={() => updateActiveProject({ entries: activeProject!.entries.filter(x => x.id !== e.id) })} className="text-slate-200 hover:text-rose-500 text-4xl leading-none">&times;</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {activeProject?.entries.length === 0 && (
                      <div className="p-40 text-center space-y-6">
                          <p className="text-7xl">🗂️</p>
                          <p className="text-slate-400 font-serif italic text-2xl">归档库为空，请开始著录或导入。</p>
                      </div>
                  )}
              </div>
           </div>
        )}
      </main>

      {showProjectOverlay && <ProjectManager />}

      {editingEntry && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-3xl z-[500] flex items-center justify-center p-12 animate-fadeIn">
              <div className="bg-white rounded-[6rem] shadow-2xl max-w-7xl w-full p-24 flex flex-col gap-16 overflow-hidden border border-white/20">
                  <div className="space-y-4">
                    <h3 className="text-6xl font-bold serif text-slate-900">{editingEntry.id === 'new' ? 'Archive New Record' : 'Edit Entry Metadata'}</h3>
                    <p className="text-slate-400 font-serif italic text-2xl mt-4">精细化著录与多维度研究属性管理</p>
                  </div>
                  <div className="grid grid-cols-2 gap-12 max-h-[60vh] overflow-y-auto pr-8 custom-scrollbar">
                      <div className="col-span-2 space-y-4">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] pl-6">Full Work Title / 完整书名</label>
                          <input className="w-full p-8 bg-slate-50 rounded-[3rem] outline-none text-3xl serif border border-transparent focus:border-indigo-100" value={editingEntry.title} onChange={e => setEditingEntry({...editingEntry, title: e.target.value})} />
                      </div>
                      <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] pl-6">Primary Author</label>
                          <input className="w-full p-6 bg-slate-50 rounded-[2.2rem] outline-none text-xl" value={editingEntry.author.name} onChange={e => setEditingEntry({...editingEntry, author: {...editingEntry.author, name: e.target.value}})} />
                      </div>
                      <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] pl-6">Translator</label>
                          <input className="w-full p-6 bg-slate-50 rounded-[2.2rem] outline-none text-xl text-indigo-600" value={editingEntry.translator.name} onChange={e => setEditingEntry({...editingEntry, translator: {...editingEntry.translator, name: e.target.value}})} />
                      </div>
                      <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] pl-6">Pub Year</label>
                          <input type="number" className="w-full p-6 bg-slate-50 rounded-[2.2rem] outline-none text-xl" value={editingEntry.publicationYear} onChange={e => setEditingEntry({...editingEntry, publicationYear: parseInt(e.target.value) || 0})} />
                      </div>
                      <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] pl-6">Publisher / 出版社</label>
                          <input className="w-full p-6 bg-slate-50 rounded-[2.2rem] outline-none text-xl" value={editingEntry.publisher} onChange={e => setEditingEntry({...editingEntry, publisher: e.target.value})} />
                      </div>
                      {activeProject?.customColumns.map(c => (
                        <div key={c} className="space-y-4">
                            <label className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.3em] pl-6">{c}</label>
                            <input className="w-full p-6 bg-indigo-50/30 rounded-[2.2rem] outline-none border border-indigo-100 focus:bg-white text-xl font-bold" value={editingEntry.customMetadata?.[c] || ''} onChange={e => setEditingEntry({...editingEntry, customMetadata: {...editingEntry.customMetadata, [c]: e.target.value}})} />
                        </div>
                      ))}
                      <div className="pt-10 flex items-center col-span-2 border-t border-slate-50">
                          <button onClick={handleAddCustomField} className="text-indigo-600 font-black uppercase text-[12px] tracking-[0.3em] hover:underline flex items-center gap-4">+ Add Research Dimension / 增加研究维度</button>
                      </div>
                  </div>
                  <div className="flex gap-8 pt-12 border-t border-slate-50">
                      <button onClick={() => setEditingEntry(null)} className="px-20 py-8 bg-slate-100 rounded-[3rem] text-[12px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Cancel</button>
                      <button onClick={handleSaveEntry} disabled={isSaving} className="flex-1 py-8 bg-slate-900 text-white rounded-[3rem] font-bold text-2xl shadow-2xl hover:bg-indigo-600 transition-all">
                        {isSaving ? "Geocoding & Archiving..." : "Archive Metadata"}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
