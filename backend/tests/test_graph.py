"""Tests for the knowledge graph, models, and API endpoints."""

import asyncio
import json
import pytest
from pathlib import Path

# Import app modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models import Person, Conversation, Edge
from app.graph import KnowledgeGraph


# ── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def kg():
    """Fresh KnowledgeGraph for each test."""
    return KnowledgeGraph()


def _make_person(name="Alice", **kwargs):
    defaults = {"interests": ["AI"], "skills": ["Python"]}
    defaults.update(kwargs)
    return Person(name=name, **defaults)


# ── Test 1: Add and retrieve person ─────────────────────────────

def test_add_and_get_person(kg):
    """Person can be added and retrieved by ID."""
    p = _make_person("Alice")
    kg.add_person(p)
    assert kg.get_person(p.person_id) is not None
    assert kg.get_person(p.person_id).name == "Alice"
    assert len(kg.get_all_persons()) == 1


# ── Test 2: Case-insensitive person name lookup ─────────────────

def test_find_person_by_name_case_insensitive(kg):
    """find_person_by_name matches case-insensitively and strips whitespace."""
    p = _make_person("Jaeha Kim")
    kg.add_person(p)
    assert kg.find_person_by_name("jaeha kim") is not None
    assert kg.find_person_by_name("JAEHA KIM") is not None
    assert kg.find_person_by_name("  Jaeha Kim  ") is not None
    assert kg.find_person_by_name("Jane Doe") is None


# ── Test 3: Cross-transcript person merging via update ──────────

def test_update_person_merges_lists(kg):
    """update_person merges list fields without duplicates."""
    p = _make_person("Bob", interests=["AI", "ML"], skills=["Python"])
    kg.add_person(p)
    kg.update_person(p.person_id, {
        "interests": ["ML", "Robotics"],
        "skills": ["Java"],
    })
    updated = kg.get_person(p.person_id)
    assert "AI" in updated.interests
    assert "ML" in updated.interests
    assert "Robotics" in updated.interests
    assert updated.interests.count("ML") == 1  # no duplicates
    assert "Python" in updated.skills
    assert "Java" in updated.skills


# ── Test 4: Self-loop prevention ────────────────────────────────

def test_self_loop_prevention(kg):
    """add_edge silently drops edges where source == target."""
    p = _make_person("Alice")
    kg.add_person(p)
    edge = Edge(source=p.person_id, target=p.person_id, edge_type="semantic")
    kg.add_edge(edge)
    assert not kg.G.has_edge(p.person_id, p.person_id)


# ── Test 5: Edge merge not overwrite ────────────────────────────

def test_edge_merge_keeps_stronger(kg):
    """Adding a second edge between same nodes merges rather than overwrites."""
    a = _make_person("Alice")
    b = _make_person("Bob")
    kg.add_person(a)
    kg.add_person(b)

    e1 = Edge(source=a.person_id, target=b.person_id, edge_type="semantic",
              strength=0.4, shared_themes=["AI"], reasoning="First reason")
    kg.add_edge(e1)

    e2 = Edge(source=a.person_id, target=b.person_id, edge_type="recommended_match",
              strength=0.8, shared_themes=["ML"], reasoning="Better reason")
    kg.add_edge(e2)

    data = kg.G.edges[a.person_id, b.person_id]
    assert data["strength"] == 0.8  # max of 0.4 and 0.8
    assert "AI" in data["shared_themes"]
    assert "ML" in data["shared_themes"]


# ── Test 6: Get person with None/empty ID ────────────────────────

def test_get_person_null_guard(kg):
    """get_person returns None for None or empty string."""
    assert kg.get_person(None) is None
    assert kg.get_person("") is None
    assert kg.get_person("nonexistent") is None


# ── Test 7: Graph data serialization ────────────────────────────

def test_graph_data_format(kg):
    """get_graph_data returns properly structured dict."""
    a = _make_person("Alice")
    b = _make_person("Bob")
    kg.add_person(a)
    kg.add_person(b)
    edge = Edge(source=a.person_id, target=b.person_id, edge_type="semantic", strength=0.7)
    kg.add_edge(edge)

    data = kg.get_graph_data()
    assert "nodes" in data
    assert "links" in data
    assert len(data["nodes"]) == 2
    assert len(data["links"]) == 1
    assert data["links"][0]["strength"] == 0.7


# ── Test 8: SQLite round-trip persistence ────────────────────────

@pytest.mark.asyncio
async def test_sqlite_round_trip(tmp_path):
    """Data survives save -> load cycle through SQLite."""
    import app.graph as graph_module
    original_path = graph_module.DB_PATH
    graph_module.DB_PATH = tmp_path / "test.db"

    try:
        kg1 = KnowledgeGraph()
        a = _make_person("Alice", interests=["AI", "cooking"])
        b = _make_person("Bob", skills=["Java", "Go"])
        kg1.add_person(a)
        kg1.add_person(b)
        edge = Edge(source=a.person_id, target=b.person_id, edge_type="semantic", strength=0.75)
        kg1.add_edge(edge)
        await kg1.save_to_sqlite()

        kg2 = KnowledgeGraph()
        loaded = await kg2.load_from_sqlite()
        assert loaded is True
        assert len(kg2.persons) == 2
        assert kg2.find_person_by_name("Alice") is not None
        assert kg2.find_person_by_name("Bob") is not None
        alice = kg2.find_person_by_name("Alice")
        assert "cooking" in alice.interests
    finally:
        graph_module.DB_PATH = original_path


# ── Test 9: Conversation adds participation edges ───────────────

def test_conversation_adds_edges(kg):
    """Adding a conversation creates participated_in edges."""
    a = _make_person("Alice")
    b = _make_person("Bob")
    kg.add_person(a)
    kg.add_person(b)

    conv = Conversation(
        participant_ids=[a.person_id, b.person_id],
        summary="Discussed AI",
        topics=["AI", "ML"],
    )
    kg.add_conversation(conv)

    assert kg.G.has_edge(a.person_id, conv.conversation_id)
    assert kg.G.has_edge(b.person_id, conv.conversation_id)
    edge_data = kg.G.edges[a.person_id, conv.conversation_id]
    assert edge_data["edge_type"] == "participated_in"


# ── Test 10: Unique IDs for persons ─────────────────────────────

def test_person_ids_are_unique():
    """Each Person gets a unique ID."""
    p1 = Person(name="Alice")
    p2 = Person(name="Alice")
    assert p1.person_id != p2.person_id


# ── Test 11 (bonus): find_person_by_name returns None for empty/None ──

def test_find_person_by_name_empty(kg):
    """find_person_by_name handles None and empty string safely."""
    kg.add_person(_make_person("Alice"))
    assert kg.find_person_by_name("") is None
    assert kg.find_person_by_name(None) is None
