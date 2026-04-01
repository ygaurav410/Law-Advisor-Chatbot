from flask import jsonify, redirect, request, url_for
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
login_manager = LoginManager()


@login_manager.user_loader
def load_user(user_id):
    from app.models import User

    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None


@login_manager.unauthorized_handler
def unauthorized():
    wants_json = request.path.startswith(("/upload", "/ask", "/download", "/documents", "/history", "/auth")) or (
        request.accept_mimetypes.best == "application/json"
    )

    if wants_json:
        return jsonify({"error": "Authentication required"}), 401

    return redirect(url_for("home"))


def init_extensions(app) -> None:
    db.init_app(app)
    login_manager.init_app(app)
