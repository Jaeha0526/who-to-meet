"use client";

import { GraphNode, GraphLink } from "../lib/api";

type Props = {
  node: GraphNode | null;
  edge: GraphLink | null;
  onClose: () => void;
};

function Tag({ text, color = "indigo" }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded border ${colors[color]}`}
    >
      {text}
    </span>
  );
}

export default function NodeDetail({ node, edge, onClose }: Props) {
  if (!node && !edge) return null;

  return (
    <div className="fade-in fixed left-4 bottom-4 w-[380px] max-h-[60vh] bg-[#12121a] border border-[#2a2a3e] rounded-xl overflow-hidden shadow-2xl z-40">
      <div className="p-4 border-b border-[#2a2a3e] flex justify-between items-center">
        <h3 className="font-medium text-sm">
          {node ? (node.type === "person" ? "👤 " : "💬 ") : "🔗 "}
          {node?.name || node?.summary?.slice(0, 30) || "Connection Detail"}
        </h3>
        <button
          onClick={onClose}
          className="text-[#8888a0] hover:text-white text-sm"
        >
          ✕
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[calc(60vh-60px)] space-y-3">
        {/* Person node */}
        {node?.type === "person" && (
          <>
            {node.bio && (
              <p className="text-sm text-[#8888a0] leading-relaxed">
                {node.bio}
              </p>
            )}
            {node.interests && node.interests.length > 0 && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Interests
                </p>
                <div className="flex flex-wrap gap-1">
                  {node.interests.map((i) => (
                    <Tag key={i} text={i} color="indigo" />
                  ))}
                </div>
              </div>
            )}
            {node.skills && node.skills.length > 0 && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {node.skills.map((s) => (
                    <Tag key={s} text={s} color="green" />
                  ))}
                </div>
              </div>
            )}
            {node.traits && node.traits.length > 0 && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Traits
                </p>
                <div className="flex flex-wrap gap-1">
                  {node.traits.map((t) => (
                    <Tag key={t} text={t} color="purple" />
                  ))}
                </div>
              </div>
            )}
            {node.goals && node.goals.length > 0 && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Goals
                </p>
                <div className="flex flex-wrap gap-1">
                  {node.goals.map((g) => (
                    <Tag key={g} text={g} color="amber" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Conversation node */}
        {node?.type === "conversation" && (
          <>
            <p className="text-sm text-[#8888a0]">{node.summary}</p>
            {node.topics && node.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {node.topics.map((t) => (
                  <Tag key={t} text={t} color="green" />
                ))}
              </div>
            )}
          </>
        )}

        {/* Edge detail */}
        {edge && (
          <>
            <div>
              <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                Connection Type
              </p>
              <Tag
                text={edge.edge_type.replace(/_/g, " ")}
                color={
                  edge.edge_type === "recommended_match"
                    ? "amber"
                    : edge.edge_type === "shared_interest"
                    ? "green"
                    : "indigo"
                }
              />
            </div>
            <div>
              <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                Strength
              </p>
              <div className="w-full h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6366f1] rounded-full"
                  style={{ width: `${(edge.strength || 0.5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-[#8888a0] mt-0.5">
                {((edge.strength || 0.5) * 100).toFixed(0)}%
              </p>
            </div>
            {edge.reasoning && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Why this connection
                </p>
                <p className="text-sm text-[#e0e0e8] bg-[#1a1a2e] rounded-lg p-3 leading-relaxed">
                  {edge.reasoning}
                </p>
              </div>
            )}
            {edge.match_category && (
              <div>
                <p className="text-xs text-[#555] uppercase tracking-wide mb-1">
                  Category
                </p>
                <Tag
                  text={edge.match_category.replace(/_/g, " ")}
                  color="purple"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
