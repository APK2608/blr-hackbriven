import os
import json
from dotenv import load_dotenv

load_dotenv()

# ── Gemini (primary, free) ───────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# ── OpenAI (secondary fallback) ─────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

DEMO_BOUNDARIES = [
    {
        "keywords": ("login", "auth", "authentication"),
        "boundary": {
            "goal": "Fix the login authentication bug in the application",
            "allowed_actions": [
                "read_codebase",
                "modify_auth_module",
                "run_tests",
                "deploy_staging",
            ],
        },
    },
    {
        "keywords": ("trip", "travel", "europe", "hotel", "flight"),
        "boundary": {
            "goal": "Plan a Europe trip within the requested budget",
            "allowed_actions": [
                "search_flights",
                "search_hotels",
                "create_itinerary",
            ],
        },
    },
    {
        "keywords": ("analytics", "report", "performance", "files"),
        "boundary": {
            "goal": "Read analytics files and generate a performance report",
            "allowed_actions": [
                "read_files",
                "write_report",
            ],
        },
    },
]

DEMO_FALLBACK_BOUNDARY = DEMO_BOUNDARIES[0]["boundary"]

SYSTEM_PROMPT = """
You are an autonomous AI agent security boundary analyzer.
Your role is to parse the user's task request and output a strict JSON boundary configuration 
that defines what the agent is allowed to do.

Available Valid Tools (safe actions):
- read_codebase
- modify_auth_module
- run_tests
- deploy_staging
- search_flights
- search_hotels
- create_itinerary
- read_files
- write_report

High-Risk / Forbidden Tools (must NOT appear in allowed_actions):
- push_to_production
- drop_database
- send_payment
- book_ticket
- delete_records
- access_customer_data

Rules:
1. Only include tools that are directly necessary for the stated goal
2. Never include high-risk/forbidden tools
3. Be conservative — minimize the allowed action surface

Your output MUST strictly match this JSON format:
{
  "goal": "Clear, concise summary of the user's objective",
  "allowed_actions": ["list", "of", "safe", "allowed", "tools"]
}
"""


def _generate_with_gemini(user_input: str) -> dict:
    """Try to generate execution boundary using Google Gemini."""
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config={"response_mime_type": "application/json"}
    )
    response = model.generate_content(
        f"{SYSTEM_PROMPT}\n\nUser task: {user_input}"
    )
    return json.loads(response.text)


def _generate_with_openai(user_input: str) -> dict:
    """Fallback: generate execution boundary using OpenAI GPT-4o."""
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input}
        ]
    )
    return json.loads(response.choices[0].message.content)


def generate_execution_boundary(user_input: str) -> dict:
    """
    Processes the natural language prompt to isolate intent and output
    strict JSON boundary configurations.

    Priority: Local demo boundary -> Gemini -> OpenAI -> Hardcoded Demo Fallback
    """
    normalized = user_input.lower()
    for item in DEMO_BOUNDARIES:
        if any(keyword in normalized for keyword in item["keywords"]):
            print("[OK] Local demo boundary generated")
            return item["boundary"]

    # 1. Try Gemini first
    if GEMINI_API_KEY:
        try:
            result = _generate_with_gemini(user_input)
            print("✅ Gemini generated execution boundary")
            return result
        except Exception as e:
            print(f"⚠️  Gemini failed: {e}")

    # 2. Try OpenAI as fallback
    if OPENAI_API_KEY:
        try:
            result = _generate_with_openai(user_input)
            print("✅ OpenAI generated execution boundary")
            return result
        except Exception as e:
            print(f"⚠️  OpenAI failed: {e}")

    # 3. Hardcoded demo fallback — always works
    print("⚠️  Both AI providers unavailable — using hardcoded demo boundary")
    return DEMO_FALLBACK_BOUNDARY
