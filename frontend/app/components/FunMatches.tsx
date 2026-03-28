"use client";

import { useState, useEffect } from "react";
import { api, MatchCategory } from "../lib/api";

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

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-light">Fun Matches</h1>
            <p className="text-sm text-[#8888a0] mt-1">
              Creative pairings based on real shared interests and complementary skills
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
              <p className="text-[#8888a0]">Analyzing connections...</p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {categories.map((cat) => (
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
