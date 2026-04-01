from pathlib import Path

from flask import Blueprint, session, send_file, jsonify, request
from flask_login import current_user, login_required

from app.models import Document
from app.utils.pdf_generator import create_pdf

download_bp = Blueprint("download", __name__)

@download_bp.route("/download", methods=["GET"])
@login_required
def download():
    document_id = request.args.get("document_id", type=int) or session.get("current_document_id")

    if not document_id:
        return jsonify({"error": "No summary available"}), 400

    document = Document.query.filter_by(id=document_id, user_id=current_user.id).first()

    if not document:
        return jsonify({"error": "Document not found"}), 404

    summary = document.summary_data

    if not summary:
        return jsonify({"error": "No summary available"}), 400

    pdf_buffer = create_pdf(summary)
    stem = Path(document.original_filename).stem or "summary"

    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=f"{stem}_summary.pdf"
    )
