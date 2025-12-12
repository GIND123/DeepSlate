import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ReasoningGraphData, ReasoningNode, StudentStepAnalysis } from '../types';

interface ConceptGraphProps {
  data: ReasoningGraphData;
  studentAnalysis?: StudentStepAnalysis[];
  onNodeSelect?: (node: ReasoningNode) => void;
  domain?: 'MATH' | 'PHYSICS' | 'CODING';
}

const ConceptGraph: React.FC<ConceptGraphProps> = ({ data, studentAnalysis, onNodeSelect, domain = 'MATH' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<ReasoningNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Ref for callback to avoid stale closures in D3
  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            setDimensions({
                width: entry.contentRect.width,
                height: entry.contentRect.height
            });
        }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize Graph
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // --- DEFS for Glow Effect ---
    const defs = svg.append("defs");
    
    // Glow Filter
    const filter = defs.append("filter")
        .attr("id", "node-glow")
        .attr("filterUnits", "userSpaceOnUse")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");

    filter.append("feGaussianBlur")
        .attr("in", "SourceGraphic")
        .attr("stdDeviation", 5)
        .attr("result", "blur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    // -----------------------------

    const g = svg.append("g");
    
    // Transparent capture rect
    g.append("rect")
      .attr("width", width * 4)
      .attr("height", height * 4)
      .attr("x", -width * 2)
      .attr("y", -height * 2)
      .attr("fill", "transparent")
      .style("cursor", "grab")
      .on("click", () => {
          setSelectedNode(null);
          if (onNodeSelectRef.current) onNodeSelectRef.current({} as ReasoningNode);
      });

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4]) 
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom as any);

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.edges.map(d => ({ ...d, source: d.from, target: d.to }));

    // Simple Leveling Logic for DAG
    const levels: Record<string, number> = {};
    const incomingCount: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    
    nodes.forEach(n => {
        incomingCount[n.id] = 0;
        adj[n.id] = [];
    });
    links.forEach(l => {
        incomingCount[l.target as string] = (incomingCount[l.target as string] || 0) + 1;
        adj[l.source as string].push(l.target as string);
    });
    
    const queue: {id: string, depth: number}[] = [];
    nodes.filter(n => incomingCount[n.id] === 0).forEach(r => queue.push({id: r.id, depth: 0}));
    
    if (queue.length === 0 && nodes.length > 0) queue.push({id: nodes[0].id, depth: 0}); // Fallback for loops

    const visited = new Set<string>();
    while(queue.length > 0) {
        const {id, depth} = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        
        levels[id] = depth;
        adj[id].forEach(child => queue.push({id: child, depth: depth + 1}));
    }

    const maxLevel = Math.max(...Object.values(levels), 1);
    const levelHeight = height / (maxLevel + 2);

    nodes.forEach((n: any) => {
        n.level = levels[n.id] || 0;
        // Jitter x slightly
        n.x = width/2 + (Math.random() - 0.5) * 100;
        n.y = 50 + (n.level * levelHeight * 1.5);
    });

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(domain === 'CODING' ? 80 : 100))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("y", d3.forceY((d: any) => 50 + (d.level * levelHeight * 1.5)).strength(1.5))
      .force("x", d3.forceX(width / 2).strength(0.1)) 
      .force("collide", d3.forceCollide().radius(60));

    // Arrowhead
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28) 
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("class", "fill-slate-400 dark:fill-slate-500");

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "stroke-slate-400 dark:stroke-slate-600")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    const nodeGroup = g.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("class", "node-group") 
        .call(drag(simulation) as any)
        .on("click", (event, d: any) => {
            setSelectedNode(d);
            if (onNodeSelectRef.current) onNodeSelectRef.current(d);
            event.stopPropagation();
        });

    nodeGroup.each(function(d: any) {
        const el = d3.select(this);
        const type = d.type || 'default';
        const color = getRoleColor(d.role, type);
        
        // Add a common class 'node-shape' to easily select for highlighting later
        if (domain === 'CODING') {
             if (type === 'decision' || type === 'loop') {
                 // Diamond
                 el.append("path")
                   .attr("d", d3.symbol().type(d3.symbolDiamond).size(3000))
                   .attr("fill", color)
                   .attr("class", "node-shape stroke-white dark:stroke-slate-800")
                   .attr("stroke-width", 2);
             } else if (type === 'start' || type === 'end') {
                 // Pill / Rounded Rect
                 el.append("rect")
                   .attr("width", 100)
                   .attr("height", 40)
                   .attr("x", -50)
                   .attr("y", -20)
                   .attr("rx", 20)
                   .attr("fill", color)
                   .attr("class", "node-shape stroke-white dark:stroke-slate-800")
                   .attr("stroke-width", 2);
             } else {
                 // Process (Rectangle)
                 el.append("rect")
                   .attr("width", 100)
                   .attr("height", 50)
                   .attr("x", -50)
                   .attr("y", -25)
                   .attr("rx", 4)
                   .attr("fill", color)
                   .attr("class", "node-shape stroke-white dark:stroke-slate-800")
                   .attr("stroke-width", 2);
             }
        } else {
            // Default Circle (Math/Physics)
            el.append("circle")
              .attr("r", 20)
              .attr("fill", color)
              .attr("class", "node-shape stroke-white dark:stroke-slate-800")
              .attr("stroke-width", 2);
        }
    });
    
    // Labels
    nodeGroup.append("text")
      .text((d: any) => d.label)
      .attr("x", 0)
      .attr("y", (d: any) => {
          if (domain === 'CODING') {
               if (d.type === 'decision') return 50; 
               return 40;
          }
          return 35;
      })
      .attr("text-anchor", "middle")
      .attr("class", "fill-slate-700 dark:fill-slate-200 text-[10px] font-semibold pointer-events-none")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.1)");
      
    // Inner Icons
    nodeGroup.append("text")
      .text((d: any) => {
          if (domain === 'CODING') {
               if (d.type === 'decision') return '?';
               if (d.type === 'loop') return '⟳';
               if (d.type === 'start') return 'Start';
               if (d.type === 'end') return 'End';
               return '{}';
          }
          if (d.role === 'PROBLEM') return '?';
          if (d.role === 'SOLUTION') return '✓';
          if (d.role === 'FACT') return 'i';
          return '•';
      })
      .attr("x", 0)
      .attr("y", 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Zoom Fit (Deferred)
    setTimeout(() => {
        if (!svgRef.current) return;
        const bounds = g.node() instanceof SVGGraphicsElement ? (g.node() as SVGGraphicsElement).getBBox() : null;
        if (bounds && bounds.width > 0) {
            const padding = 60;
            const bWidth = bounds.width + padding * 2;
            const bHeight = bounds.height + padding * 2;
            const midX = bounds.x + bounds.width / 2;
            const midY = bounds.y + bounds.height / 2;

            const scale = 0.95 / Math.max(bWidth / width, bHeight / height);
            const clampedScale = Math.max(0.4, Math.min(2, scale));
            
            const translate = [width / 2 - clampedScale * midX, height / 2 - clampedScale * midY];
            
            svg.transition().duration(1000).call(
                zoom.transform as any, 
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(clampedScale)
            );
        }
    }, 500);

    function drag(simulation: any) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, domain]); 

  // --- SELECTION HIGHLIGHT EFFECT ---
  useEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      
      // Reset all strokes
      svg.selectAll(".node-shape")
         .attr("stroke", (d: any) => "#fff")
         .attr("stroke-width", 2)
         .attr("filter", null);

      if (selectedNode) {
          // Highlight selected node
          svg.selectAll(".node-shape")
             .filter((d: any) => d.id === selectedNode.id)
             .attr("stroke", "#F59E0B") // Amber-500
             .attr("stroke-width", 4)
             .attr("filter", "url(#node-glow)");
      }
  }, [selectedNode]);

  const getRoleColor = (role: string, type?: string) => {
    if (domain === 'CODING') {
        if (type === 'start' || type === 'end') return '#3B82F6'; // Blue
        if (type === 'decision' || type === 'loop') return '#F59E0B'; // Amber
        return '#8B5CF6'; // Purple for process
    }
    switch(role) {
        case 'PROBLEM': return '#6366F1'; // Indigo
        case 'SOLUTION': return '#10B981'; // Emerald
        case 'FACT': return '#F59E0B'; // Amber
        default: return '#334155'; // Slate
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-white/80 dark:bg-[#0f172a]/75 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-[18px] overflow-hidden shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col relative group transition-colors">
      <div className="absolute top-0 left-0 right-0 z-10 px-5 py-3 border-b border-slate-200 dark:border-slate-700/40 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm pointer-events-none transition-colors">
         <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">
             {domain === 'CODING' ? 'Algorithm Flowchart' : 'Reasoning Map'}
         </h3>
         <div className="flex gap-3 text-[10px] pointer-events-auto">
             <span className="text-slate-500 italic hidden sm:inline">Scroll to zoom, Drag to pan, Click node to focus</span>
         </div>
      </div>

      <div className="flex-grow relative cursor-grab active:cursor-grabbing w-full h-full">
         <svg ref={svgRef} className="w-full h-full block"></svg>
      </div>
    </div>
  );
};

export default ConceptGraph;