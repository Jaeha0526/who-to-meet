"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphNode, GraphLink } from "../lib/api";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  highlights?: string[];
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (link: GraphLink) => void;
};

const COLORS: Record<string, string> = {
  person: "#6366f1",
  conversation: "#22c55e",
};

const EDGE_COLORS: Record<string, string> = {
  past_interaction: "#4a9eff44",
  shared_interest: "#22c55e44",
  recommended_match: "#f59e0b66",
  participated_in: "#88888822",
};

export default function ForceGraph({
  nodes,
  links,
  highlights = [],
  onNodeClick,
  onEdgeClick,
}: Props) {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const update = () => {
      setDimensions({
        w: window.innerWidth,
        h: window.innerHeight - 56,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.summary?.slice(0, 20) || node.id;
      const fontSize = Math.max(12 / globalScale, 3);
      const isHighlighted = highlights.includes(node.id);
      const isPerson = node.type === "person";
      const r = isPerson ? (isHighlighted ? 8 : 6) : 4;

      // Glow for highlighted
      if (isHighlighted) {
        ctx.shadowColor = "#6366f1";
        ctx.shadowBlur = 15;
      }

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isHighlighted
        ? "#818cf8"
        : COLORS[node.type] || "#6366f1";
      ctx.fill();

      // Border
      ctx.strokeStyle = isHighlighted ? "#c7d2fe" : "#ffffff22";
      ctx.lineWidth = isHighlighted ? 2 : 0.5;
      ctx.stroke();

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Label
      if (isPerson && (globalScale > 0.8 || isHighlighted)) {
        ctx.font = `${isHighlighted ? "bold " : ""}${fontSize}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHighlighted ? "#e0e0e8" : "#8888a0";
        ctx.fillText(label, node.x, node.y + r + 2);
      }
    },
    [highlights]
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const src = link.source;
      const tgt = link.target;
      if (!src.x || !tgt.x) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle =
        EDGE_COLORS[link.edge_type] || "#ffffff11";
      ctx.lineWidth = Math.max((link.strength || 0.3) * 3, 0.5);
      ctx.stroke();
    },
    []
  );

  return (
    <ForceGraph2D
      ref={fgRef}
      width={dimensions.w}
      height={dimensions.h}
      graphData={{ nodes, links }}
      nodeCanvasObject={paintNode}
      linkCanvasObject={paintLink}
      onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
      onLinkClick={(link: any) => onEdgeClick(link as GraphLink)}
      backgroundColor="#0a0a0f"
      cooldownTicks={100}
      nodeRelSize={6}
      linkDirectionalParticles={0}
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
      enableNodeDrag={true}
    />
  );
}
