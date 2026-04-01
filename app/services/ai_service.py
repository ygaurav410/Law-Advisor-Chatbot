import google.generativeai as genai
from flask import current_app
from app.utils.cleaner import clean_ai_response, extract_json_object
import json
import re

# Configure Gemini once
def init_gemini():
    genai.configure(api_key=current_app.config["GEMINI_API_KEY"])
    return genai.GenerativeModel("gemini-2.5-flash")


# -----------------------------------
# PROMPTS (clean seperation)
# -----------------------------------
SUMMARY_PROMPT = """
You are a legal assistant.

Analyze the given legal document and return ONLY valid JSON with:
- "summary_elevator": 2-3 sentence simple explanation
- "summary_bullets": 5-7 key points
- "missing_info": missing or unclear details
- "confidence": number (0-100)
- "next_steps": actionable suggestions
"""


def _normalize_summary(summary: dict) -> dict:
    def ensure_list(value):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]

        if isinstance(value, str) and value.strip():
            return [value.strip()]

        return []

    confidence = summary.get("confidence", 0)

    if not isinstance(confidence, (int, float)):
        confidence = 0

    return {
        "summary_elevator": str(summary.get("summary_elevator", "")).strip(),
        "summary_bullets": ensure_list(summary.get("summary_bullets")),
        "missing_info": ensure_list(summary.get("missing_info")),
        "confidence": round(confidence),
        "next_steps": ensure_list(summary.get("next_steps")),
    }


def _parse_summary_response(response_text: str) -> dict:
    cleaned = clean_ai_response(response_text)

    if not cleaned:
        raise ValueError("The AI model returned an empty summary response.")

    candidates = [cleaned]
    extracted = extract_json_object(cleaned)

    if extracted and extracted != cleaned:
        candidates.append(extracted)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue

        if isinstance(parsed, dict):
            return _normalize_summary(parsed)

    current_app.logger.warning("Unable to parse Gemini summary response: %s", cleaned[:500])

    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    bullet_lines = []

    for line in lines:
        normalized = re.sub(r"^[-*]\s+|^\d+[\.\)]\s+", "", line).strip()
        if normalized != line:
            bullet_lines.append(normalized)

    summary_text = " ".join(lines[:2]).strip() if lines else cleaned

    return {
        "summary_elevator": summary_text or cleaned,
        "summary_bullets": bullet_lines[:7],
        "missing_info": [
            "The AI response was not valid JSON, so a plain-text fallback summary was used."
        ],
        "confidence": 0,
        "next_steps": [],
    }

# -----------------------------------
# MAIN FUNCTIONS
# -----------------------------------
def generate_summary(document_text: str) -> dict:
    model = init_gemini()

    response = model.generate_content([
        SUMMARY_PROMPT,
        document_text
    ])

    return _parse_summary_response(response.text if response else "")

def answer_question(document_text: str, question: str) -> str:
    model = init_gemini()

    response = model.generate_content([
        "You are a helpful legal assistant.",
        "Here is the document:",
        document_text,
        f"Question: {question}"
    ])

    return response.text if response else "No response"
