import json
import os
from uuid import uuid4

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import Document
from app.services.ai_service import generate_summary
from app.services.embedding_service import create_vector_store
from app.services.pdf_service import extract_text_from_pdf

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/upload", methods=["POST"])
@login_required
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    original_filename = secure_filename(file.filename)

    if not original_filename:
        return jsonify({"error": "Invalid filename"}), 400

    upload_token = uuid4().hex
    user_upload_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], f"user_{current_user.id}")
    os.makedirs(user_upload_dir, exist_ok=True)

    stored_filename = f"{upload_token}_{original_filename}"
    filepath = os.path.join(user_upload_dir, stored_filename)
    file.save(filepath)

    text = extract_text_from_pdf(filepath)

    if not text:
        return jsonify({"error": "Failed to extract text"}), 400

    vector_store_dir = os.path.join(
        current_app.config["VECTOR_DB_PATH"],
        f"user_{current_user.id}",
        upload_token,
    )

    try:
        create_vector_store(text, path=vector_store_dir)
        summary = generate_summary(text)
    except Exception as e:
        current_app.logger.exception("Document processing failed")
        return jsonify({"error": str(e)}), 500

    document = Document(
        user_id=current_user.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_path=filepath,
        vector_store_path=vector_store_dir,
        extracted_text=text,
        summary_json=json.dumps(summary),
    )

    db.session.add(document)
    db.session.commit()

    session["current_document_id"] = document.id

    return jsonify(
        {
            "document": document.to_dict(include_summary=True),
            "summary": summary,
        }
    )
