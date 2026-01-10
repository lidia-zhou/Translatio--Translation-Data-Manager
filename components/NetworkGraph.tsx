
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as XLSX from 'xlsx';
import { BibEntry, GraphNode, GraphLink, AdvancedGraphMetrics, NodeSizeMetric, NetworkConfig, ResearchBlueprint, LayoutType, ColorMode, EdgeType } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: ResearchBlueprint | null;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;
const COMMUNITY_COLORS = d3.schemeObservable10;
const EDGE_COLORS: Record<EdgeType, string> = {
    TRANSLATION: '#6366f1', // Indigo
    PUBLICATION: '#10b981', // Emerald
    COLLABORATION: '#f59e0b', // Amber
    GEOGRAPHIC: '#94a3b8', // Slate
    LINGUISTIC: '#ec4899', // Pink
    CUSTOM: '#cbd5e1'
};

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns, blueprint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [layoutType, setLayoutType] = useState<LayoutType>('forceAtlas2');

  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName', 'publisher'], 
    isDirected: true,
    edgeWeightBy: 'frequency',
    colorMode: 'category',
    enabledEdgeTypes: ['TRANSLATION', 'PUBLICATION', 'COLLABORATION']
  });

  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [minSize, setMinSize] = useState(12);
  const [maxSize, setMaxSize] = useState(60);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const availableAttributes = useMemo(() => [
    { id: 'authorName', label: 'Author / 著者' },
    { id: 'translatorName', label: 'Translator / 译者' },
    { id: 'publisher', label: 'Publisher / 出版社' },
    { id: 'city', label: 'City / 城市' },
    { id: 'sourceLanguage', label: 'Source Lang / 源语' },
    { id: 'targetLanguage', label: 'Target Lang / 目标语' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c }))
  ], [customColumns]);

  const graph = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, type: EdgeType, entries: BibEntry[] }>();

    const getAttrValue = (entry: BibEntry, attr: string): string => {
      if (attr === 'authorName') return entry.author.name;
      if (attr === 'translatorName') return entry.translator.name;
      if (attr === 'publisher') return entry.publisher;
      if (attr === 'city') return entry.city || '';
      if (attr === 'sourceLanguage') return entry.sourceLanguage;
      if (attr === 'targetLanguage') return entry.targetLanguage;
      if (attr.startsWith('custom:')) return entry.customMetadata?.[attr.split(':')[1]] || '';
      return '';
    };

    const determineEdgeType = (attr1: string, attr2: string): EdgeType => {
        if ((attr1 === 'authorName' && attr2 === 'translatorName') || (attr1 === 'translatorName' && attr2 === 'authorName')) return 'TRANSLATION';
        if (attr1 === 'publisher' || attr2 === 'publisher') return 'PUBLICATION';
        if (attr1 === attr2 && attr1 === 'translatorName') return 'COLLABORATION';
        if (attr1 === 'city' || attr2 === 'city') return 'GEOGRAPHIC';
        if (attr1 === 'sourceLanguage' || attr2 === 'sourceLanguage') return 'LINGUISTIC';
        return 'CUSTOM';
    };

    data.forEach(entry => {
      const orderedEntities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A' && val.trim() !== '') {
          const id = `${attr}:${val}`;
          orderedEntities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
              id, name: val, group: attr, val: 10,
              degree:0, inDegree:0, outDegree:0, betweenness:0, closeness:0, eigenvector:0, pageRank:0, clustering:0, modularity:0, community: 0
            });
          }
        }
      });

      for (let i = 0; i < orderedEntities.length; i++) {
        for (let j = i + 1; j < orderedEntities.length; j++) {
          const s = orderedEntities[i].id;
          const t = orderedEntities[j].id;
          const type = determineEdgeType(orderedEntities[i].type, orderedEntities[j].type);
          
          if (!config.enabledEdgeTypes.includes(type)) continue;
          if (s === t) continue;

          const key = config.isDirected ? `${s}->${t}` : (s < t ? `${s}|${t}` : `${t}|${s}`);
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, type, entries: [] });
          const l = linkMap.get(key)!;
          l.weight++;
          l.entries.push(entry);
        }
      }
    });

    const nodeList = Array.from(nodesMap.values());
    const linkList: GraphLink[] = Array.from(linkMap.entries()).map(([key, obj]) => {
      const parts = config.isDirected ? key.split('->') : key.split('|');
      return { source: parts[0], target: parts[1], weight: obj.weight, type: obj.type };
    });

    if (nodeList.length === 0) return { nodes: [], links: [], metrics: null };

    // Metric Calculations (Subset for efficiency)
    const n = nodeList.length;
    const nodeToIndex = new Map(nodeList.map((node, i) => [node.id, i]));
    const adj = Array.from({ length: n }, () => [] as number[]);
    const inAdj = Array.from({ length: n }, () => [] as number[]);
    
    linkList.forEach(l => {
      const s = nodeToIndex.get(typeof l.source === 'string' ? l.source : l.source.id);
      const t = nodeToIndex.get(typeof l.target === 'string' ? l.target : l.target.id);
      if (s !== undefined && t !== undefined) {
          adj[s].push(t);
          inAdj[t].push(s);
          if (!config.isDirected) { adj[t].push(s); inAdj[s].push(t); }
      }
    });

    nodeList.forEach((node, i) => {
      node.outDegree = adj[i].length;
      node.inDegree = inAdj[i].length;
      node.degree = config.isDirected ? node.outDegree + node.inDegree : node.outDegree;
    });

    const metrics: AdvancedGraphMetrics = {
      nodeCount: nodeList.length,
      edgeCount: linkList.length,
      density: nodeList.length > 1 ? linkList.length / (nodeList.length * (nodeList.length - 1)) : 0,
      avgDegree: nodeList.length > 0 ? (linkList.length * 2) / nodeList.length : 0,
      avgPathLength: 0, diameter: 0, avgClustering: 0, modularityScore: 0,
      topNodes: {
        'Activity (Degree)': [...nodeList].sort((a,b) => b.degree - a.degree).slice(0, 5).map(n => ({name: n.name, score: n.degree, type: n.group})),
      },
      communities: []
    };

    return { nodes: nodeList, links: linkList, metrics };
  }, [data, config]);

  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0 || dimensions.width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 15]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const getRadius = (n: GraphNode) => {
      if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
      const val = (n as any)[sizeBy] || 0;
      const domain = d3.extent(graph.nodes, d => (d as any)[sizeBy] as number) as [number, number];
      const scale = d3.scaleSqrt().domain(domain[0] === domain[1] ? [0, domain[1] || 1] : domain).range([minSize, maxSize]);
      return scale(val);
    };

    const visualCenterX = (dimensions.width - (isPanelOpen ? 420 : 0)) / 2;
    const visualCenterY = dimensions.height / 2;

    const sim = d3.forceSimulation(graph.nodes)
        .force("link", d3.forceLink<GraphNode, GraphLink>(graph.links).id(d => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-1500))
        .force("center", d3.forceCenter(visualCenterX, visualCenterY))
        .force("collide", d3.forceCollide().radius(d => getRadius(d as GraphNode) + 20));

    const link = g.append("g")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", d => EDGE_COLORS[d.type])
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 3)
      .attr("class", "cursor-pointer hover:stroke-opacity-100 transition-opacity")
      .on("mouseenter", (e, d) => setSelectedLink(d))
      .on("mouseleave", () => setSelectedLink(null));

    const node = g.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("circle")
      .attr("r", d => getRadius(d))
      .attr("fill", d => CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10])
      .attr("stroke", "#fff").attr("stroke-width", 3)
      .attr("class", "shadow-xl cursor-pointer hover:stroke-indigo-500 transition-all")
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    if (showLabels) {
      node.append("text")
        .attr("dy", d => getRadius(d) + 20).attr("text-anchor", "middle")
        .text(d => d.name)
        .attr("class", "text-[10px] font-bold fill-slate-500 pointer-events-none serif");
    }

    sim.on("tick", () => {
      link.attr("d", (d: any) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graph, config, sizeBy, dimensions, isPanelOpen]);

  const toggleEdgeType = (type: EdgeType) => {
    setConfig(prev => ({
        ...prev,
        enabledEdgeTypes: prev.enabledEdgeTypes.includes(type) 
            ? prev.enabledEdgeTypes.filter(t => t !== type)
            : [...prev.enabledEdgeTypes, type]
    }));
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>

      {/* Edge Legend */}
      <div className="absolute bottom-10 left-10 flex flex-col gap-3 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 shadow-xl z-40">
        <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Relationship Types</h5>
        {(Object.entries(EDGE_COLORS) as [EdgeType, string][]).map(([type, color]) => (
            <button key={type} onClick={() => toggleEdgeType(type)} className={`flex items-center gap-3 transition-opacity ${config.enabledEdgeTypes.includes(type) ? 'opacity-100' : 'opacity-30'}`}>
                <div className="w-6 h-1 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-600">{type}</span>
            </button>
        ))}
      </div>

      {/* Control Panel */}
      <div className={`absolute top-0 right-0 h-full w-[420px] bg-white/95 backdrop-blur-2xl border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-slate-50/50 border-b border-slate-100 p-2">
            {[{id:'topology',label:'Structure'},{id:'viz',label:'Appearance'},{id:'sna',label:'Metrics'}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
            {activeTab === 'topology' && (
                <div className="space-y-8 animate-fadeIn">
                    <section className="space-y-4">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Entities in Play</h4>
                        <div className="flex flex-wrap gap-2">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => {
                                    const next = config.selectedNodeAttrs.includes(attr.id) ? config.selectedNodeAttrs.filter(x => x !== attr.id) : [...config.selectedNodeAttrs, attr.id];
                                    setConfig({...config, selectedNodeAttrs: next});
                                }} className={`px-4 py-2 rounded-full text-[10px] font-bold border transition-all ${config.selectedNodeAttrs.includes(attr.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {attr.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="m-8 p-8 bg-slate-900 text-white rounded-[3rem] shadow-2xl space-y-5 animate-slideUp relative flex-shrink-0">
                <button onClick={() => setSelectedNode(null)} className="absolute top-6 right-8 text-3xl font-light hover:text-rose-400 transition-colors leading-none">&times;</button>
                <div className="space-y-1">
                    <p className="text-[8px] uppercase text-indigo-400 tracking-widest font-black">{selectedNode.group}</p>
                    <h4 className="text-xl font-bold serif leading-tight pr-10">{selectedNode.name}</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-4 rounded-2xl text-center">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">Tot. Degree</p>
                        <p className="text-base font-bold serif text-slate-300">{selectedNode.degree}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl text-center">
                        <p className="text-[7px] uppercase text-slate-500 mb-1 tracking-widest">PageRank</p>
                        <p className="text-base font-bold serif text-emerald-400">{selectedNode.pageRank.toFixed(4)}</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-10 right-10 z-[60] w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-all text-xl ring-4 ring-white">{isPanelOpen ? '×' : '⚙️'}</button>
    </div>
  );
};

export default NetworkGraph;
