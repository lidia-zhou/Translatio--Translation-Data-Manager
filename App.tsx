import React, { useState, useMemo, useRef } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { BibEntry, ViewMode, Gender } from './types';
import { MOCK_DATA } from './constants';
import NetworkGraph from './components/NetworkGraph';
import StatsDashboard from './components/StatsDashboard';
import GlobalFlowBackground from './components/GlobalFlowBackground';
import { parseBibliographicData, generateInsights } from './services/geminiService';

// --- Welcome Screen Component ---
const WelcomeScreen = ({ onStart }: { onStart: () => void }) => (
  // Added bg-slate-900 as a fallback background color
  <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden text-white bg-slate-900">
    
    <GlobalFlowBackground />

    <div className="relative z-10 max-w-4xl animate-fadeIn">
      <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl mb-10 border border-white/10">
        <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white font-bold text-3xl serif shadow-lg shadow-indigo-500/50">T</div>
      </div>
      
      <h1 className="text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 mb-6 serif tracking-tight leading-tight drop-shadow-sm">
        Translatio
      </h1>
      
      <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
        The Digital Laboratory for Translation Studies.<br />
        <span className="text-sm md:text-base text-slate-400 mt-2 block">Map the circulation of world literature through AI-powered bibliographic management and network analysis.</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
        <button 
          onClick={onStart}
          className="group relative px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold rounded-2xl shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-105 flex items-center justify-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
          <span>Enter Laboratory</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {/* Glass Card 1 */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 transition-colors group">
          <div className="text-indigo-400 mb-4 bg-indigo-500/10 w-fit p-3 rounded-xl group-hover:scale-110 transition-transform">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h3 className="font-semibold text-white text-lg mb-2 serif">Data Ingestion</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Seamlessly import Excel archives or use AI to parse unstructured citations instantly.</p>
        </div>
        {/* Glass Card 2 */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 transition-colors group">
          <div className="text-blue-400 mb-4 bg-blue-500/10 w-fit p-3 rounded-xl group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <h3 className="font-semibold text-white text-lg mb-2 serif">Network Analysis</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Visualize the hidden connections between authors, translators, and publishing houses.</p>
        </div>
        {/* Glass Card 3 */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 transition-colors group">
          <div className="text-emerald-400 mb-4 bg-emerald-500/10 w-fit p-3 rounded-xl group-hover:scale-110 transition-transform">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <h3 className="font-semibold text-white text-lg mb-2 serif">AI Scholarship</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Automated insights on gender gaps, translation flows, and historical trends.</p>
        </div>
      </div>
    </div>
  </div>
);

// --- Footer Component ---
const Footer = () => (
  <footer className="bg-white border-t border-slate-200 mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex justify-center md:justify-start space-x-6 md:order-2">
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm">About Project</a>
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm">Methodology</a>
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm">Github</a>
        </div>
        <div className="mt-8 md:mt-0 md:order-1">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
             <span className="font-serif font-bold text-slate-700 text-lg">Translatio</span>
          </div>
          <p className="text-center md:text-left text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Digital Humanities Lab. Designed for Translation Studies Research.
          </p>
        </div>
      </div>
    </div>
  </footer>
);

// --- Manual Entry Form Initial State ---
const INITIAL_MANUAL_STATE = {
    title: '',
    originalTitle: '',
    publicationYear: new Date().getFullYear(),
    publisher: '',
    sourceLanguage: '',
    targetLanguage: '',
    authorName: '',
    authorGender: Gender.UNKNOWN,
    translatorName: '',
    translatorGender: Gender.UNKNOWN,
    city: ''
};

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [entries, setEntries] = useState<BibEntry[]>(MOCK_DATA);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'text' | 'file' | 'manual'>('manual');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [insights, setInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  
  // Manual Entry State
  const [manualForm, setManualForm] = useState(INITIAL_MANUAL_STATE);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleSmartAdd = async () => {
    if (!rawInput.trim()) return;
    setIsProcessing(true);
    try {
      const parsedData = await parseBibliographicData(rawInput);
      addEntryFromData(parsedData);
      setRawInput('');
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to parse", error);
      alert("Failed to interpret the text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualForm.title || !manualForm.authorName) {
        alert("Title and Author Name are required.");
        return;
    }
    const newEntry: BibEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: manualForm.title,
        originalTitle: manualForm.originalTitle,
        publicationYear: Number(manualForm.publicationYear) || 0,
        publisher: manualForm.publisher || "Unknown",
        city: manualForm.city,
        sourceLanguage: manualForm.sourceLanguage || "Unknown",
        targetLanguage: manualForm.targetLanguage || "Unknown",
        tags: [],
        author: {
            name: manualForm.authorName,
            gender: manualForm.authorGender as Gender,
        },
        translator: {
            name: manualForm.translatorName,
            gender: manualForm.translatorGender as Gender,
        }
    };
    setEntries(prev => [newEntry, ...prev]);
    setManualForm(INITIAL_MANUAL_STATE);
    setShowAddModal(false);
  };

  const addEntryFromData = (data: Partial<BibEntry>) => {
    const newEntry: BibEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: data.title || "Unknown Title",
      originalTitle: data.originalTitle,
      publicationYear: data.publicationYear || new Date().getFullYear(),
      originalPublicationYear: data.originalPublicationYear,
      publisher: data.publisher || "Unknown Publisher",
      city: data.city,
      sourceLanguage: data.sourceLanguage || "Unknown",
      targetLanguage: data.targetLanguage || "Unknown",
      tags: data.tags || [],
      author: {
        name: data.author?.name || "Unknown Author",
        gender: (data.author?.gender as Gender) || Gender.UNKNOWN,
        nationality: data.author?.nationality,
        birthYear: data.author?.birthYear,
        deathYear: data.author?.deathYear
      },
      translator: {
        name: data.translator?.name || "Unknown Translator",
        gender: (data.translator?.gender as Gender) || Gender.UNKNOWN,
        nationality: data.translator?.nationality,
        birthYear: data.translator?.birthYear,
        deathYear: data.translator?.deathYear
      }
    };
    setEntries(prev => [newEntry, ...prev]);
  };

  const handleGenerateInsights = async () => {
      setIsGeneratingInsights(true);
      try {
          const result = await generateInsights(entries);
          setInsights(result);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingInsights(false);
      }
  };

  const downloadTemplate = () => {
    const ws = utils.json_to_sheet([{
        "Title": "Example Book",
        "Original Title": "Original Book",
        "Author Name": "Jane Doe",
        "Author Gender": "Female",
        "Translator Name": "John Smith",
        "Translator Gender": "Male",
        "Publisher": "Academic Press",
        "Year": 2023,
        "Source Language": "French",
        "Target Language": "English"
    }]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "translatio_data_template.xlsx");
  };

  const handleExportData = () => {
    const ws = utils.json_to_sheet(entries.map(e => ({
        "Title": e.title,
        "Original Title": e.originalTitle,
        "Year": e.publicationYear,
        "Author": e.author.name,
        "Author Gender": e.author.gender,
        "Translator": e.translator.name,
        "Translator Gender": e.translator.gender,
        "Publisher": e.publisher,
        "Source": e.sourceLanguage,
        "Target": e.targetLanguage
    })));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Translatio_Export");
    writeFile(wb, "translatio_export_" + new Date().toISOString().slice(0,10) + ".xlsx");
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = utils.sheet_to_json(ws);
        
        // Process imported data
        const newEntries: BibEntry[] = data.map((row: any) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: row["Title"] || "Untitled",
            originalTitle: row["Original Title"],
            publicationYear: parseInt(row["Year"]) || 0,
            originalPublicationYear: row["Original Year"],
            publisher: row["Publisher"] || "Unknown",
            sourceLanguage: row["Source Language"] || "Unknown",
            targetLanguage: row["Target Language"] || "Unknown",
            city: row["City"],
            tags: [],
            author: {
                name: row["Author Name"] || "Unknown",
                gender: row["Author Gender"] as Gender || Gender.UNKNOWN,
                nationality: row["Author Nationality"]
            },
            translator: {
                name: row["Translator Name"] || "Unknown",
                gender: row["Translator Gender"] as Gender || Gender.UNKNOWN,
                nationality: row["Translator Nationality"]
            }
        }));

        setEntries(prev => [...newEntries, ...prev]); // Add to top
        setShowAddModal(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  // --- Render Helpers ---

  const tableRows = useMemo(() => entries.map(entry => (
    <tr key={entry.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors group">
      <td className="p-4">
        <div className="font-semibold text-slate-800 font-serif text-lg leading-tight">{entry.title}</div>
        {entry.originalTitle && <div className="text-sm text-slate-500 italic mt-0.5">{entry.originalTitle}</div>}
      </td>
      <td className="p-4">
        <div className="text-sm font-medium text-slate-800">{entry.author.name}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{entry.sourceLanguage}</div>
      </td>
      <td className="p-4">
        <div className="text-sm font-medium text-slate-800">{entry.translator.name}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{entry.targetLanguage}</div>
      </td>
      <td className="p-4 text-sm text-slate-600">
        <div className="flex flex-col">
            <span>{entry.publisher}</span>
            <span className="text-slate-400 text-xs">{entry.publicationYear}</span>
        </div>
      </td>
      <td className="p-4 text-right">
        <button 
          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
          className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
          title="Delete Entry"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  )), [entries]);

  if (!hasStarted) {
    return <WelcomeScreen onStart={() => setHasStarted(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setHasStarted(false)}>
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold serif">T</div>
             <h1 className="text-xl font-bold text-slate-900 tracking-tight serif">Translatio</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
                {(['list', 'network', 'stats'] as ViewMode[]).map((mode) => (
                <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    viewMode === mode 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
                ))}
            </nav>

            <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>

            <button 
                onClick={handleExportData}
                className="text-slate-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                title="Export Data to Excel"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>

            <button 
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Add Data</span>
                <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* View Layouts */}
        {viewMode === 'list' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                      <th className="p-4 w-1/3">Work</th>
                      <th className="p-4 w-1/6">Author</th>
                      <th className="p-4 w-1/6">Translator</th>
                      <th className="p-4 w-1/6">Details</th>
                      <th className="p-4 w-20 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.length > 0 ? tableRows : (
                      <tr>
                        <td colSpan={5} className="p-16 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span>No entries yet. Add citations or upload an Excel file.</span>
                            </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400 px-2">
              <span>Showing {entries.length} records</span>
              <span>Sorted by addition date</span>
            </div>
          </div>
        )}

        {viewMode === 'network' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 serif">Circulation Network</h2>
                    <p className="text-sm text-slate-500 mt-1">Interactive visualization of Authors, Translators, and Publishers.</p>
                  </div>
              </div>
              <NetworkGraph data={entries} />
            </div>
          </div>
        )}

        {viewMode === 'stats' && (
          <div className="space-y-6 animate-fadeIn">
             <div className="flex justify-between items-end mb-4 px-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 serif">Dataset Analytics</h2>
                    <p className="text-sm text-slate-500">Quantitative overview of the bibliographic collection.</p>
                </div>
                <button 
                  onClick={handleGenerateInsights}
                  disabled={isGeneratingInsights}
                  className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingInsights ? (
                      <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Analyzing...
                      </span>
                  ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        Generate AI Insights
                      </>
                  )}
                </button>
             </div>
             <StatsDashboard data={entries} insights={insights} />
          </div>
        )}
      </main>

      <Footer />

      {/* Add Data Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 serif">Add Bibliographic Data</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-slate-100 flex bg-slate-50">
                <button 
                    onClick={() => setModalTab('manual')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${modalTab === 'manual' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Manual Entry
                </button>
                <button 
                    onClick={() => setModalTab('text')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${modalTab === 'text' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    AI Text Paste
                </button>
                <button 
                    onClick={() => setModalTab('file')}
                    className={`flex-1 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${modalTab === 'file' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Excel Upload
                </button>
            </div>

            <div className="p-6 overflow-y-auto">
                {modalTab === 'text' && (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                            Paste Citation or Reference
                        </label>
                        <p className="text-xs text-slate-500">
                            Supports unstructured text. The AI will extract title, author, translator, publisher, and year automatically.
                        </p>
                        <textarea 
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder='e.g., "The Stranger by Albert Camus, translated by Stuart Gilbert, published by Knopf in 1946."'
                            className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none bg-slate-50"
                        />
                         <div className="flex justify-end pt-2">
                            <button 
                                onClick={handleSmartAdd}
                                disabled={isProcessing || !rawInput.trim()}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                {isProcessing ? 'Processing...' : 'Extract & Add Entry'}
                            </button>
                        </div>
                    </div>
                )}
                
                {modalTab === 'file' && (
                    <div className="space-y-6 text-center py-4">
                        <div className="space-y-2">
                            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-sm mb-4">
                                <p className="font-semibold mb-1">Step 1: Get the Template</p>
                                <button onClick={downloadTemplate} className="underline hover:text-indigo-900">Download Excel Template</button>
                            </div>
                            
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 transition-colors cursor-pointer relative">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls, .csv"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <p className="text-sm text-slate-600 font-medium">Click to upload or drag file here</p>
                                    <p className="text-xs text-slate-400 mt-1">.xlsx or .csv files supported</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {modalTab === 'manual' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title *</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                    value={manualForm.title}
                                    onChange={e => setManualForm({...manualForm, title: e.target.value})}
                                    placeholder="e.g. The Second Sex"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Original Title</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                                    value={manualForm.originalTitle}
                                    onChange={e => setManualForm({...manualForm, originalTitle: e.target.value})}
                                    placeholder="e.g. Le Deuxième Sexe"
                                />
                            </div>

                            {/* Author Section */}
                            <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Author Details</div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Name *</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm" 
                                        value={manualForm.authorName}
                                        onChange={e => setManualForm({...manualForm, authorName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Gender</label>
                                    <select 
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                        value={manualForm.authorGender}
                                        onChange={e => setManualForm({...manualForm, authorGender: e.target.value as Gender})}
                                    >
                                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Translator Section */}
                            <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Translator Details</div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm" 
                                        value={manualForm.translatorName}
                                        onChange={e => setManualForm({...manualForm, translatorName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Gender</label>
                                    <select 
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                        value={manualForm.translatorGender}
                                        onChange={e => setManualForm({...manualForm, translatorGender: e.target.value as Gender})}
                                    >
                                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Publisher</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                                    value={manualForm.publisher}
                                    onChange={e => setManualForm({...manualForm, publisher: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Year</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                                    value={manualForm.publicationYear}
                                    onChange={e => setManualForm({...manualForm, publicationYear: parseInt(e.target.value)})}
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source Lang</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                                    value={manualForm.sourceLanguage}
                                    onChange={e => setManualForm({...manualForm, sourceLanguage: e.target.value})}
                                    placeholder="e.g. French"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Target Lang</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm" 
                                    value={manualForm.targetLanguage}
                                    onChange={e => setManualForm({...manualForm, targetLanguage: e.target.value})}
                                    placeholder="e.g. English"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleManualSubmit}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                Add Entry
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;