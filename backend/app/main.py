"""FastAPI backend for who-to-meet knowledge graph app."""

from __future__ import annotations
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    Person, Conversation, Edge,
    IngestTranscriptRequest, IngestBioRequest, BatchImportRequest,
    ChatRequest, ChatResponse, GraphData, MatchCategory,
)
from .graph import graph
from . import llm


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load persisted state on startup
    loaded = await graph.load_from_sqlite()
    if loaded:
        print(f"✓ Loaded {len(graph.persons)} persons from SQLite")
    else:
        print("◦ Starting with empty graph")
    yield
    # Save state on shutdown
    await graph.save_to_sqlite()
    print("✓ Graph saved to SQLite")


app = FastAPI(title="Who-to-Meet", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ───────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "persons": len(graph.persons), "conversations": len(graph.conversations)}


# ── Ingestion ────────────────────────────────────────────────────

@app.post("/api/ingest/transcript")
async def ingest_transcript(req: IngestTranscriptRequest):
    """Ingest a conversation transcript and extract person entities."""
    try:
        extracted = await llm.extract_persons_from_transcript(
            req.text, req.participant_mapping, req.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")

    conv = Conversation(
        summary=extracted.get("conversation_summary", ""),
        topics=extracted.get("conversation_topics", []),
        raw_text=req.text,
    )

    created_persons = []
    for p_data in extracted.get("participants", []):
        name = p_data.get("name", p_data.get("label", "Unknown"))
        # Check if person already exists
        existing = graph.find_person_by_name(name)
        if existing:
            graph.update_person(existing.person_id, {
                "interests": p_data.get("interests", []),
                "skills": p_data.get("skills", []),
                "traits": p_data.get("traits", []),
                "goals": p_data.get("goals", []),
            })
            conv.participant_ids.append(existing.person_id)
            created_persons.append(existing.model_dump())
        else:
            person = Person(
                name=name,
                interests=p_data.get("interests", []),
                skills=p_data.get("skills", []),
                traits=p_data.get("traits", []),
                goals=p_data.get("goals", []),
                source_type="transcript",
                source_raw=req.text[:500],
            )
            graph.add_person(person)
            conv.participant_ids.append(person.person_id)
            created_persons.append(person.model_dump())

    graph.add_conversation(conv)

    # Add interaction edges between all participants in this conversation
    pids = conv.participant_ids
    for i in range(len(pids)):
        for j in range(i + 1, len(pids)):
            edge = Edge(
                source=pids[i],
                target=pids[j],
                edge_type="past_interaction",
                reasoning=f"Both participated in a conversation about: {', '.join(conv.topics[:3])}",
                strength=0.6,
            )
            graph.add_edge(edge)

    await graph.save_to_sqlite()
    return {
        "status": "ok",
        "conversation_id": conv.conversation_id,
        "persons_created": len(created_persons),
        "persons": created_persons,
        "summary": conv.summary,
        "topics": conv.topics,
    }


@app.post("/api/ingest/bio")
async def ingest_bio(req: IngestBioRequest):
    """Ingest a single bio/LinkedIn profile text."""
    try:
        extracted = await llm.extract_person_from_bio(req.name, req.bio_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM extraction failed: {str(e)}")

    existing = graph.find_person_by_name(req.name)
    if existing:
        graph.update_person(existing.person_id, {
            "bio": req.bio_text,
            "interests": extracted.get("interests", []),
            "skills": extracted.get("skills", []),
            "traits": extracted.get("traits", []),
            "goals": extracted.get("goals", []),
        })
        person = existing
    else:
        person = Person(
            name=req.name,
            bio=req.bio_text,
            interests=extracted.get("interests", []),
            skills=extracted.get("skills", []),
            traits=extracted.get("traits", []),
            goals=extracted.get("goals", []),
            source_type=req.source_type,
            source_raw=req.bio_text,
        )
        graph.add_person(person)

    # Add shared_interest edges to existing people with overlapping interests
    for other in graph.get_all_persons():
        if other.person_id == person.person_id:
            continue
        shared = set(i.lower() for i in person.interests) & set(i.lower() for i in other.interests)
        if shared:
            edge = Edge(
                source=person.person_id,
                target=other.person_id,
                edge_type="shared_interest",
                reasoning=f"Both interested in: {', '.join(shared)}",
                strength=min(0.3 + len(shared) * 0.15, 1.0),
            )
            graph.add_edge(edge)

    await graph.save_to_sqlite()
    return {"status": "ok", "person": person.model_dump()}


@app.post("/api/ingest/batch")
async def ingest_batch(req: BatchImportRequest):
    """Batch import participants from CSV/JSON data."""
    results = []
    for p_data in req.participants:
        name = p_data.get("name", "Unknown")
        bio = p_data.get("bio", "") or p_data.get("linkedin", "") or p_data.get("description", "")

        # Only call LLM if structured data not provided
        has_structured = any(p_data.get(k) for k in ("interests", "skills", "traits", "goals"))
        if bio and not has_structured:
            try:
                extracted = await llm.extract_person_from_bio(name, bio)
            except Exception:
                extracted = {}
        else:
            extracted = {}

        existing = graph.find_person_by_name(name)
        if existing:
            graph.update_person(existing.person_id, {
                "bio": bio,
                "interests": p_data.get("interests", extracted.get("interests", [])),
                "skills": p_data.get("skills", extracted.get("skills", [])),
                "traits": p_data.get("traits", extracted.get("traits", [])),
                "goals": p_data.get("goals", extracted.get("goals", [])),
            })
            results.append(existing.model_dump())
        else:
            person = Person(
                name=name,
                bio=bio,
                interests=p_data.get("interests", extracted.get("interests", [])),
                skills=p_data.get("skills", extracted.get("skills", [])),
                traits=p_data.get("traits", extracted.get("traits", [])),
                goals=p_data.get("goals", extracted.get("goals", [])),
                source_type="batch_csv",
                source_raw=bio,
            )
            graph.add_person(person)
            results.append(person.model_dump())

    # Compute shared interest/skill edges using keyword overlap
    persons = graph.get_all_persons()
    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            p1, p2 = persons[i], persons[j]
            if graph.G.has_edge(p1.person_id, p2.person_id):
                continue
            # Exact interest matches
            shared_interests = set(k.lower() for k in p1.interests) & set(k.lower() for k in p2.interests)
            # Exact skill matches
            shared_skills = set(k.lower() for k in p1.skills) & set(k.lower() for k in p2.skills)
            # Keyword overlap in interests (partial match)
            p1_words = set(w.lower() for s in p1.interests + p1.skills for w in s.split() if len(w) > 3)
            p2_words = set(w.lower() for s in p2.interests + p2.skills for w in s.split() if len(w) > 3)
            keyword_overlap = p1_words & p2_words - {"and", "the", "for", "with"}

            reasons = []
            if shared_interests:
                reasons.append(f"shared interests: {', '.join(shared_interests)}")
            if shared_skills:
                reasons.append(f"shared skills: {', '.join(shared_skills)}")
            if not reasons and len(keyword_overlap) >= 2:
                reasons.append(f"overlapping keywords: {', '.join(list(keyword_overlap)[:5])}")

            if reasons:
                strength = min(0.3 + len(shared_interests) * 0.15 + len(shared_skills) * 0.1 + len(keyword_overlap) * 0.05, 1.0)
                edge = Edge(
                    source=p1.person_id,
                    target=p2.person_id,
                    edge_type="shared_interest",
                    reasoning=f"Both connected via {'; '.join(reasons)}",
                    strength=strength,
                )
                graph.add_edge(edge)

    await graph.save_to_sqlite()
    return {"status": "ok", "imported": len(results), "persons": results}


# ── Graph data ───────────────────────────────────────────────────

@app.get("/api/graph")
async def get_graph():
    """Get full graph data for visualization."""
    return graph.get_graph_data()


@app.get("/api/persons")
async def get_persons():
    """Get all persons."""
    return [p.model_dump() for p in graph.get_all_persons()]


@app.get("/api/persons/{person_id}")
async def get_person(person_id: str):
    """Get a single person with their connections."""
    p = graph.get_person(person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    edges = graph.get_edges_for_person(person_id)
    return {"person": p.model_dump(), "connections": edges}


# ── Chat ─────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Chat with the networking agent."""
    person_context = ""
    if req.person_id:
        person_context = graph.get_person_context(req.person_id)
        if not person_context:
            person_context = "No specific person selected."

    all_context = graph.get_all_persons_context()
    if not all_context:
        return ChatResponse(
            reply="I don't know anyone yet! Please ingest some participant data first using the import features.",
            reasoning=["No participant data has been ingested yet."],
        )

    # Check if this is a recommendation query
    rec_keywords = ["who should i meet", "recommend", "who to meet", "who should i talk to", "suggest someone", "introduce me"]
    is_recommendation = any(kw in req.message.lower() for kw in rec_keywords)

    try:
        if is_recommendation and req.person_id:
            result = await llm.generate_recommendations(person_context, all_context, req.message)
            recs = result.get("recommendations", [])

            # Add recommendation edges to graph
            for rec in recs:
                pid = rec.get("person_id", "")
                if pid and req.person_id:
                    edge = Edge(
                        source=req.person_id,
                        target=pid,
                        edge_type="recommended_match",
                        reasoning=rec.get("reasoning", ""),
                        strength=rec.get("connection_strength", 0.5),
                    )
                    graph.add_edge(edge)

            # Format reply
            reply_parts = [result.get("overall_reasoning", "Here are my recommendations:"), ""]
            for i, rec in enumerate(recs, 1):
                reply_parts.append(f"**{i}. {rec.get('person_name', 'Unknown')}** (strength: {rec.get('connection_strength', 0):.0%})")
                reply_parts.append(f"   Why: {rec.get('reasoning', '')}")
                if rec.get("shared_interests"):
                    reply_parts.append(f"   Shared interests: {', '.join(rec['shared_interests'])}")
                if rec.get("complementary_skills"):
                    reply_parts.append(f"   Complementary: {', '.join(rec['complementary_skills'])}")
                reply_parts.append(f"   💬 Starter: \"{rec.get('conversation_starter', '')}\"")
                reply_parts.append("")

            return ChatResponse(
                reply="\n".join(reply_parts),
                reasoning=[rec.get("reasoning", "") for rec in recs],
                recommended_people=[
                    {"person_id": r.get("person_id"), "name": r.get("person_name"), "reason": r.get("reasoning")}
                    for r in recs
                ],
                graph_highlights=[r.get("person_id", "") for r in recs if r.get("person_id")],
            )
        else:
            result = await llm.chat_with_agent(person_context, all_context, req.message, req.update_knowledge)

            # Apply knowledge updates if in update mode
            if req.update_knowledge and result.get("knowledge_updates"):
                updates = result["knowledge_updates"]
                target_id = updates.get("person_id", req.person_id)
                if target_id:
                    graph.update_person(target_id, {
                        "interests": updates.get("new_interests", []),
                        "skills": updates.get("new_skills", []),
                        "traits": updates.get("new_traits", []),
                        "goals": updates.get("new_goals", []),
                    })
                    await graph.save_to_sqlite()

            return ChatResponse(
                reply=result.get("reply", "I'm not sure how to respond to that."),
                reasoning=result.get("reasoning", []),
                recommended_people=result.get("recommended_people", []),
                graph_highlights=result.get("graph_highlights", []),
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


# ── Fun matches ──────────────────────────────────────────────────

@app.get("/api/matches")
async def get_fun_matches():
    """Generate fun matching categories."""
    all_context = graph.get_all_persons_context()
    if not all_context or len(graph.persons) < 2:
        return {"categories": []}

    try:
        result = await llm.generate_fun_matches(all_context)
        categories = result.get("categories", [])

        # Add match edges to graph
        for cat in categories:
            for match in cat.get("matches", []):
                p1_id = match.get("person1_id", "")
                p2_id = match.get("person2_id", "")
                if p1_id and p2_id:
                    edge = Edge(
                        source=p1_id,
                        target=p2_id,
                        edge_type="recommended_match",
                        reasoning=match.get("explanation", ""),
                        strength=match.get("strength", 0.7),
                        match_category=cat.get("category", ""),
                    )
                    graph.add_edge(edge)

        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Match generation error: {str(e)}")


# ── Persistence controls ─────────────────────────────────────────

@app.post("/api/save")
async def save_graph():
    await graph.save_to_sqlite()
    return {"status": "saved"}


@app.post("/api/reset")
async def reset_graph():
    """Clear all data."""
    graph.G.clear()
    graph.persons.clear()
    graph.conversations.clear()
    await graph.save_to_sqlite()
    return {"status": "reset"}
