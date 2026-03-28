"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Person, GraphNode, GraphLink } from "./lib/api";
import ForceGraph from "./components/ForceGraph";
import ChatSidebar from "./components/ChatSidebar";
import NodeDetail from "./components/NodeDetail";
import EntityDashboard from "./components/EntityDashboard";
import FunMatches from "./components/FunMatches";
import IngestModal from "./components/IngestModal";

type Tab = "graph" | "dashboard" | "fun";

export default function Home() {
  const [tab, setTab] = useState<Tab>("graph");
  const [persons, setPersons] = useState<Person[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [updateKnowledge, setUpdateKnowledge] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphLink | null>(null);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [graphData, personsData] = await Promise.all([
        api.getGraph(),
        api.getPersons(),
      ]);
      setNodes(graphData.nodes || []);
      setLinks(graphData.links || []);
      setPersons(personsData || []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (node.type === "person") {
      const p = persons.find((p) => p.person_id === node.id);
      if (p) setSelectedPerson(p);
    }
  };

  const handleEdgeClick = (link: GraphLink) => {
    setSelectedEdge(link);
    setSelectedNode(null);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "graph", label: "Graph", icon: "◉" },
    { key: "dashboard", label: "People", icon: "◫" },
    { key: "fun", label: "Matches", icon: "✦" },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-[#2a2a3e] bg-[#0a0a0f]/90 backdrop-blur-sm flex items-center px-4 justify-between z-50 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium tracking-wide">
            <span className="text-[#6366f1]">who</span>
            <span className="text-[#8888a0]">to</span>
            <span className="text-[#e0e0e8]">meet</span>
          </h1>
          <span className="text-xs text-[#555] bg-[#1a1a2e] px-2 py-0.5 rounded">
            Ralphthon
          </span>

          {/* Tabs */}
          <nav className="flex gap-1 ml-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === t.key
                    ? "bg-[#6366f1]/20 text-[#818cf8]"
                    : "text-[#8888a0] hover:text-white hover:bg-[#1a1a2e]"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-[#8888a0]">
            {persons.length} people
          </span>
          <button
            onClick={() => setIngestOpen(true)}
            className="bg-[#1a1a2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-sm text-[#e0e0e8] rounded-lg px-3 py-1.5 transition-colors"
          >
            + Ingest
          </button>
          {tab === "graph" && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`text-sm rounded-lg px-3 py-1.5 transition-colors ${
                chatOpen
                  ? "bg-[#6366f1] text-white"
                  : "bg-[#1a1a2e] hover:bg-[#2a2a3e] border border-[#2a2a3e] text-[#e0e0e8]"
              }`}
            >
              💬 Chat
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Graph tab */}
        {tab === "graph" && (
          <>
            <ForceGraph
              nodes={nodes}
              links={links}
              highlights={highlights}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
            <NodeDetail
              node={selectedNode}
              edge={selectedEdge}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
            />
            <ChatSidebar
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              selectedPerson={selectedPerson}
              updateKnowledge={updateKnowledge}
              onToggleUpdate={setUpdateKnowledge}
              persons={persons}
              onSelectPerson={setSelectedPerson}
              onHighlight={setHighlights}
            />
          </>
        )}

        {/* Dashboard tab */}
        {tab === "dashboard" && (
          <EntityDashboard
            persons={persons}
            selectedPerson={selectedPerson}
            onSelectPerson={setSelectedPerson}
          />
        )}

        {/* Fun matches tab */}
        {tab === "fun" && <FunMatches />}
      </main>

      {/* Ingest modal */}
      <IngestModal
        isOpen={ingestOpen}
        onClose={() => setIngestOpen(false)}
        onIngested={refresh}
      />
    </div>
  );
}
