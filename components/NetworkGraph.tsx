
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
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

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, customColumns }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'topology' | 'viz' | 'sna'>('topology');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [rankMetric, setRankMetric] = useState<keyof GraphNode>('degree');
  
  const [config, setConfig] = useState<NetworkConfig>({
    selectedNodeAttrs: ['authorName', 'translatorName', 'publisher'], 
    isDirected: true,
    edgeWeightBy: 'frequency',
    colorMode: 'category',
    enabledEdgeTypes: ['TRANSLATION', 'PUBLICATION', 'COLLABORATION', 'GEOGRAPHIC', 'LINGUISTIC', 'CUSTOM']
  });

  const [sizeBy, setSizeBy] = useState<NodeSizeMetric>('degree');
  const [minSize, setMinSize] = useState(15);
  const [maxSize, setMaxSize] = useState(70);
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

  const graphData = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const linkMap = new Map<string, { weight: number, type: EdgeType }>();

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
        if (attr1 === 'sourceLanguage' || attr2 === 'sourceLanguage' || attr1 === 'targetLanguage' || attr2 === 'targetLanguage') return 'LINGUISTIC';
        return 'CUSTOM';
    };

    data.forEach(entry => {
      const entities: {id: string, name: string, type: string}[] = [];
      config.selectedNodeAttrs.forEach(attr => {
        const val = getAttrValue(entry, attr);
        if (val && val !== 'Unknown' && val !== 'N/A' && val.trim() !== '') {
          const id = `${attr}:${val}`;
          entities.push({ id, name: val, type: attr });
          if (!nodesMap.has(id)) {
            nodesMap.set(id, { 
              id, name: val, group: attr, val: 10,
              degree: 0, inDegree: 0, outDegree: 0, betweenness: 0, closeness: 0, eigenvector: 0, pageRank: 1, clustering: 0, modularity: 0, community: 0
            });
          }
        }
      });

      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const s = entities[i].id;
          const t = entities[j].id;
          const type = determineEdgeType(entities[i].type, entities[j].type);
          
          if (!config.enabledEdgeTypes.includes(type)) continue;
          if (s === t) continue;

          const key = config.isDirected ? `${s}->${t}` : (s < t ? `${s}|${t}` : `${t}|${s}`);
          if (!linkMap.has(key)) linkMap.set(key, { weight: 0, type });
          linkMap.get(key)!.weight++;
        }
      }
    });

    const nodeList = Array.from(nodesMap.values());
    const linkList: GraphLink[] = Array.from(linkMap.entries()).map(([key, obj]) => {
      const parts = config.isDirected ? key.split('->') : key.split('|');
      return { source: parts[0], target: parts[1], weight: obj.weight, type: obj.type };
    });

    // SNA Metrics Calculation
    const adjacency: Record<string, string[]> = {};
    nodeList.forEach(n => adjacency[n.id] = []);
    linkList.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      adjacency[s].push(t);
      if (!config.isDirected) adjacency[t].push(s);
      
      const sIdx = nodeList.findIndex(n => n.id === s);
      const tIdx = nodeList.findIndex(n => n.id === t);
      if (sIdx !== -1 && tIdx !== -1) {
        nodeList[sIdx].degree++;
        nodeList[sIdx].outDegree++;
        nodeList[tIdx].degree++;
        nodeList[tIdx].inDegree++;
      }
    });

    nodeList.forEach(startNode => {
      const q: [string, number][] = [[startNode.id, 0]];
      const visited = new Set([startNode.id]);
      let totalDist = 0;
      let reachable = 0;

      while(q.length > 0) {
        const [curr, dist] = q.shift()!;
        totalDist += dist;
        if(dist > 0) reachable++;
        
        adjacency[curr]?.forEach(next => {
          if(!visited.has(next)) {
            visited.add(next);
            q.push([next, dist + 1]);
            const nIdx = nodeList.findIndex(x => x.id === next);
            if(nIdx !== -1) nodeList[nIdx].betweenness += 1;
          }
        });
      }
      const sIdx = nodeList.findIndex(x => x.id === startNode.id);
      if(sIdx !== -1 && reachable > 0) nodeList[sIdx].closeness = reachable / totalDist;
    });

    for(let iter = 0; iter < 10; iter++) {
      const nextPR: Record<string, number> = {};
      nodeList.forEach(n => nextPR[n.id] = 0.15 / nodeList.length);
      nodeList.forEach(n => {
        const out = adjacency[n.id].length;
        if(out > 0) {
          adjacency[n.id].forEach(target => {
            nextPR[target] += 0.85 * (n.pageRank / out);
          });
        } else {
          nodeList.forEach(other => nextPR[other.id] += 0.85 * (n.pageRank / nodeList.length));
        }
      });
      nodeList.forEach(n => n.pageRank = nextPR[n.id]);
    }

    return { nodes: nodeList, links: linkList };
  }, [data, config]);

  const globalMetrics = useMemo(() => {
    const n = graphData.nodes.length;
    const e = graphData.links.length;
    return {
      nodeCount: n,
      edgeCount: e,
      density: n > 1 ? (config.isDirected ? e / (n * (n-1)) : (2 * e) / (n * (n-1))) : 0,
      avgDegree: n > 0 ? (2 * e) / n : 0
    };
  }, [graphData, config.isDirected]);

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0 || dimensions.width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, any>().scaleExtent([0.05, 12]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);

    const centerX = (dimensions.width - (isPanelOpen ? 380 : 0)) / 2;
    const centerY = dimensions.height / 2;

    const sim = d3.forceSimulation(graphData.nodes as any)
        .force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(220))
        .force("charge", d3.forceManyBody().strength(-2000))
        .force("center", d3.forceCenter(centerX, centerY))
        .force("collide", d3.forceCollide().radius(d => 20 + (d as any).degree * 3 + 20));

    const link = g.append("g").selectAll("line").data(graphData.links).join("line")
      .attr("stroke", d => EDGE_COLORS[d.type])
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 3);

    const node = g.append("g").selectAll("g").data(graphData.nodes).join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if(!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    const getRadius = (d: any) => {
        if (sizeBy === 'uniform') return (minSize + maxSize) / 2;
        const extent = d3.extent(graphData.nodes, n => (n as any)[sizeBy] as number) as [number, number];
        const scale = d3.scaleSqrt().domain(extent[0] === extent[1] ? [0, extent[1] || 1] : extent).range([minSize, maxSize]);
        return scale(d[sizeBy]);
    };

    node.append("circle")
      .attr("r", d => getRadius(d))
      .attr("fill", d => config.colorMode === 'category' ? 
          CATEGORY_COLORS[availableAttributes.findIndex(a => a.id === d.group) % 10] : 
          COMMUNITY_COLORS[d.community % 10])
      .attr("stroke", "#fff").attr("stroke-width", 3)
      .attr("class", "cursor-pointer hover:stroke-indigo-500 transition-all shadow-xl")
      .on("click", (e, d) => { e.stopPropagation(); setSelectedNode(d); });

    if (showLabels) {
      node.append("text")
        .attr("dy", d => getRadius(d) + 25).attr("text-anchor", "middle")
        .text(d => d.name)
        .attr("class", "text-[11px] font-bold fill-slate-500 pointer-events-none serif");
    }

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d:any) => d.target.x).attr("y2", (d:any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graphData, dimensions, isPanelOpen, sizeBy, minSize, maxSize, showLabels, config.colorMode]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fdfdfe] relative flex overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>
      
      {/* Legend & Summary */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-6 z-40">
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Global SNA Report / 全局网络报告</h5>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                    <p className="text-[9px] uppercase text-slate-400 font-bold">Density / 网络密度</p>
                    <p className="text-xl font-bold serif text-indigo-600">{(globalMetrics.density * 100).toFixed(2)}%</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] uppercase text-slate-400 font-bold">Avg. Degree / 平均度</p>
                    <p className="text-xl font-bold serif text-indigo-600">{globalMetrics.avgDegree.toFixed(1)}</p>
                </div>
            </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Relationship Types / 关系类型</h5>
            <div className="flex flex-col gap-3">
                {(Object.entries(EDGE_COLORS) as [EdgeType, string][]).map(([type, color]) => (
                    <button key={type} onClick={() => setConfig(prev => ({ ...prev, enabledEdgeTypes: prev.enabledEdgeTypes.includes(type) ? prev.enabledEdgeTypes.filter(t => t !== type) : [...prev.enabledEdgeTypes, type]}))} 
                            className={`flex items-center gap-4 transition-all hover:scale-105 ${config.enabledEdgeTypes.includes(type) ? 'opacity-100' : 'opacity-20'}`}>
                        <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-600">{type} / {type === 'TRANSLATION' ? '翻译' : type === 'PUBLICATION' ? '出版' : type === 'COLLABORATION' ? '协作' : type === 'GEOGRAPHIC' ? '地理' : type === 'LINGUISTIC' ? '语言' : '自定义'}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className={`absolute top-0 right-0 h-full w-[380px] bg-white/95 backdrop-blur-2xl border-l border-slate-100 shadow-2xl transition-transform duration-500 z-50 flex flex-col ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex bg-slate-50/50 border-b border-slate-100 p-2 shrink-0">
            {[
                {id:'topology',label:'Topology / 拓扑结构'},
                {id:'viz',label:'Visualization / 视觉映射'},
                {id:'sna',label:'SNA Metrics / 社会网络指标'}
            ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-5 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {t.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar pb-32">
            {activeTab === 'topology' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Entities / 节点实体</h4>
                        <div className="flex flex-wrap gap-2.5">
                            {availableAttributes.map(attr => (
                                <button key={attr.id} onClick={() => setConfig({...config, selectedNodeAttrs: config.selectedNodeAttrs.includes(attr.id) ? config.selectedNodeAttrs.filter(x => x !== attr.id) : [...config.selectedNodeAttrs, attr.id]})} 
                                        className={`px-5 py-2.5 rounded-full text-[11px] font-bold border transition-all ${config.selectedNodeAttrs.includes(attr.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {attr.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'viz' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Scaling / 节点规模控制</h4>
                        <select value={sizeBy} onChange={e => setSizeBy(e.target.value as any)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] border-none text-[11px] font-bold uppercase outline-none shadow-inner text-indigo-600">
                           <option value="uniform">Uniform / 统一尺寸</option>
                           <option value="degree">Degree / 度中心性</option>
                           <option value="pageRank">PageRank / 影响力指数</option>
                           <option value="betweenness">Betweenness / 介数中介度</option>
                        </select>
                    </section>
                </div>
            )}

            {activeTab === 'sna' && (
                <div className="space-y-10 animate-fadeIn">
                    <section className="space-y-5">
                        <div className="flex justify-between items-end mb-4">
                           <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Ranking / 指标排名</h4>
                           <select value={rankMetric} onChange={e => setRankMetric(e.target.value as any)} className="bg-transparent text-[10px] font-black text-indigo-600 uppercase tracking-widest outline-none border-none cursor-pointer">
                              <option value="degree">Degree / 按活跃度</option>
                              <option value="pageRank">PageRank / 按影响力</option>
                              <option value="betweenness">Betweenness / 按中介度</option>
                              <option value="closeness">Closeness / 按传播效率</option>
                           </select>
                        </div>
                        <div className="space-y-4">
                           {graphData.nodes.sort((a,b) => (b[rankMetric] as number) - (a[rankMetric] as number)).slice(0, 20).map((n, i) => (
                              <div key={n.id} onClick={() => setSelectedNode(n)} className="flex items-center gap-5 p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                                 <span className="text-sm font-black text-slate-300 group-hover:text-indigo-600">#{i+1}</span>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-slate-800 truncate">{n.name}</p>
                                    <p className="text-[10px] uppercase text-indigo-400 font-black tracking-tighter">{n.group}</p>
                                 </div>
                                 <span className="text-sm font-bold text-slate-400 font-mono">
                                    {typeof n[rankMetric] === 'number' ? (n[rankMetric] as number).toFixed(2) : '-'}
                                 </span>
                              </div>
                           ))}
                        </div>
                    </section>
                </div>
            )}
        </div>

        {selectedNode && (
            <div className="absolute inset-0 bg-white z-[70] flex flex-col p-10 animate-fadeIn overflow-y-auto">
                <button onClick={() => setSelectedNode(null)} className="absolute top-10 right-10 text-5xl font-light hover:text-indigo-600 transition-colors leading-none">&times;</button>
                
                <div className="mt-12 space-y-12">
                   <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{selectedNode.group}</p>
                      <h3 className="text-5xl font-bold serif text-slate-900 leading-tight">{selectedNode.name}</h3>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      {[
                        { label: 'Degree / 活跃度', val: selectedNode.degree, color: 'text-indigo-600' },
                        { label: 'PageRank / 影响力', val: selectedNode.pageRank.toFixed(4), color: 'text-emerald-600' },
                        { label: 'Betweenness / 介数', val: selectedNode.betweenness.toFixed(1), color: 'text-rose-600' },
                        { label: 'Closeness / 亲密度', val: selectedNode.closeness.toFixed(3), color: 'text-amber-600' }
                      ].map(m => (
                        <div key={m.label} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
                           <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{m.label}</p>
                           <p className={`text-2xl font-bold serif ${m.color}`}>{m.val}</p>
                        </div>
                      ))}
                   </div>

                   <section className="space-y-4">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b pb-4">Social Role Analysis / 中介角色分析</h4>
                      <div className="p-8 bg-slate-900 rounded-[3rem] text-white space-y-4 shadow-xl">
                         <p className="text-xl font-serif italic leading-relaxed opacity-90">
                            {selectedNode.pageRank > 0.05 ? "该节点是网络中的权力枢纽，主导了学术资本的跨国流动。/ This node is a power hub dominating transnational academic capital flow." : 
                             selectedNode.betweenness > 50 ? "该节点扮演着跨国连接的‘桥梁’角色，是翻译场域中关键的信息枢纽。/ This node acts as a bridge for transnational connections and a key information hub." : 
                             "该节点是该研究脉络中的活跃参与者，专注于特定的翻译流转路径。/ This node is an active participant in this research context, focusing on specific translation flows."}
                         </p>
                      </div>
                   </section>

                   <button onClick={() => setSelectedNode(null)} className="w-full py-6 bg-slate-100 text-slate-400 rounded-full font-bold text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Close Analysis / 关闭详情</button>
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-12 right-12 z-[60] w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center hover:scale-110 transition-all text-2xl ring-4 ring-white shadow-indigo-500/10">{isPanelOpen ? '×' : '⚙️'}</button>
    </div>
  );
};

export default NetworkGraph;
