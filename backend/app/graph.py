"""In-memory knowledge graph using NetworkX with SQLite persistence."""

from __future__ import annotations
import json
import aiosqlite
import networkx as nx
from pathlib import Path
from .models import Person, Conversation, Edge

DB_PATH = Path(__file__).parent.parent / "who_to_meet.db"


class KnowledgeGraph:
    """Wraps a NetworkX graph with typed person/conversation nodes and edges."""

    def __init__(self):
        self.G = nx.Graph()
        self.persons: dict[str, Person] = {}
        self.conversations: dict[str, Conversation] = {}

    # ── Person operations ────────────────────────────────────────

    def add_person(self, person: Person) -> Person:
        self.persons[person.person_id] = person
        self.G.add_node(
            person.person_id,
            type="person",
            name=person.name,
            interests=person.interests,
            skills=person.skills,
            traits=person.traits,
            goals=person.goals,
            bio=person.bio,
        )
        return person

    def update_person(self, person_id: str, updates: dict) -> Person | None:
        if person_id not in self.persons:
            return None
        p = self.persons[person_id]
        for key, val in updates.items():
            if hasattr(p, key):
                if isinstance(getattr(p, key), list) and isinstance(val, list):
                    existing = getattr(p, key)
                    merged = list(dict.fromkeys(existing + val))  # dedup preserve order
                    setattr(p, key, merged)
                else:
                    setattr(p, key, val)
        # Update graph node attrs
        self.G.nodes[person_id].update({
            "interests": p.interests,
            "skills": p.skills,
            "traits": p.traits,
            "goals": p.goals,
            "bio": p.bio,
            "name": p.name,
        })
        return p

    def get_person(self, person_id: str) -> Person | None:
        return self.persons.get(person_id)

    def get_all_persons(self) -> list[Person]:
        return list(self.persons.values())

    def find_person_by_name(self, name: str) -> Person | None:
        name_lower = name.lower().strip()
        for p in self.persons.values():
            if p.name.lower().strip() == name_lower:
                return p
        return None

    # ── Conversation operations ──────────────────────────────────

    def add_conversation(self, conv: Conversation):
        self.conversations[conv.conversation_id] = conv
        self.G.add_node(
            conv.conversation_id,
            type="conversation",
            summary=conv.summary,
            topics=conv.topics,
        )
        # Link participants to conversation and to each other
        for pid in conv.participant_ids:
            if pid in self.persons:
                self.persons[pid].conversations.append(conv.conversation_id)
                self.G.add_edge(
                    pid, conv.conversation_id,
                    edge_type="participated_in",
                    reasoning=f"Participated in conversation about: {', '.join(conv.topics[:3])}",
                    strength=0.6,
                )

    # ── Edge operations ──────────────────────────────────────────

    def add_edge(self, edge: Edge):
        self.G.add_edge(
            edge.source, edge.target,
            edge_type=edge.edge_type,
            reasoning=edge.reasoning,
            strength=edge.strength,
            match_category=edge.match_category,
        )

    def get_edges_for_person(self, person_id: str) -> list[dict]:
        edges = []
        if person_id in self.G:
            for neighbor in self.G.neighbors(person_id):
                data = self.G.edges[person_id, neighbor]
                edges.append({
                    "source": person_id,
                    "target": neighbor,
                    **data,
                })
        return edges

    # ── Graph data for frontend ──────────────────────────────────

    def get_graph_data(self) -> dict:
        nodes = []
        for nid, attrs in self.G.nodes(data=True):
            node = {"id": nid, **attrs}
            # Convert lists to ensure JSON serializable
            for k, v in node.items():
                if isinstance(v, (list, dict)):
                    node[k] = v
            nodes.append(node)

        links = []
        for u, v, attrs in self.G.edges(data=True):
            links.append({"source": u, "target": v, **attrs})

        return {"nodes": nodes, "links": links}

    # ── Context for LLM ──────────────────────────────────────────

    def get_person_context(self, person_id: str) -> str:
        """Build a rich text context about a person for LLM prompting."""
        p = self.persons.get(person_id)
        if not p:
            return ""
        lines = [
            f"Name: {p.name}",
            f"Bio: {p.bio}" if p.bio else "",
            f"Interests: {', '.join(p.interests)}" if p.interests else "",
            f"Skills: {', '.join(p.skills)}" if p.skills else "",
            f"Traits: {', '.join(p.traits)}" if p.traits else "",
            f"Goals: {', '.join(p.goals)}" if p.goals else "",
        ]
        # Add conversation summaries
        for cid in p.conversations:
            conv = self.conversations.get(cid)
            if conv:
                lines.append(f"Conversation ({cid}): {conv.summary}")
        return "\n".join(l for l in lines if l)

    def get_all_persons_context(self) -> str:
        """Build context about all persons for recommendation LLM."""
        parts = []
        for p in self.persons.values():
            parts.append(self.get_person_context(p.person_id))
        return "\n\n---\n\n".join(parts)

    # ── Persistence ──────────────────────────────────────────────

    async def save_to_sqlite(self):
        async with aiosqlite.connect(str(DB_PATH)) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS graph_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    persons_json TEXT,
                    conversations_json TEXT,
                    edges_json TEXT
                )
            """)
            persons_json = json.dumps({k: v.model_dump() for k, v in self.persons.items()})
            convs_json = json.dumps({k: v.model_dump() for k, v in self.conversations.items()})
            edges = []
            for u, v, data in self.G.edges(data=True):
                edges.append({"source": u, "target": v, **data})
            edges_json = json.dumps(edges)

            await db.execute("""
                INSERT OR REPLACE INTO graph_state (id, persons_json, conversations_json, edges_json)
                VALUES (1, ?, ?, ?)
            """, (persons_json, convs_json, edges_json))
            await db.commit()

    async def load_from_sqlite(self) -> bool:
        if not DB_PATH.exists():
            return False
        try:
            async with aiosqlite.connect(str(DB_PATH)) as db:
                cursor = await db.execute("SELECT persons_json, conversations_json, edges_json FROM graph_state WHERE id = 1")
                row = await cursor.fetchone()
                if not row:
                    return False

                persons_data = json.loads(row[0])
                convs_data = json.loads(row[1])
                edges_data = json.loads(row[2])

                for pid, pdata in persons_data.items():
                    person = Person(**pdata)
                    self.add_person(person)

                for cid, cdata in convs_data.items():
                    conv = Conversation(**cdata)
                    self.add_conversation(conv)

                for edata in edges_data:
                    if edata.get("edge_type") != "participated_in":
                        self.G.add_edge(
                            edata["source"], edata["target"],
                            edge_type=edata.get("edge_type", ""),
                            reasoning=edata.get("reasoning", ""),
                            strength=edata.get("strength", 0.5),
                            match_category=edata.get("match_category", ""),
                        )
                return True
        except Exception:
            return False


# Singleton
graph = KnowledgeGraph()
