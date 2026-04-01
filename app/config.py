import os
from dotenv import load_dotenv

load_dotenv()


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev")

    DATA_FOLDER = os.path.join(BASE_DIR, "data")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(DATA_FOLDER, 'lexiai.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_COOKIE_SAMESITE = "Lax"

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_store")
