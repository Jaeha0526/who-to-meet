"""LLM integration using OpenAI API for extraction and chat."""

from __future__ import annotations
import json
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

_api_key = os.getenv("OPENAI_API_KEY", "")
client = AsyncOpenAI(api_key=_api_key) if _api_key and not _api_key.startswith("your-") else None
MODEL = "o3"  # upgraded reasoning model


def _check_client():
    if client is None:
        raise RuntimeError("OpenAI API key not configured. Add OPENAI_API_KEY to .env file.")


async def extract_persons_from_transcript(
    text: str,
    participant_mapping: dict[str, str] | None = None,
    language: str = "auto",
) -> dict:
    """Extract structured person entities from a conversation transcript."""
    mapping_note = ""
    if participant_mapping:
        mapping_note = f"\nParticipant name mapping: {json.dumps(participant_mapping)}"

    prompt = f"""You are an expert at extracting structured information about people from conversation transcripts.
The transcript may be in Korean, English, or mixed. Extract information about each distinct participant.

{mapping_note}

For each participant found, extract:
- name: Their real name if mentioned, or use the mapping provided, or use the label (e.g. "Attendees 1")
- interests: Specific topics, hobbies, or areas they show interest in (be specific, not vague)
- skills: Technical or professional skills evident from their speech
- traits: Personality traits observable from how they communicate
- goals: What they seem to want or be working toward
- key_quotes: 1-2 notable things they said (translated to English if Korean)

Also extract:
- conversation_summary: A 2-3 sentence summary of what was discussed
- conversation_topics: List of specific topics discussed

Return valid JSON:
{{
  "participants": [
    {{
      "label": "original label in transcript",
      "name": "resolved name",
      "interests": ["specific interest 1", ...],
      "skills": ["skill 1", ...],
      "traits": ["trait 1", ...],
      "goals": ["goal 1", ...],
      "key_quotes": ["quote 1", ...]
    }}
  ],
  "conversation_summary": "...",
  "conversation_topics": ["topic 1", ...]
}}

TRANSCRIPT:
{text}"""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def extract_person_from_bio(name: str, bio_text: str) -> dict:
    """Extract structured person data from a bio/LinkedIn profile text."""
    prompt = f"""Extract structured information about this person from their bio/profile.

Name: {name}
Bio text:
{bio_text}

Return valid JSON:
{{
  "interests": ["specific interest 1", "specific interest 2", ...],
  "skills": ["skill 1", "skill 2", ...],
  "traits": ["trait 1", "trait 2", ...],
  "goals": ["goal 1", "goal 2", ...]
}}

Be SPECIFIC. Instead of "technology", say "distributed systems" or "machine learning for healthcare".
Instead of "leadership", say "building cross-functional engineering teams"."""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def generate_recommendations(
    person_context: str,
    all_persons_context: str,
    query: str,
) -> dict:
    """Generate who-to-meet recommendations with transparent reasoning."""
    prompt = f"""You are a networking recommendation agent at a hackathon called Ralphthon.
You have deep knowledge about all participants from their bios, conversations, and extracted profiles.

YOUR PERSON (the one asking):
{person_context}

ALL OTHER PARTICIPANTS:
{all_persons_context}

USER QUERY: {query}

Generate personalized recommendations. For EACH recommended person:
1. State their name
2. Give a SPECIFIC reason why they should meet — reference exact shared interests, complementary skills, or aligned goals from the data
3. Rate connection strength (0.0-1.0)
4. Suggest a conversation starter based on their actual interests

DO NOT give vague reasons like "you both like technology" or "you're both interested in innovation".
Instead say things like "You're both building AI agents — you with knowledge graphs, them with autonomous coding tools".

Return valid JSON:
{{
  "recommendations": [
    {{
      "person_name": "...",
      "person_id": "...",
      "reasoning": "Specific, grounded reason referencing actual data points...",
      "connection_strength": 0.85,
      "shared_interests": ["specific shared interest 1", ...],
      "complementary_skills": ["they have X, you have Y", ...],
      "conversation_starter": "A specific opener based on their actual interests..."
    }}
  ],
  "overall_reasoning": "Brief explanation of recommendation strategy"
}}"""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def chat_with_agent(
    person_context: str,
    all_persons_context: str,
    message: str,
    update_knowledge: bool = False,
) -> dict:
    """General chat with the networking agent."""
    mode_instruction = ""
    if update_knowledge:
        mode_instruction = """You are in KNOWLEDGE UPDATE mode. The user is telling you new information about themselves or someone else.
Extract any new interests, skills, traits, or goals mentioned and include them in knowledge_updates."""
    else:
        mode_instruction = """You are in COMFORTABLE CONVERSATION mode. Be helpful and friendly.
Answer questions about participants, suggest connections, or just chat about the event."""

    prompt = f"""{mode_instruction}

You are a networking assistant at Ralphthon hackathon. You know all participants deeply.

CURRENT PERSON:
{person_context}

ALL PARTICIPANTS:
{all_persons_context}

USER MESSAGE: {message}

Respond naturally but always ground your answers in SPECIFIC data from participant profiles.
If recommending someone, explain WHY with concrete shared interests or complementary skills.

Return valid JSON:
{{
  "reply": "Your natural language response...",
  "reasoning": ["Step 1 of your reasoning...", "Step 2..."],
  "recommended_people": [
    {{"person_id": "...", "name": "...", "reason": "specific reason..."}}
  ],
  "knowledge_updates": {{
    "person_id": "id if updating someone",
    "new_interests": [],
    "new_skills": [],
    "new_traits": [],
    "new_goals": []
  }},
  "graph_highlights": ["node_id_1", "node_id_2"]
}}"""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def compute_pairwise_edge(person1_context: str, person2_context: str) -> dict:
    """Use o3 to compute a semantic edge between two persons with structured output."""
    prompt = f"""You are an expert relationship analyst at a hackathon called Ralphthon.
Analyze these two participants and determine their deepest potential connection.

PERSON 1:
{person1_context}

PERSON 2:
{person2_context}

Look beyond surface keyword matches. Consider:
- Shared deeper goals or missions (not just both liking "AI" but WHY they care about it)
- Complementary skills that could create something neither could alone
- Overlapping life experiences or worldviews
- Potential for mutual mentorship or learning
- Creative tension — ways they might challenge each other productively

Return valid JSON:
{{
  "has_meaningful_connection": true/false,
  "relationship_type": "one of: shared_mission | complementary_skills | mutual_learning | creative_tension | shared_experience | potential_collaborators",
  "reasoning": "A specific, compelling 2-3 sentence explanation of WHY these two should connect. Reference actual details from their profiles, not generic statements.",
  "strength": 0.0-1.0,
  "shared_themes": ["specific theme 1", "specific theme 2"],
  "conversation_starter": "A specific opener one could use with the other"
}}

If there is no meaningful connection beyond trivial overlap, set has_meaningful_connection to false and strength below 0.2."""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def compute_batch_edges(persons_contexts: list[tuple[str, str, str, str]]) -> list[dict]:
    """Compute semantic edges for a batch of person pairs.

    Each tuple is (person1_id, person2_id, person1_context, person2_context).
    Returns list of edge dicts.
    """
    import asyncio

    async def compute_one(p1_id: str, p2_id: str, p1_ctx: str, p2_ctx: str) -> dict | None:
        try:
            result = await compute_pairwise_edge(p1_ctx, p2_ctx)
            if result.get("has_meaningful_connection", False) and result.get("strength", 0) >= 0.2:
                return {
                    "source": p1_id,
                    "target": p2_id,
                    "relationship_type": result.get("relationship_type", "shared_interest"),
                    "reasoning": result.get("reasoning", ""),
                    "strength": result.get("strength", 0.5),
                    "shared_themes": result.get("shared_themes", []),
                    "conversation_starter": result.get("conversation_starter", ""),
                }
        except Exception as e:
            print(f"Edge computation failed for {p1_id}-{p2_id}: {e}")
        return None

    # Process in batches of 10 concurrent requests to avoid rate limits
    edges = []
    batch_size = 10
    for i in range(0, len(persons_contexts), batch_size):
        batch = persons_contexts[i:i + batch_size]
        tasks = [compute_one(p1_id, p2_id, p1_ctx, p2_ctx) for p1_id, p2_id, p1_ctx, p2_ctx in batch]
        results = await asyncio.gather(*tasks)
        edges.extend([r for r in results if r is not None])

    return edges


async def generate_fun_matches(all_persons_context: str) -> dict:
    """Generate fun matching categories between participants."""
    prompt = f"""You are a creative matchmaker at Ralphthon hackathon. Based on participant data, create fun matching categories.

ALL PARTICIPANTS:
{all_persons_context}

Create matches in these categories:
1. 🚀 Startup Co-founders: People whose skills complement each other for building something
2. 🤝 Potential Friends: People who'd genuinely enjoy hanging out based on shared personal interests
3. 🎨 Creative Pairings: Unexpected but interesting combinations
4. 🧠 Brain Trust: People who together would have amazing problem-solving discussions
5. 🌍 World Changers: People whose combined goals could create real impact
6. 🎲 Most Unlikely But Perfect Pair: Two people who seem totally unrelated on the surface but have a deep hidden connection — the explanation should be surprising and compelling
7. 🔥 Person Who Would Challenge Your Worldview: Pairs where one person's perspective would genuinely shake up the other's assumptions — explain what specific belief or approach would be challenged and why that's valuable

For EACH match, give SPECIFIC reasons based on actual data, not vague statements.

Return valid JSON:
{{
  "categories": [
    {{
      "category": "startup_cofounders",
      "label": "Startup Co-founders",
      "emoji": "🚀",
      "matches": [
        {{
          "person1_name": "...",
          "person1_id": "...",
          "person2_name": "...",
          "person2_id": "...",
          "explanation": "Specific reason based on their actual skills and interests...",
          "strength": 0.9
        }}
      ]
    }}
  ]
}}"""

    _check_client()
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
