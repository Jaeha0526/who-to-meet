"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api, ChatMessage, Person } from "../lib/api";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedPerson: Person | null;
  updateKnowledge: boolean;
  onToggleUpdate: (v: boolean) => void;
  persons: Person[];
  onSelectPerson: (p: Person) => void;
  onHighlight: (ids: string[]) => void;
};

export default function ChatSidebar({
  isOpen,
  onClose,
  selectedPerson,
  updateKnowledge,
  onToggleUpdate,
  persons,
  onSelectPerson,
  onHighlight,
}: Props) {
  const STORAGE_KEY = "who-to-meet-chat-history";

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist chat history to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        // localStorage full or unavailable - ignore gracefully
        console.warn("Failed to save chat history:", e);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    // Abort previous request if any
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await api.chat(
        msg,
        selectedPerson?.person_id,
        updateKnowledge,
        abortRef.current?.signal
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          reasoning: res.reasoning,
          recommended_people: res.recommended_people,
          graph_paths: res.graph_paths,
        },
      ]);
      if (res.graph_highlights?.length) {
        onHighlight(res.graph_highlights);
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, selectedPerson?.person_id, updateKnowledge, onHighlight]);

  if (!isOpen) return null;

  return (
    <div className="slide-in fixed right-0 top-14 bottom-0 w-[420px] bg-[#12121a] border-l border-[#2a2a3e] flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a3e] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium">Chat</span>
          {selectedPerson && (
            <span className="text-sm text-[#8888a0] bg-[#1a1a2e] px-2 py-0.5 rounded">
              as {selectedPerson.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-[#8888a0] hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-[#1a1a2e]"
              title="Clear chat history"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[#8888a0] hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Person selector */}
      <div className="px-4 py-2 border-b border-[#2a2a3e] flex items-center gap-3">
        <select
          value={selectedPerson?.person_id || ""}
          onChange={(e) => {
            const p = persons.find((p) => p.person_id === e.target.value);
            if (p) {
              onSelectPerson(p);
              // Clear chat context entirely when switching person
              setMessages([]);
              onHighlight([]);
            }
          }}
          className="flex-1 bg-[#1a1a2e] text-sm border border-[#2a2a3e] rounded px-2 py-1.5 text-[#e0e0e8] outline-none focus:border-[#6366f1]"
        >
          <option value="">Select a person...</option>
          {persons.map((p) => (
            <option key={p.person_id} value={p.person_id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Knowledge Update Toggle */}
        <div className="flex items-center gap-2" title="When ON, your messages teach the system new facts about people. When OFF, just chat and get recommendations.">
          <span className={`text-xs font-medium ${updateKnowledge ? "text-[#f59e0b]" : "text-[#8888a0]"}`}>
            {updateKnowledge ? "📝 Learning" : "💬 Chat"}
          </span>
          <button
            onClick={() => onToggleUpdate(!updateKnowledge)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              updateKnowledge ? "bg-[#f59e0b]" : "bg-[#2a2a3e]"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                updateKnowledge ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[#8888a0] text-sm mt-8">
            <p className="text-lg mb-2">💬</p>
            <p>Ask me who you should meet!</p>
            <p className="mt-1 text-xs">
              Try: &quot;Who should I meet?&quot; or &quot;Who shares my interest in AI?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`fade-in ${
              msg.role === "user" ? "flex justify-end" : ""
            }`}
          >
            {msg.role === "user" ? (
              <div className="bg-[#6366f1] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-[#1a1a2e] rounded-2xl rounded-bl-sm px-4 py-3 max-w-[95%] text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Reasoning chain — always visible */}
                {msg.reasoning && msg.reasoning.length > 0 && (
                  <div className="ml-2 bg-[#0d0d15] border border-[#1e1e30] rounded-lg p-3 max-w-[95%]">
                    <div className="text-xs text-[#6366f1] font-medium mb-2 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[8px]">◈</span>
                      Reasoning Chain
                    </div>
                    <div className="space-y-1.5">
                      {msg.reasoning.map((r, j) => (
                        <div key={j} className="flex gap-2 text-xs">
                          <span className="text-[#6366f1] shrink-0 mt-0.5">→</span>
                          <span className="text-[#a0a0b8]">{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Graph paths — always visible */}
                {msg.graph_paths && msg.graph_paths.length > 0 && (
                  <div className="ml-2 bg-[#0d0d15] border border-[#1e1e30] rounded-lg p-3 max-w-[95%]">
                    <div className="text-xs text-[#22c55e] font-medium mb-2 flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#22c55e]/20 flex items-center justify-center text-[8px]">◉</span>
                      Graph Connections
                    </div>
                    {msg.graph_paths.map((path, pi) => (
                      <div key={pi} className="mb-2 last:mb-0">
                        <div className="text-xs text-[#c0c0d0] mb-1">
                          {path.from_name} → {path.to_name}
                        </div>
                        {path.steps.map((step, si) => (
                          <div key={si} className="flex items-start gap-2 text-xs ml-2 mb-1">
                            <span className="text-[#22c55e] shrink-0">⟶</span>
                            <div>
                              <span className="text-[#8888a0]">
                                {step.from_name} — {step.to_name}
                              </span>
                              {step.relationship_type && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] text-[10px]">
                                  {step.relationship_type.replace(/_/g, " ")}
                                </span>
                              )}
                              {step.edge_reasoning && (
                                <div className="text-[#707088] mt-0.5 italic">
                                  &quot;{step.edge_reasoning.slice(0, 120)}{step.edge_reasoning.length > 120 ? "..." : ""}&quot;
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommended people */}
                {msg.recommended_people &&
                  msg.recommended_people.length > 0 && (
                    <div className="ml-2 space-y-1">
                      {msg.recommended_people.map((rp, j) => (
                        <button
                          key={j}
                          onClick={() => onHighlight([rp.person_id])}
                          className="block text-xs text-left bg-[#1a1a2e] border border-[#2a2a3e] rounded px-2 py-1.5 hover:border-[#6366f1] transition-colors w-full"
                        >
                          <span className="text-[#6366f1] font-medium">
                            {rp.name}
                          </span>
                          <span className="text-[#8888a0] ml-2">
                            {rp.reason?.slice(0, 100)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-1 items-center text-[#8888a0]">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#2a2a3e]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Who should I meet?"
            className="flex-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] text-[#e0e0e8] placeholder-[#555]"
          />
          <button
            onClick={send}
            disabled={loading}
            className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
