"""Pydantic models for the who-to-meet knowledge graph."""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
import uuid


def _id() -> str:
    return str(uuid.uuid4())[:8]


# ── Core entities ────────────────────────────────────────────────

class Person(BaseModel):
    person_id: str = Field(default_factory=_id)
    name: str
    bio: str = ""
    interests: list[str] = []
    skills: list[str] = []
    traits: list[str] = []
    goals: list[str] = []
    source_type: str = "manual_paste"  # batch_csv | manual_paste | transcript
    source_raw: str = ""
    conversations: list[str] = []  # conversation_ids


class Conversation(BaseModel):
    conversation_id: str = Field(default_factory=_id)
    participant_ids: list[str] = []
    summary: str = ""
    topics: list[str] = []
    raw_text: str = ""


class Edge(BaseModel):
    source: str  # person_id
    target: str  # person_id
    edge_type: str  # past_interaction | recommended_match | shared_interest | semantic
    relationship_type: str = ""  # shared_mission | complementary_skills | mutual_learning | creative_tension | shared_experience | potential_collaborators
    reasoning: str = ""
    strength: float = 0.5
    match_category: str = ""  # startup_cofounders | potential_friends | creative_pair
    shared_themes: list[str] = []
    conversation_starter: str = ""


# ── API request / response ───────────────────────────────────────

class IngestTranscriptRequest(BaseModel):
    text: str
    participant_mapping: dict[str, str] = {}  # e.g. {"Attendees 1": "Jaeha"}
    language: str = "auto"  # auto | ko | en


class IngestBioRequest(BaseModel):
    name: str
    bio_text: str
    source_type: str = "manual_paste"


class BatchImportRequest(BaseModel):
    participants: list[dict]  # list of {name, bio, ...}


class ChatRequest(BaseModel):
    message: str
    person_id: Optional[str] = None  # whose perspective
    update_knowledge: bool = False  # toggle switch


class ChatResponse(BaseModel):
    reply: str
    reasoning: list[str] = []
    recommended_people: list[dict] = []
    graph_highlights: list[str] = []  # node/edge ids to highlight
    graph_paths: list[dict] = []  # [{from, to, via, edge_reasoning, edge_type}]


class GraphData(BaseModel):
    nodes: list[dict]
    links: list[dict]


class MatchCategory(BaseModel):
    category: str
    label: str
    emoji: str
    matches: list[dict]  # [{person1, person2, explanation, strength}]
