const API = "http://localhost:8000/api";

async function f(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

export const api = {
  health: () => f("/health"),
  getGraph: () => f("/graph"),
  getPersons: () => f("/persons"),
  getPerson: (id: string) => f(`/persons/${id}`),

  ingestTranscript: (text: string, mapping?: Record<string, string>) =>
    f("/ingest/transcript", {
      method: "POST",
      body: JSON.stringify({ text, participant_mapping: mapping || {} }),
    }),

  ingestBio: (name: string, bio_text: string) =>
    f("/ingest/bio", {
      method: "POST",
      body: JSON.stringify({ name, bio_text }),
    }),

  ingestBatch: (participants: any[]) =>
    f("/ingest/batch", {
      method: "POST",
      body: JSON.stringify({ participants }),
    }),

  chat: (message: string, person_id?: string, update_knowledge?: boolean) =>
    f("/chat", {
      method: "POST",
      body: JSON.stringify({ message, person_id, update_knowledge }),
    }),

  getMatches: () => f("/matches"),
  reset: () => f("/reset", { method: "POST" }),
};

export type Person = {
  person_id: string;
  name: string;
  bio: string;
  interests: string[];
  skills: string[];
  traits: string[];
  goals: string[];
  source_type: string;
  conversations: string[];
};

export type GraphNode = {
  id: string;
  type: string;
  name?: string;
  interests?: string[];
  skills?: string[];
  traits?: string[];
  goals?: string[];
  bio?: string;
  summary?: string;
  topics?: string[];
  x?: number;
  y?: number;
};

export type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  edge_type: string;
  reasoning: string;
  strength: number;
  match_category?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string[];
  recommended_people?: { person_id: string; name: string; reason: string }[];
};

export type MatchCategory = {
  category: string;
  label: string;
  emoji: string;
  matches: {
    person1_name: string;
    person1_id: string;
    person2_name: string;
    person2_id: string;
    explanation: string;
    strength: number;
  }[];
};
