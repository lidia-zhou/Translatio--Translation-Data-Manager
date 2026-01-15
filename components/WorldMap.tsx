
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';

interface WorldMapProps {
  data: BibEntry[];
}

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{title: string, from: string, to: string} | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 监听容器大小变化
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({ 
          width: entry.contentRect.width, 
          height: entry.contentRect.height 
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(t => setMapData(topojson.feature(t, t.objects.countries)));
  }, []);

  const flows = useMemo(() => {
    return data.map(e => {
      const sourceCoord = (e.customMetadata?.sourceCoord as any) || null;
      const targetCoord = (e.customMetadata?.targetCoord as any) || null;
      
      if (sourceCoord && targetCoord) {
        return { 
          source: sourceCoord, 
          target: targetCoord, 
          title: e.title, 
          from: e.originalCity || 'Unknown', 
          to: e.city || 'Unknown' 
        };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !mapData || dimensions.width === 0) return;
    
    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    svg.selectAll("*").remove();

    const g = svg.append("g");
    
    // 核心修复：更保守的缩放比例，确保高度不溢出
    // 使用 Math.min 结合宽和高，预留约 15% 的边距空间
    const scale = Math.min(width / 6.2, height / 3.2);
    const projection = d3.geoNaturalEarth1()
      .scale(scale)
      .translate([width / 2, height / 2 + 20]); // 略向下偏移，为上方弧线留空
      
    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, any>()
      .scaleExtent([1, 12])
      .on("zoom", e => g.attr("transform", e.transform));
    
    svg.call(zoom);

    // 绘制地图底色 (Sphere)
    g.append("path")
      .datum({type: "Sphere"})
      .attr("fill", "transparent")
      .attr("d", path as any);

    // 绘制陆地
    g.selectAll(".country")
      .data(mapData.features)
      .join("path")
      .attr("class", "country")
      .attr("fill", "#f1f5f9")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.6)
      .attr("d", path as any);

    const arcLayer = g.append("g");
    const particlesLayer = g.append("g");

    const arcGenerator = (d: any) => {
      // 这里的 LineString 会被投影自动处理成大圆路径
      const route = { type: "LineString", coordinates: [d.source, d.target] };
      return path(route as any);
    };

    // 绘制连线弧度
    arcLayer.selectAll(".flow-arc")
      .data(flows)
      .join("path")
      .attr("class", "flow-arc")
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 1.8)
      .attr("stroke-opacity", 0.15)
      .attr("d", arcGenerator)
      .on("mouseenter", (e, d) => {
          setHoverInfo({title: d.title, from: d.from, to: d.to});
          d3.select(e.target)
            .attr("stroke-opacity", 0.9)
            .attr("stroke-width", 3)
            .attr("stroke", "#4f46e5");
      })
      .on("mouseleave", (e) => {
          setHoverInfo(null);
          d3.select(e.target)
            .attr("stroke-opacity", 0.15)
            .attr("stroke-width", 1.8)
            .attr("stroke", "#6366f1");
      });

    // 动态流点动画
    const timer = d3.timer((elapsed) => {
      particlesLayer.selectAll(".particle").remove();
      
      particlesLayer.selectAll(".particle")
        .data(flows)
        .join("circle")
        .attr("class", "particle")
        .attr("r", 2.2)
        .attr("fill", "#6366f1")
        .attr("filter", "blur(0.5px)")
        .attr("transform", d => {
          const t = (elapsed * 0.0006 + flows.indexOf(d) * 0.15) % 1;
          const interp = d3.geoInterpolate(d.source, d.target);
          const coord = interp(t);
          const pos = projection(coord);
          return pos ? `translate(${pos[0]}, ${pos[1]})` : "translate(-100, -100)";
        });
    });

    // 绘制城市锚点
    flows.forEach(f => {
      const s = projection(f.source);
      const t = projection(f.target);
      if (s && t) {
        g.append("circle")
          .attr("cx", s[0]).attr("cy", s[1]).attr("r", 3.5)
          .attr("fill", "#f43f5e").attr("stroke", "white").attr("stroke-width", 1.2);
        g.append("circle")
          .attr("cx", t[0]).attr("cy", t[1]).attr("r", 3.5)
          .attr("fill", "#10b981").attr("stroke", "white").attr("stroke-width", 1.2);
      }
    });

    return () => timer.stop();
  }, [mapData, flows, dimensions]);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full bg-[#fcfcfd] relative overflow-hidden flex flex-col">
      <svg 
        ref={svgRef} 
        className="w-full h-full block" 
        style={{ touchAction: 'none' }}
      ></svg>
      
      {hoverInfo && (
        <div className="absolute top-8 left-8 bg-white/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-2xl border border-slate-100 animate-fadeIn z-50 space-y-2 max-w-sm">
          <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Global Flow Node</div>
          <div className="text-xl font-bold serif text-slate-800 leading-tight">{hoverInfo.title}</div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase">
            <span className="text-rose-500">{hoverInfo.from}</span>
            <span className="opacity-30">→</span>
            <span className="text-emerald-500">{hoverInfo.to}</span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-8 right-8 bg-white/80 backdrop-blur-md p-5 rounded-[2rem] border border-slate-100 space-y-3 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
          <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Source / 文本起点</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Publication / 出版地</span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
