from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user

from app.extensions import db
from app.models import User


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def auth_payload() -> dict:
    payload = {
        "authenticated": current_user.is_authenticated,
    }

    if current_user.is_authenticated:
        payload["user"] = current_user.to_dict()
        payload["current_document_id"] = session.get("current_document_id")

    return payload


@auth_bp.route("/me", methods=["GET"])
def me():
    return jsonify(auth_payload())


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not full_name:
        return jsonify({"error": "Full name is required"}), 400

    if not email:
        return jsonify({"error": "Email is required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user and existing_user.password_hash:
        return jsonify({"error": "An account with that email already exists"}), 409

    if existing_user:
        existing_user.full_name = full_name or existing_user.full_name
        existing_user.set_password(password)
        db.session.commit()

        login_user(existing_user, remember=True)
        session.pop("current_document_id", None)

        return jsonify(auth_payload()), 200

    user = User(email=email, full_name=full_name)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    login_user(user, remember=True)
    session.pop("current_document_id", None)

    return jsonify(auth_payload()), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "No account found for that email"}), 404

    if not user.password_hash:
        return jsonify({"error": "This account does not have a password yet. Create one with sign up using the same email address."}), 400

    if not user.check_password(password):
        return jsonify({"error": "Incorrect password"}), 401

    login_user(user, remember=True)
    session.pop("current_document_id", None)

    return jsonify(auth_payload())


@auth_bp.route("/logout", methods=["POST"])
def logout():
    if current_user.is_authenticated:
        logout_user()

    session.pop("current_document_id", None)

    return jsonify({"ok": True, "authenticated": False})


@auth_bp.route("/history", methods=["GET"])
@login_required
def history():
    from app.models import Conversation, Document

    documents = (
        Document.query.filter_by(user_id=current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    conversations = (
        Conversation.query.filter_by(user_id=current_user.id)
        .order_by(Conversation.created_at.desc())
        .limit(20)
        .all()
    )

    return jsonify(
        {
            "current_document_id": session.get("current_document_id"),
            "documents": [document.to_dict() for document in documents],
            "conversations": [conversation.to_dict() for conversation in conversations],
        }
    )


@auth_bp.route("/documents/<int:document_id>", methods=["GET"])
@login_required
def document_detail(document_id: int):
    from app.models import Conversation, Document

    document = Document.query.filter_by(id=document_id, user_id=current_user.id).first()

    if not document:
        return jsonify({"error": "Document not found"}), 404

    session["current_document_id"] = document.id

    conversations = (
        Conversation.query.filter_by(user_id=current_user.id, document_id=document.id)
        .order_by(Conversation.created_at.desc())
        .all()
    )

    return jsonify(
        {
            "document": document.to_dict(include_summary=True),
            "conversations": [conversation.to_dict() for conversation in conversations],
        }
    )
