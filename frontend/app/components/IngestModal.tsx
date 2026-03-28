"use client";

import { useState } from "react";
import { api } from "../lib/api";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onIngested: () => void;
};

type Tab = "paste" | "transcript" | "batch";

export default function IngestModal({ isOpen, onClose, onIngested }: Props) {
  const [tab, setTab] = useState<Tab>("paste");
  const [name, setName] = useState("");
  const [bioText, setBioText] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [batchJson, setBatchJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{name: string; existingName: string} | null>(null);

  if (!isOpen) return null;

  const handlePaste = async () => {
    if (!name.trim() || !bioText.trim()) return;

    // Check for duplicate first (unless user already confirmed)
    if (!duplicateWarning) {
      try {
        const check = await api.checkDuplicate(name.trim());
        if (check.duplicate) {
          setDuplicateWarning({name: name.trim(), existingName: check.existing_person.name});
          setResult(`⚠ ${check.message}`);
          return;
        }
      } catch {}
    }
    setDuplicateWarning(null);

    setLoading(true);
    try {
      const res = await api.ingestBio(name, bioText);
      setResult(`✓ Added ${res.person.name}`);
      setName("");
      setBioText("");
      onIngested();
    } catch (e: any) {
      setResult(`✗ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscript = async () => {
    if (!transcriptText.trim()) return;
    setLoading(true);
    try {
      const res = await api.ingestTranscript(transcriptText);
      setResult(
        `✓ Extracted ${res.persons_created} participants. Topics: ${res.topics?.join(", ")}`
      );
      setTranscriptText("");
      onIngested();
    } catch (e: any) {
      setResult(`✗ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    if (!batchJson.trim()) return;
    setLoading(true);
    try {
      const data = JSON.parse(batchJson);
      const participants = data.participants || data;
      const res = await api.ingestBatch(participants);
      setResult(`✓ Imported ${res.imported} participants`);
      setBatchJson("");
      onIngested();
    } catch (e: any) {
      setResult(`✗ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "paste", label: "Manual Paste" },
    { key: "transcript", label: "Transcript" },
    { key: "batch", label: "Batch JSON" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl w-[560px] max-h-[80vh] overflow-hidden fade-in">
        <div className="p-4 border-b border-[#2a2a3e] flex justify-between items-center">
          <h2 className="font-medium">Ingest Participant Data</h2>
          <button
            onClick={onClose}
            className="text-[#8888a0] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a3e]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm transition-colors ${
                tab === t.key
                  ? "text-[#6366f1] border-b-2 border-[#6366f1]"
                  : "text-[#8888a0] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* Manual paste */}
          {tab === "paste" && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1]"
              />
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Paste bio, LinkedIn summary, or description..."
                rows={8}
                className="w-full bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] resize-none"
              />
              {duplicateWarning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm text-amber-300 mb-2">
                    ⚠ This looks like someone already in the graph: <strong>{duplicateWarning.existingName}</strong>. Same person?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Proceed with update (will merge with existing)
                        setDuplicateWarning(null);
                        handlePaste();
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 text-sm flex-1"
                    >
                      Yes, update their info
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateWarning(null);
                        setResult("");
                      }}
                      className="bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white rounded-lg px-3 py-1.5 text-sm flex-1"
                    >
                      No, different person
                    </button>
                  </div>
                </div>
              )}
              {!duplicateWarning && (
                <button
                  onClick={handlePaste}
                  disabled={loading || !name.trim() || !bioText.trim()}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm w-full"
                >
                  {loading ? "Extracting..." : "Add Person"}
                </button>
              )}
            </>
          )}

          {/* Transcript */}
          {tab === "transcript" && (
            <>
              <p className="text-xs text-[#8888a0]">
                Paste a conversation transcript. Can be Korean or English.
                Participants labeled as &quot;Attendees 1&quot;, &quot;Speaker A&quot;, etc. will be
                auto-extracted.
              </p>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste transcript here..."
                rows={12}
                className="w-full bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] resize-none font-mono"
              />
              <button
                onClick={handleTranscript}
                disabled={loading || !transcriptText.trim()}
                className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm w-full"
              >
                {loading ? "Extracting entities..." : "Process Transcript"}
              </button>
            </>
          )}

          {/* Batch JSON */}
          {tab === "batch" && (
            <>
              <p className="text-xs text-[#8888a0]">
                Paste JSON with participant data. Format:{" "}
                {`{"participants": [{"name": "...", "bio": "..."}]}`}
              </p>
              <textarea
                value={batchJson}
                onChange={(e) => setBatchJson(e.target.value)}
                placeholder='{"participants": [...]}'
                rows={12}
                className="w-full bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6366f1] resize-none font-mono"
              />
              <button
                onClick={handleBatch}
                disabled={loading || !batchJson.trim()}
                className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm w-full"
              >
                {loading ? "Importing..." : "Import Batch"}
              </button>
            </>
          )}

          {result && (
            <p
              className={`text-sm ${
                result.startsWith("✓") ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {result}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
