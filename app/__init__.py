import os

from flask import Flask
from .config import Config
from .extensions import db, init_extensions

from flask import render_template

def create_app():
    app = Flask(__name__)
    
    app.config.from_object(Config)
    os.makedirs(app.config["DATA_FOLDER"], exist_ok=True)
    init_extensions(app)

    from .routes.upload import upload_bp
    from .routes.ask import ask_bp
    from .routes.download import download_bp
    from .routes.auth import auth_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(ask_bp)
    app.register_blueprint(download_bp)
    app.register_blueprint(auth_bp)

    @app.route("/")
    def home():
        return render_template("index.html")

    @app.route("/chat")
    def chat():
        return render_template("chat.html")

    with app.app_context():
        from app import models as app_models  # noqa: F401

        db.create_all()

    return app
