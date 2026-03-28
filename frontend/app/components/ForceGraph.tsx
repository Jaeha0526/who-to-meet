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

const NODE_COLORS: Record<string, string> = {
  person: "#818cf8",
  conversation: "#34d399",
};

const EDGE_COLORS: Record<string, string> = {
  past_interaction: "rgba(99, 102, 241, 0.25)",
  shared_interest: "rgba(34, 197, 94, 0.25)",
  recommended_match: "rgba(245, 158, 11, 0.35)",
  semantic: "rgba(168, 85, 247, 0.30)",
  participated_in: "rgba(136, 136, 160, 0.10)",
};

const EDGE_HOVER_COLORS: Record<string, string> = {
  past_interaction: "rgba(99, 102, 241, 0.7)",
  shared_interest: "rgba(34, 197, 94, 0.7)",
  recommended_match: "rgba(245, 158, 11, 0.7)",
  semantic: "rgba(168, 85, 247, 0.7)",
  participated_in: "rgba(136, 136, 160, 0.3)",
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<any>(null);

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

  // Zoom to fit on first render
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      const timer = setTimeout(() => {
        fgRef.current.zoomToFit(400, 60);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes.length]);

  // Get neighbor set for hovered node
  const getNeighborIds = useCallback(
    (nodeId: string) => {
      const neighbors = new Set<string>();
      links.forEach((link) => {
        const src = typeof link.source === "string" ? link.source : (link.source as any)?.id;
        const tgt = typeof link.target === "string" ? link.target : (link.target as any)?.id;
        if (src === nodeId) neighbors.add(tgt);
        if (tgt === nodeId) neighbors.add(src);
      });
      return neighbors;
    },
    [links]
  );

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.summary?.slice(0, 20) || "";
      const fontSize = Math.max(11 / globalScale, 2.5);
      const isHighlighted = highlights.includes(node.id);
      const isHovered = hoveredNode === node.id;
      const isPerson = node.type === "person";
      const isConversation = node.type === "conversation";

      // Dim nodes not connected to hovered node
      const neighborIds = hoveredNode ? getNeighborIds(hoveredNode) : null;
      const isDimmed =
        hoveredNode !== null &&
        node.id !== hoveredNode &&
        !isHighlighted &&
        neighborIds &&
        !neighborIds.has(node.id);

      const baseR = isPerson ? 7 : 3;
      const r = isHighlighted ? baseR + 3 : isHovered ? baseR + 2 : baseR;

      // Skip conversation nodes when zoomed out for cleanliness
      if (isConversation && globalScale < 0.6 && !isHighlighted) return;

      // Glow for highlighted / hovered
      if (isHighlighted || isHovered) {
        ctx.shadowColor = isHighlighted ? "#818cf8" : "#a78bfa";
        ctx.shadowBlur = isHighlighted ? 20 : 12;
      }

      const alpha = isDimmed ? 0.15 : 1;

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      const baseColor = NODE_COLORS[node.type] || "#818cf8";
      ctx.fillStyle = isDimmed
        ? `${baseColor}26`
        : isHighlighted
        ? "#a5b4fc"
        : isHovered
        ? "#c4b5fd"
        : baseColor;
      ctx.fill();

      // Soft border
      if (!isDimmed) {
        ctx.strokeStyle = isHighlighted
          ? "#e0e7ff"
          : isHovered
          ? "#c4b5fd"
          : "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = isHighlighted ? 2 : isHovered ? 1.5 : 0.5;
        ctx.stroke();
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Label — always show for person nodes at reasonable zoom
      if (isPerson && !isDimmed && (globalScale > 0.5 || isHighlighted || isHovered)) {
        const labelFontSize = isHovered || isHighlighted
          ? Math.max(13 / globalScale, 4)
          : fontSize;
        ctx.font = `${isHighlighted || isHovered ? "600 " : "400 "}${labelFontSize}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHighlighted
          ? "#e0e7ff"
          : isHovered
          ? "#c4b5fd"
          : `rgba(160, 160, 185, ${alpha})`;
        ctx.fillText(label, node.x, node.y + r + 3);
      }

      // Show interests on hover
      if (isHovered && isPerson && node.interests?.length && globalScale > 0.7) {
        const interestsText = node.interests.slice(0, 3).join(" · ");
        const tagFontSize = Math.max(9 / globalScale, 2);
        ctx.font = `300 ${tagFontSize}px -apple-system, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(129, 140, 248, 0.7)";
        ctx.fillText(interestsText, node.x, node.y + r + 3 + labelFontSize + 4);
      }
    },
    [highlights, hoveredNode, getNeighborIds]
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const src = link.source;
      const tgt = link.target;
      if (!src.x || !tgt.x) return;

      const srcId = src.id || src;
      const tgtId = tgt.id || tgt;

      // Dim links not connected to hovered node
      const isConnectedToHover =
        hoveredNode !== null && (srcId === hoveredNode || tgtId === hoveredNode);
      const isDimmed = hoveredNode !== null && !isConnectedToHover;
      const isLinkHovered = hoveredLink === link;

      if (isDimmed && globalScale < 1) return; // Skip dimmed edges when zoomed out

      const edgeType = link.edge_type || "";
      const strength = link.strength || 0.3;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (isLinkHovered || isConnectedToHover) {
        ctx.strokeStyle = EDGE_HOVER_COLORS[edgeType] || "rgba(255,255,255,0.4)";
        ctx.lineWidth = Math.max(strength * 4, 1.5);
      } else if (isDimmed) {
        ctx.strokeStyle = "rgba(255,255,255,0.02)";
        ctx.lineWidth = 0.3;
      } else {
        ctx.strokeStyle = EDGE_COLORS[edgeType] || "rgba(255,255,255,0.06)";
        ctx.lineWidth = Math.max(strength * 2.5, 0.4);
      }
      ctx.stroke();

      // Show relationship type label on hover
      if (isConnectedToHover && link.relationship_type && globalScale > 0.7) {
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        const labelSize = Math.max(8 / globalScale, 2);
        ctx.font = `300 ${labelSize}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = EDGE_HOVER_COLORS[edgeType] || "rgba(255,255,255,0.5)";
        const label = (link.relationship_type || edgeType).replace(/_/g, " ");
        ctx.fillText(label, midX, midY - 4);
      }
    },
    [hoveredNode, hoveredLink]
  );

  // Apply low repulsion force and boundary constraints for stable clicking
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;
      // Low repulsion force for tighter, more stable layout
      fg.d3Force("charge")?.strength(-30).distanceMax(250);
      // Shorter link distance for compactness
      fg.d3Force("link")?.distance(60);
      // Center gravity to keep nodes in view
      fg.d3Force("center")?.strength(0.05);
    }
  }, [nodes.length]);

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
      onNodeHover={(node: any) => setHoveredNode(node?.id || null)}
      onLinkHover={(link: any) => setHoveredLink(link || null)}
      backgroundColor="#0a0a0f"
      cooldownTicks={200}
      nodeRelSize={7}
      linkDirectionalParticles={0}
      d3AlphaDecay={0.03}
      d3VelocityDecay={0.5}
      d3AlphaMin={0.001}
      enableNodeDrag={true}
      warmupTicks={50}
      minZoom={0.3}
      maxZoom={8}
    />
  );
}
