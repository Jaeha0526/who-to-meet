"use client";

import { useState } from "react";
import { api, MatchCategory } from "../lib/api";

const SPECIAL_CATEGORIES = ["most_unlikely_but_perfect_pair", "challenge_worldview"];

const CATEGORY_STYLES: Record<string, { gradient: string; accent: string }> = {
  most_unlikely_but_perfect_pair: {
    gradient: "from-purple-500/20 via-pink-500/10 to-transparent",
    accent: "#a855f7",
  },
  challenge_worldview: {
    gradient: "from-orange-500/20 via-red-500/10 to-transparent",
    accent: "#f97316",
  },
};

export default function FunMatches() {
  const [categories, setCategories] = useState<MatchCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getMatches();
      setCategories(res.categories || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Separate special featured cards from regular categories
  const specialCats = categories.filter((c) => {
    const cat = (c.category || "").toLowerCase();
    return SPECIAL_CATEGORIES.some((s) => cat.includes(s.replace(/_/g, "")))
      || cat.includes("unlikely")
      || cat.includes("challenge")
      || cat.includes("worldview");
  });
  const regularCats = categories.filter((c) => !specialCats.includes(c));

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-light">Fun Matches</h1>
            <p className="text-sm text-[#8888a0] mt-1">
              Creative pairings based on deep semantic analysis of participant profiles
            </p>
          </div>
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {loading ? "Generating..." : categories.length ? "Regenerate" : "Generate Matches"}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-bounce">🎯</div>
              <p className="text-[#8888a0]">Analyzing deep connections with o3...</p>
              <p className="text-xs text-[#555] mt-1">This may take a moment — we&apos;re looking beyond surface matches</p>
            </div>
          </div>
        )}

        {/* Special Featured Cards */}
        {specialCats.length > 0 && (
          <div className="mb-10 space-y-6">
            {specialCats.map((cat) => {
              const styleKey = cat.category.toLowerCase().includes("unlikely")
                ? "most_unlikely_but_perfect_pair"
                : "challenge_worldview";
              const style = CATEGORY_STYLES[styleKey] || CATEGORY_STYLES.most_unlikely_but_perfect_pair;

              return (
                <div key={cat.category} className="fade-in">
                  <div
                    className={`bg-gradient-to-r ${style.gradient} border border-[#2a2a3e] rounded-2xl p-6 relative overflow-hidden`}
                  >
                    <div className="absolute top-4 right-4 text-5xl opacity-20">
                      {cat.emoji}
                    </div>
                    <h2 className="text-xl font-medium mb-1 flex items-center gap-3">
                      <span className="text-3xl">{cat.emoji}</span>
                      {cat.label}
                    </h2>
                    <p className="text-xs text-[#8888a0] mb-5">
                      {styleKey === "most_unlikely_but_perfect_pair"
                        ? "The pair you'd never think to connect — until you hear why"
                        : "The conversation that would genuinely change how someone sees the world"}
                    </p>

                    <div className="space-y-4">
                      {cat.matches.map((m, i) => (
                        <div
                          key={i}
                          className="bg-[#0a0a0f]/60 backdrop-blur-sm border border-[#2a2a3e] rounded-xl p-5"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span
                              className="px-3 py-1 rounded-lg text-sm font-medium"
                              style={{
                                backgroundColor: `${style.accent}20`,
                                color: style.accent,
                              }}
                            >
                              {m.person1_name}
                            </span>
                            <span className="text-[#555] text-lg">×</span>
                            <span
                              className="px-3 py-1 rounded-lg text-sm font-medium"
                              style={{
                                backgroundColor: `${style.accent}20`,
                                color: style.accent,
                              }}
                            >
                              {m.person2_name}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                              <div className="w-20 h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${m.strength * 100}%`,
                                    backgroundColor: style.accent,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-[#8888a0]">
                                {(m.strength * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-[#c0c0d0] leading-relaxed">
                            {m.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Regular Categories */}
        <div className="space-y-8">
          {regularCats.map((cat) => (
            <div key={cat.category} className="fade-in">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="text-2xl">{cat.emoji}</span>
                {cat.label}
              </h2>
              <div className="space-y-3">
                {cat.matches.map((m, i) => (
                  <div
                    key={i}
                    className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-4 hover:border-[#3a3a4e] transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#6366f1]/20 text-[#818cf8] px-2 py-0.5 rounded text-sm font-medium">
                          {m.person1_name}
                        </span>
                        <span className="text-[#555]">×</span>
                        <span className="bg-[#6366f1]/20 text-[#818cf8] px-2 py-0.5 rounded text-sm font-medium">
                          {m.person2_name}
                        </span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6366f1] rounded-full"
                            style={{ width: `${m.strength * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#8888a0]">
                          {(m.strength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[#8888a0] leading-relaxed">
                      {m.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!loading && categories.length === 0 && !error && (
          <div className="text-center py-20 text-[#8888a0]">
            <p className="text-4xl mb-4">✨</p>
            <p>Click &quot;Generate Matches&quot; to discover creative pairings</p>
            <p className="text-xs mt-2">
              Make sure you have at least 2 participants ingested
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
