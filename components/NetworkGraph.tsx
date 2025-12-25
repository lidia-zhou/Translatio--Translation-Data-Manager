
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BibEntry, GraphNode, GraphLink, AdvancedGraphMetrics, NodeSizeMetric, NetworkConfig, NodeMetric, ResearchBlueprint } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
  customColumns: string[];
  blueprint: ResearchBlueprint | null;
  onDataUpdate: (newEntries: BibEntry[]) => void;
}

const CATEGORY_COLORS = d3.schemeTableau10;

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns, blueprint }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // --- Topology Configurations ---
  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName'], // 默认展示作者-译者关系
    isDirected: true,
    edgeWeightBy: 'frequency'
  });

  // --- Visual Controls ---
  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [minSize, setMinSize] = useState(12);
  const [maxSize, setMaxSize] = useState(60);
  const [showLabels, setShowLabels] = useState(true);

  const availableAttributes = useMemo(() => [
    { id: 'authorName', label: 'Author / 作者' },
    { id: 'translatorName', label: 'Translator / 译者' },
    { id: 'publisher', label: 'Publisher / 出版社' },
    { id: 'city', label: 'City / 城市' },
    { id: 'sourceLanguage', label: 'Source Lang / 源语' },
    { id: 'targetLanguage', label: 'Target Lang / 目标语' },
    ...customColumns.map(c => ({ id: `custom:${c}`, label: c }))
  ], [customColumns]);

  // --- COMPLEX SNA ENGINE ---
  const graph = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, entries: BibEntry[] }>();

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

    // 1. Building the Multimodal Graph
    data.forEach(entry => {
      const activeEntities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A') {
          const id = `${attr}:${val}`;
          activeEntities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
              id, name: val, group: attr, val: 10,
              degree:0, inDegree:0, outDegree:0, betweenness:0, closeness:0, eigenvector:0, pageRank:0, clustering:0, modularity:0
            });
          }
        }
      });

      // Permutations for links
      for (let i = 0; i < activeEntities.length; i++) {
        for (let j = 0; j < activeEntities.length; j++) {
          if (i === j) continue;
          const s = activeEntities[i].id;
          const t = activeEntities[j].id;
          const key = config.isDirected ? `${s}->${t}` : (s < t ? `${s}|${t}` : `${t}|${s}`);
          
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, entries: [] });
          const l = linkMap.get(key)!;
          l.weight++;
          l.entries.push(entry);
        }
      }
    });

    const nodeList = Array.from(nodesMap.values());
    const linkList: GraphLink[] = Array.from(linkMap.entries()).map(([key, obj]) => {
      const parts = config.isDirected ? key.split('->') : key.split('|');
      return { source: parts[0], target: parts[1], weight: obj.weight, label: obj.entries[0].title };
    });

    if (nodeList.length === 0) return { nodes: [], links: [], metrics: null };

    // 2. SNA ALGORITHMS
    const adj = new Map<string, Set<string>>();
    nodeList.forEach(n => adj.set(n.id, new Set()));
    linkList.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      adj.get(s)?.add(t);
      if (!config.isDirected) adj.get(t)?.add(s);
    });

    // -- Degree --
    nodeList.forEach(n => {
      n.degree = adj.get(n.id)?.size || 0;
      n.outDegree = linkList.filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === n.id).length;
      n.inDegree = linkList.filter(l => (typeof l.target === 'string' ? l.target : l.target.id) === n.id).length;
    });

    // -- Betweenness Centrality (Brandes Algorithm) --
    const btwn = new Map<string, number>();
    nodeList.forEach(n => btwn.set(n.id, 0));
    nodeList.forEach(sNode => {
      const S: string[] = [];
      const P = new Map<string, string[]>();
      const sigma = new Map<string, number>();
      const d = new Map<string, number>();
      nodeList.forEach(n => { P.set(n.id, []); sigma.set(n.id, 0); d.set(n.id, -1); });
      sigma.set(sNode.id, 1); d.set(sNode.id, 0);
      const Q = [sNode.id];
      while(Q.length > 0) {
        const v = Q.shift()!; S.push(v);
        adj.get(v)?.forEach(w => {
          if (d.get(w) === -1) { d.set(w, d.get(v)! + 1); Q.push(w); }
          if (d.get(w) === d.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!);
            P.get(w)?.push(v);
          }
        });
      }
      const delta = new Map<string, number>();
      nodeList.forEach(n => delta.set(n.id, 0));
      while(S.length > 0) {
        const w = S.pop()!;
        P.get(w)?.forEach(v => {
          delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
        });
        if (w !== sNode.id) btwn.set(w, btwn.get(w)! + delta.get(w)!);
      }
    });
    nodeList.forEach(n => n.betweenness = btwn.get(n.id)!);

    // -- PageRank (Power Iteration) --
    let pr = new Map<string, number>();
    const damp = 0.85;
    nodeList.forEach(n => pr.set(n.id, 1 / nodeList.length));
    for(let i=0; i<15; i++) {
      const nextPr = new Map<string, number>();
      let sinkSum = 0;
      nodeList.forEach(n => {
        if ((adj.get(n.id)?.size || 0) === 0) sinkSum += pr.get(n.id)!;
      });
      nodeList.forEach(n => {
        let rank = (1 - damp) / nodeList.length + damp * (sinkSum / nodeList.length);
        nodeList.forEach(m => {
          if (adj.get(m.id)?.has(n.id)) rank += damp * (pr.get(m.id)! / adj.get(m.id)!.size);
        });
        nextPr.set(n.id, rank);
      });
      pr = nextPr;
    }
    nodeList.forEach(n => n.pageRank = pr.get(n.id)!);

    // 3. GLOBAL METRICS
    const metrics: AdvancedGraphMetrics = {
      nodeCount: nodeList.length,
      edgeCount: linkList.length,
      density: nodeList.length > 1 ? linkList.length / (nodeList.length * (nodeList.length -1)) : 0,
      avgDegree: nodeList.length > 0 ? (linkList.length * 2) / nodeList.length : 0,
      avgPathLength: 0, diameter: 0, avgClustering: 0, modularityScore: 0,
      topNodes: {
        betweenness: [...nodeList].sort((a,b) => b.betweenness - a.betweenness).slice(0, 10).map(n => ({name: n.name, score: n.betweenness, type: n.group})),
        pageRank: [...nodeList].sort((a,b) => b.pageRank - a.pageRank).slice(0, 10).map(n => ({name: n.name, score: n.pageRank, type: n.group})),
        degree: [...nodeList].sort((a,b) => b.degree - a.degree).slice(0, 10).map(n => ({name: n.name, score: n.degree, type: n.group}))
      }
    };

    return { nodes: nodeList, links: linkList, metrics };
  }, [data, config]);

  // --- D3 RENDERING ---
  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const [width, height] = [svgRef.current.clientWidth, svgRef.current.clientHeight];
    svg.selectAll("*").remove();

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.1, 10]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const getRadius = (n: GraphNode) => {
      if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
      const domain = d3.extent(graph.nodes, d => (d as any)[sizeBy]) as [number, number];
      return d3.scaleSqrt().domain(domain).range([minSize, maxSize])((n as any)[sizeBy]);
    };

    const sim = d3.forceSimulation(graph.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graph.links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width/2, height/2))
      .force("collide", d3.forceCollide().radius(d => getRadius(d as GraphNode) + 20));

    const link = g.append("g")
      .selectAll("line")
      .data(graph.links)
      .join("line")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 2);

    const node = g.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    node.append("circle")
      .attr("r", d => getRadius(d))
      .attr("fill", d => CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .attr("class", "shadow-xl cursor-pointer hover:stroke-indigo-500 transition-all");

    if (showLabels) {
      node.append("text")
        .attr("dy", d => getRadius(d) + 18)
        .attr("text-anchor", "middle")
        .text(d => d.name)
        .attr("class", "text-[9px] font-bold fill-slate-500 pointer-events-none select-none serif");
    }

    sim.on("tick", () => {
      link.attr("x1", d => (d.source as any).x).attr("y1", d => (d.source as any).y).attr("x2", d => (d.target as any).x).attr("y2", d => (d.target as any).y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graph, config, sizeBy, minSize, maxSize, showLabels]);

  return (
    <div className="w-full h-full bg-[#fcfcfd] relative flex overflow-hidden">
      <svg ref={svgRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing"></svg>

      {/* Control Panel */}
      <div className={`absolute top-0 right-0 h-full w-[45rem] bg-white border-l border-slate-200 shadow-2xl transition-all duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-slate-50/50 border-b border-slate-100 p-2">
            {['topology', 'viz', 'sna'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t === 'topology' ? 'Topology' : t === 'viz' ? 'Appearance' : 'SNA Lab'}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-12 space-y-12">
            {activeTab === 'topology' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-6">
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-800">Node Dimensions / 节点维度</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => {
                                    const next = config.selectedNodeAttrs.includes(attr.id) 
                                        ? config.selectedNodeAttrs.filter(x => x !== attr.id)
                                        : [...config.selectedNodeAttrs, attr.id];
                                    setConfig({...config, selectedNodeAttrs: next});
                                }} className={`p-6 rounded-[1.5rem] border-2 text-left transition-all flex justify-between items-center ${config.selectedNodeAttrs.includes(attr.id) ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                                    <span className={`text-xs font-bold ${config.selectedNodeAttrs.includes(attr.id) ? 'text-indigo-700' : 'text-slate-500'}`}>{attr.label}</span>
                                    {config.selectedNodeAttrs.includes(attr.id) && <span className="text-indigo-600">✓</span>}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-800">Connection Direction / 连线方向</h4>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                            <button onClick={() => setConfig({...config, isDirected: true})} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${config.isDirected ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Directed (有向)</button>
                            <button onClick={() => setConfig({...config, isDirected: false})} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${!config.isDirected ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Undirected (无向)</button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-6">
                        <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Sizing Metric</label>
                        <select value={sizeBy} onChange={e => setSizeBy(e.target.value as any)} className="w-full p-6 bg-slate-50 rounded-2xl border-none text-xs font-bold text-indigo-600 outline-none">
                            <option value="uniform">Uniform / 统一大小</option>
                            <option value="degree">Degree / 度中心性</option>
                            <option value="betweenness">Betweenness / 中介中心性</option>
                            <option value="pageRank">PageRank / 声望</option>
                        </select>
                    </section>
                    <section className="space-y-8">
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Size Range</span><span>{minSize}px - {maxSize}px</span></div>
                            <input type="range" min="5" max="30" value={minSize} onChange={e => setMinSize(Number(e.target.value))} className="w-full accent-indigo-600" />
                            <input type="range" min="40" max="150" value={maxSize} onChange={e => setMaxSize(Number(e.target.value))} className="w-full accent-indigo-600" />
                        </div>
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                            <span className="text-[10px] font-black uppercase text-slate-500">Show Text Labels</span>
                            <button onClick={() => setShowLabels(!showLabels)} className={`w-14 h-7 rounded-full transition-all flex items-center p-1 ${showLabels ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${showLabels ? 'translate-x-7' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'sna' && graph.metrics && (
                <div className="space-y-12 animate-fadeIn pb-12">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] text-center shadow-xl">
                            <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-1">Graph Density</p>
                            <p className="text-3xl font-bold serif">{(graph.metrics.density * 100).toFixed(2)}%</p>
                        </div>
                        <div className="p-8 bg-indigo-600 text-white rounded-[2.5rem] text-center shadow-xl">
                            <p className="text-[9px] font-black uppercase text-indigo-200 tracking-widest mb-1">Entities</p>
                            <p className="text-3xl font-bold serif">{graph.metrics.nodeCount}</p>
                        </div>
                    </div>

                    {/* Added explicit type assertion to resolve "Property 'map' does not exist on type 'unknown'" error */}
                    {(Object.entries(graph.metrics.topNodes) as [string, { name: string, score: number, type: string }[]][]).map(([m, nodes]) => (
                        <section key={m} className="space-y-4">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 pb-2">{m.replace(/([A-Z])/g, ' $1')} Ranking</h4>
                            <div className="space-y-2">
                                {nodes.map((n, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-md transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{n.name}</span>
                                            <span className="text-[9px] uppercase text-slate-400 font-bold tracking-tighter">{n.type}</span>
                                        </div>
                                        <span className="text-xs font-mono font-black text-indigo-600">{n.score.toFixed(3)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="m-8 p-10 bg-slate-900 text-white rounded-[4rem] shadow-2xl space-y-6 animate-slideUp">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="text-3xl font-bold serif mb-1">{selectedNode.name}</h4>
                        <span className="px-3 py-1 bg-white/10 text-[9px] font-black uppercase tracking-widest rounded-full text-indigo-300">{selectedNode.group}</span>
                    </div>
                    <button onClick={() => setSelectedNode(null)} className="text-5xl font-light hover:text-rose-400 leading-none">&times;</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-[2rem] text-center border border-white/5">
                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Betweenness</p>
                        <p className="text-2xl font-bold serif text-indigo-400">{selectedNode.betweenness.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-[2rem] text-center border border-white/5">
                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1">PageRank</p>
                        <p className="text-2xl font-bold serif text-emerald-400">{selectedNode.pageRank.toFixed(4)}</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-12 right-12 z-[60] w-20 h-20 bg-slate-900 text-white rounded-[2rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-2xl">
        {isPanelOpen ? '×' : '⚙️'}
      </button>
    </div>
  );
};

export default NetworkGraph;
