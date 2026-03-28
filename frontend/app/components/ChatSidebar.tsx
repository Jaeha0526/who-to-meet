"use client";

import { useState, useRef, useEffect } from "react";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await api.chat(
        msg,
        selectedPerson?.person_id,
        updateKnowledge
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          reasoning: res.reasoning,
          recommended_people: res.recommended_people,
        },
      ]);
      if (res.graph_highlights?.length) {
        onHighlight(res.graph_highlights);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="slide-in fixed right-0 top-14 bottom-0 w-[420px] bg-[#12121a] border-l border-[#2a2a3e] flex flex-col z-50">
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
        <button
          onClick={onClose}
          className="text-[#8888a0] hover:text-white transition-colors text-xl"
        >
          ✕
        </button>
      </div>

      {/* Person selector */}
      <div className="px-4 py-2 border-b border-[#2a2a3e] flex items-center gap-3">
        <select
          value={selectedPerson?.person_id || ""}
          onChange={(e) => {
            const p = persons.find((p) => p.person_id === e.target.value);
            if (p) onSelectPerson(p);
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

        {/* Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8888a0]">Update</span>
          <button
            onClick={() => onToggleUpdate(!updateKnowledge)}
            className={`w-10 h-5 rounded-full relative transition-colors ${
              updateKnowledge ? "bg-[#6366f1]" : "bg-[#2a2a3e]"
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
                {/* Reasoning transparency */}
                {msg.reasoning && msg.reasoning.length > 0 && (
                  <details className="ml-2">
                    <summary className="text-xs text-[#8888a0] cursor-pointer hover:text-[#6366f1]">
                      Show reasoning ({msg.reasoning.length} steps)
                    </summary>
                    <div className="mt-1 ml-2 space-y-1">
                      {msg.reasoning.map((r, j) => (
                        <div
                          key={j}
                          className="text-xs text-[#8888a0] bg-[#0a0a0f] rounded px-2 py-1"
                        >
                          {r}
                        </div>
                      ))}
                    </div>
                  </details>
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
                            {rp.reason?.slice(0, 80)}...
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
