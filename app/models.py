import json
from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    documents = db.relationship("Document", backref="user", lazy=True, cascade="all, delete-orphan")
    conversations = db.relationship("Conversation", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return bool(self.password_hash) and check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "created_at": self.created_at.isoformat(),
            "has_password": bool(self.password_hash),
        }


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    vector_store_path = db.Column(db.String(500), nullable=False)
    extracted_text = db.Column(db.Text, nullable=False)
    summary_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    conversations = db.relationship(
        "Conversation",
        backref="document",
        lazy=True,
        cascade="all, delete-orphan",
    )

    @property
    def summary_data(self) -> dict:
        if not self.summary_json:
            return {}

        try:
            return json.loads(self.summary_json)
        except json.JSONDecodeError:
            return {}

    def to_dict(self, include_summary: bool = False) -> dict:
        payload = {
            "id": self.id,
            "original_filename": self.original_filename,
            "stored_filename": self.stored_filename,
            "created_at": self.created_at.isoformat(),
            "summary_elevator": self.summary_data.get("summary_elevator", ""),
            "confidence": self.summary_data.get("confidence", 0),
            "conversation_count": len(self.conversations),
        }

        if include_summary:
            payload["summary"] = self.summary_data

        return payload


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=False, index=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "document_name": self.document.original_filename if self.document else "",
            "question": self.question,
            "answer": self.answer,
            "created_at": self.created_at.isoformat(),
        }
