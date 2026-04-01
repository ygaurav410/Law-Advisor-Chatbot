import re

def clean_ai_response(text: str) -> str:
    if not text:
        return ""

    cleaned = text.strip()
    cleaned = re.sub(r"^\s*```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)

    return cleaned.strip()


def extract_json_object(text: str) -> str:
    cleaned = clean_ai_response(text)

    if not cleaned:
        return ""

    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)

    return match.group(0).strip() if match else cleaned
