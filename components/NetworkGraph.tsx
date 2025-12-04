import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { BibEntry, GraphNode, GraphLink } from '../types';

interface NetworkGraphProps {
  data: BibEntry[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // 1. Process Data into Nodes and Links
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    data.forEach(entry => {
      // Author Node
      const authorId = `A-${entry.author.name}`;
      if (!nodesMap.has(authorId)) {
        nodesMap.set(authorId, { id: authorId, group: 'author', name: entry.author.name, val: 5 });
      }

      // Translator Node
      const translatorId = `T-${entry.translator.name}`;
      if (!nodesMap.has(translatorId)) {
        nodesMap.set(translatorId, { id: translatorId, group: 'translator', name: entry.translator.name, val: 5 });
      }

      // Publisher Node
      const publisherId = `P-${entry.publisher}`;
      if (!nodesMap.has(publisherId)) {
        nodesMap.set(publisherId, { id: publisherId, group: 'publisher', name: entry.publisher, val: 3 });
      }

      // Links: Author -> Translator
      links.push({
        source: authorId,
        target: translatorId,
        label: 'translated by'
      });

      // Links: Translator -> Publisher
      links.push({
        source: translatorId,
        target: publisherId,
        label: 'published by'
      });
    });

    const nodes = Array.from(nodesMap.values());

    // 2. Setup D3 Canvas
    const width = 800;
    const height = 600;
    
    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    // Add a container for zoom/pan
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom);

    // 3. Simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(20));

    // 4. Drawing Elements
    const link = g.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.group === 'author' ? 10 : (d.group === 'translator' ? 8 : 6))
      .attr("fill", d => {
          if (d.group === 'author') return "#ef4444"; // Red
          if (d.group === 'translator') return "#3b82f6"; // Blue
          return "#10b981"; // Green
      })
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // Labels
    const labels = g.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("dx", 12)
        .attr("dy", 4)
        .text(d => d.name)
        .attr("font-size", "10px")
        .attr("fill", "#334155")
        .attr("pointer-events", "none");

    node.append("title")
      .text(d => `${d.name} (${d.group})`);

    // 5. Simulation Tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data]);

  return (
    <div className="w-full h-[600px] border border-slate-200 rounded-lg bg-white overflow-hidden relative shadow-sm">
        <div className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded shadow text-xs">
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Author</div>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Translator</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Publisher</div>
        </div>
        <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
    </div>
  );
};

export default NetworkGraph;
