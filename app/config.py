import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _normalize_database_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None

    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)

    return url


class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or os.getenv("SECRET_KEY", "dev")

    DATA_FOLDER = os.getenv("DATA_FOLDER", os.path.join(BASE_DIR, "data"))
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
    VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", os.path.join(BASE_DIR, "vector_store"))

    SQLALCHEMY_DATABASE_URI = _normalize_database_url(os.getenv("DATABASE_URL")) or (
        f"sqlite:///{os.path.join(DATA_FOLDER, 'lexiai.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = (
        {"pool_pre_ping": True}
        if SQLALCHEMY_DATABASE_URI.startswith("postgresql")
        else {}
    )

    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    PREFERRED_URL_SCHEME = os.getenv("PREFERRED_URL_SCHEME", "https")
