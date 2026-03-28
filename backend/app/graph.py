"""In-memory knowledge graph using NetworkX with SQLite persistence."""

from __future__ import annotations
import asyncio
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
        self._save_lock = asyncio.Lock()

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
        if person_id in self.G:
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
        if not person_id:
            return None
        return self.persons.get(person_id)

    def get_all_persons(self) -> list[Person]:
        return list(self.persons.values())

    def find_person_by_name(self, name: str) -> Person | None:
        if not name:
            return None
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
        # Self-loop prevention
        if edge.source == edge.target:
            return

        # Edge merge: if edge already exists, merge rather than overwrite
        if self.G.has_edge(edge.source, edge.target):
            existing = self.G.edges[edge.source, edge.target]
            # Keep the stronger edge, merge themes
            new_strength = max(existing.get("strength", 0), edge.strength)
            existing_themes = existing.get("shared_themes", []) or []
            merged_themes = list(dict.fromkeys(existing_themes + (edge.shared_themes or [])))
            # Prefer non-empty reasoning
            reasoning = edge.reasoning or existing.get("reasoning", "")
            self.G.edges[edge.source, edge.target].update({
                "strength": new_strength,
                "shared_themes": merged_themes,
                "reasoning": reasoning,
                # Keep the more specific edge type
                "edge_type": edge.edge_type or existing.get("edge_type", ""),
                "relationship_type": edge.relationship_type or existing.get("relationship_type", ""),
                "match_category": edge.match_category or existing.get("match_category", ""),
                "conversation_starter": edge.conversation_starter or existing.get("conversation_starter", ""),
            })
        else:
            self.G.add_edge(
                edge.source, edge.target,
                edge_type=edge.edge_type,
                relationship_type=edge.relationship_type,
                reasoning=edge.reasoning,
                strength=edge.strength,
                match_category=edge.match_category,
                shared_themes=edge.shared_themes,
                conversation_starter=edge.conversation_starter,
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

    # ── Path finding ────────────────────────────────────────────

    def find_paths_between(self, source_id: str, target_id: str, max_paths: int = 3) -> list[dict]:
        """Find shortest paths between two persons, returning edge details along the way."""
        if source_id not in self.G or target_id not in self.G:
            return []
        if source_id == target_id:
            return []
        paths_info = []
        try:
            for path in nx.all_shortest_paths(self.G, source_id, target_id):
                path_edges = []
                for i in range(len(path) - 1):
                    u, v = path[i], path[i + 1]
                    edge_data = self.G.edges[u, v]
                    u_name = self.G.nodes[u].get("name", u)
                    v_name = self.G.nodes[v].get("name", v)
                    path_edges.append({
                        "from_id": u,
                        "from_name": u_name,
                        "to_id": v,
                        "to_name": v_name,
                        "edge_type": edge_data.get("edge_type", ""),
                        "relationship_type": edge_data.get("relationship_type", ""),
                        "edge_reasoning": edge_data.get("reasoning", ""),
                        "strength": edge_data.get("strength", 0),
                    })
                paths_info.append({"steps": path_edges, "length": len(path) - 1})
                if len(paths_info) >= max_paths:
                    break
        except nx.NetworkXNoPath:
            pass
        return paths_info

    # ── Context for LLM ──────────────────────────────────────────

    def get_person_context(self, person_id: str) -> str:
        """Build a rich text context about a person for LLM prompting."""
        p = self.persons.get(person_id)
        if not p:
            return ""
        lines = [
            f"Name: {p.name}",
            f"Person ID: {p.person_id}",
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
        async with self._save_lock:
            try:
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
            except Exception as e:
                print(f"ERROR saving to SQLite: {e}")

    async def load_from_sqlite(self) -> bool:
        if not DB_PATH.exists():
            return False
        try:
            async with aiosqlite.connect(str(DB_PATH)) as db:
                cursor = await db.execute("SELECT persons_json, conversations_json, edges_json FROM graph_state WHERE id = 1")
                row = await cursor.fetchone()
                if not row:
                    return False

                # Partial load safety: load each section independently
                persons_data = {}
                convs_data = {}
                edges_data = []

                try:
                    persons_data = json.loads(row[0]) if row[0] else {}
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"WARNING: Failed to parse persons_json: {e}")

                try:
                    convs_data = json.loads(row[1]) if row[1] else {}
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"WARNING: Failed to parse conversations_json: {e}")

                try:
                    edges_data = json.loads(row[2]) if row[2] else []
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"WARNING: Failed to parse edges_json: {e}")

                for pid, pdata in persons_data.items():
                    try:
                        person = Person(**pdata)
                        self.add_person(person)
                    except Exception as e:
                        print(f"WARNING: Skipping person {pid}: {e}")

                for cid, cdata in convs_data.items():
                    try:
                        conv = Conversation(**cdata)
                        self.add_conversation(conv)
                    except Exception as e:
                        print(f"WARNING: Skipping conversation {cid}: {e}")

                for edata in edges_data:
                    try:
                        if edata.get("edge_type") != "participated_in":
                            source = edata.get("source", "")
                            target = edata.get("target", "")
                            if source and target and source != target:
                                self.G.add_edge(
                                    source, target,
                                    edge_type=edata.get("edge_type", ""),
                                    relationship_type=edata.get("relationship_type", ""),
                                    reasoning=edata.get("reasoning", ""),
                                    strength=edata.get("strength", 0.5),
                                    match_category=edata.get("match_category", ""),
                                    shared_themes=edata.get("shared_themes", []),
                                    conversation_starter=edata.get("conversation_starter", ""),
                                )
                    except Exception as e:
                        print(f"WARNING: Skipping edge: {e}")

                return True
        except Exception as e:
            import traceback
            print(f"ERROR loading from SQLite: {e}")
            traceback.print_exc()
            return False


# Singleton
graph = KnowledgeGraph()
