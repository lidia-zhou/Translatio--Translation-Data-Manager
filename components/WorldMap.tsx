
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { BibEntry } from '../types';

interface WorldMapProps {
  data: BibEntry[];
}

const WorldMap: React.FC<WorldMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{title: string, from: string, to: string} | null>(null);

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
        return { source: sourceCoord, target: targetCoord, title: e.title, from: e.originalCity || 'Unknown', to: e.city || 'Unknown' };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !mapData) return;
    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg.attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    
    // Adjusted scale from 5.5 to 7 to bring features inward and avoid clipping
    const projection = d3.geoNaturalEarth1()
      .scale(width / 7)
      .translate([width / 2, height / 2.2]); // Slightly raised to leave room for legends

    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom<SVGSVGElement, any>()
      .scaleExtent([1, 15])
      .on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    // Sea background
    g.append("path")
      .datum({type: "Sphere"})
      .attr("fill", "#fdfdfe")
      .attr("d", path as any);

    // Countries
    g.selectAll(".country")
      .data(mapData.features)
      .join("path")
      .attr("fill", "#f8fafc")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.5)
      .attr("d", path as any);

    const arcLayer = g.append("g");
    const particlesLayer = g.append("g");

    const arcGenerator = (d: any) => {
      const route = { type: "LineString", coordinates: [d.source, d.target] };
      return path(route as any);
    };

    arcLayer.selectAll(".flow-arc")
      .data(flows)
      .join("path")
      .attr("class", "flow-arc")
      .attr("fill", "none")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.25)
      .attr("d", arcGenerator)
      .on("mouseenter", (e, d) => {
          setHoverInfo({title: d.title, from: d.from, to: d.to});
          d3.select(e.target).attr("stroke-opacity", 1).attr("stroke-width", 4).attr("stroke", "#4f46e5");
      })
      .on("mouseleave", (e) => {
          setHoverInfo(null);
          d3.select(e.target).attr("stroke-opacity", 0.25).attr("stroke-width", 2).attr("stroke", "#6366f1");
      });

    const timer = d3.timer((elapsed) => {
      particlesLayer.selectAll(".particle").remove();
      
      particlesLayer.selectAll(".particle")
        .data(flows)
        .join("circle")
        .attr("class", "particle")
        .attr("r", 3)
        .attr("fill", "#6366f1")
        .attr("transform", d => {
          const t = (elapsed * 0.0004 + flows.indexOf(d) * 0.15) % 1;
          const interp = d3.geoInterpolate(d.source, d.target);
          const coord = interp(t);
          const pos = projection(coord);
          return pos ? `translate(${pos[0]}, ${pos[1]})` : "translate(-100, -100)";
        });
    });

    flows.forEach(f => {
      const s = projection(f.source);
      const t = projection(f.target);
      if (s && t) {
        g.append("circle").attr("cx", s[0]).attr("cy", s[1]).attr("r", 4).attr("fill", "#f43f5e").attr("stroke", "white").attr("stroke-width", 1.5);
        g.append("circle").attr("cx", t[0]).attr("cy", t[1]).attr("r", 4).attr("fill", "#10b981").attr("stroke", "white").attr("stroke-width", 1.5);
      }
    });

    return () => timer.stop();
  }, [mapData, flows]);

  return (
    <div className="flex-1 w-full h-full bg-[#fcfcfd] relative overflow-hidden">
      <svg ref={svgRef} className="w-full h-full"></svg>
      {hoverInfo && (
        <div className="absolute top-10 left-10 bg-white/95 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border border-slate-100 animate-fadeIn z-50 space-y-3">
          <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Translation Flow Insight</div>
          <div className="text-2xl font-bold serif text-slate-800">{hoverInfo.title}</div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
            <span className="text-rose-500 font-bold uppercase tracking-tighter">{hoverInfo.from}</span>
            <span className="text-slate-300">→</span>
            <span className="text-emerald-500 font-bold uppercase tracking-tighter">{hoverInfo.to}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-10 right-10 bg-white/90 backdrop-blur-md p-6 rounded-[2rem] border border-slate-100 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm"></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Origin / 源产地</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm"></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Target / 出版地</span>
        </div>
      </div>
    </div>
  );
};

export default WorldMap;
