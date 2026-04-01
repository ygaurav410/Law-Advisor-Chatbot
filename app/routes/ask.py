from flask import Blueprint, request, jsonify, session
from flask_login import current_user, login_required

from app.extensions import db
from app.models import Conversation, Document
from app.services.rag_service import rag_answer
from app.services.ai_service import answer_question

ask_bp = Blueprint("ask", __name__)

@ask_bp.route("/ask", methods=["POST"])
@login_required
def ask():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()
    document_id = data.get("document_id") or session.get("current_document_id")

    if not document_id:
        return jsonify({"error": "No document uploaded"}), 400

    if not question:
        return jsonify({"error": "Question missing"}), 400

    document = Document.query.filter_by(id=document_id, user_id=current_user.id).first()

    if not document:
        return jsonify({"error": "Document not found"}), 404

    try:
        answer = rag_answer(question, document.vector_store_path, fallback_text=document.extracted_text)
    except Exception as e:
        try:
            answer = answer_question(document.extracted_text, question)
        except Exception as fallback_error:
            return jsonify({"error": str(fallback_error or e)}), 500

    conversation = Conversation(
        user_id=current_user.id,
        document_id=document.id,
        question=question,
        answer=answer,
    )

    db.session.add(conversation)
    db.session.commit()

    session["current_document_id"] = document.id

    return jsonify({"answer": answer, "conversation": conversation.to_dict()})
