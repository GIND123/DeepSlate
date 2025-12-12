import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MisconceptionGraphData } from '../types';

interface MisconceptionMapProps {
  data: MisconceptionGraphData;
}

const MisconceptionMap: React.FC<MisconceptionMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

  useEffect(() => {
    if (!data || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
    svg.call(zoom as any);

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.edges.map(d => ({ ...d, source: d.from, target: d.to }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(50));

    // Arrowhead definitions
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow-misconception")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8"); // Slate-400

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow-misconception)");

    const node = g.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(d3.drag()
            .on("start", (event: any, d: any) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event: any, d: any) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event: any, d: any) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }) as any
        );

    // Node Circles
    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d: any) => d.type === 'misconception' ? '#ef4444' : '#10b981') // Red for Misconception, Green for Concept
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Icons inside
    node.append("text")
      .text((d: any) => d.type === 'misconception' ? '!' : '✓')
      .attr("x", 0)
      .attr("y", 5)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-weight", "bold")
      .attr("font-size", 14)
      .style("pointer-events", "none");

    // Labels
    node.append("text")
      .text((d: any) => d.label)
      .attr("x", 0)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .attr("class", "fill-slate-700 dark:fill-slate-200 text-[10px] font-bold")
      .call(wrap, 100);

    // Tooltip simulation (explanation)
    node.append("title")
        .text((d: any) => d.explanation);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function wrap(text: any, width: number) {
        text.each(function(this: SVGTextElement) {
            const text = d3.select(this);
            const words = text.text().split(/\s+/).reverse();
            let word;
            let line: string[] = [];
            let lineNumber = 0;
            const lineHeight = 1.1; // ems
            const y = text.attr("y");
            const dy = 0;
            let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if ((tspan.node()?.getComputedTextLength() || 0) > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                }
            }
        });
    }

    return () => { simulation.stop(); };
  }, [data, dimensions]);

  if (!data || data.nodes.length === 0) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <span className="text-4xl mb-2">🧠</span>
              <p>No misconceptions detected.</p>
              <p className="text-xs">Great job!</p>
          </div>
      );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-white/80 dark:bg-[#0f172a]/75 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-[18px] overflow-hidden shadow-sm flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 z-10 px-5 py-3 border-b border-slate-200 dark:border-slate-700/40 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm pointer-events-none">
            <h3 className="font-semibold text-red-600 dark:text-red-400 text-sm uppercase tracking-wider flex items-center gap-2">
                <span>⚠️</span> Misconception Map
            </h3>
        </div>
        <div className="flex-grow w-full h-full cursor-grab active:cursor-grabbing">
            <svg ref={svgRef} className="w-full h-full block"></svg>
        </div>
    </div>
  );
};

export default MisconceptionMap;