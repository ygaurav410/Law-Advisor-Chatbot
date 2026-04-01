# LexiAI

LexiAI is an AI-powered legal document analysis platform built to turn long, dense legal PDFs into structured summaries and document-grounded conversations.

The project moves beyond a simple AI demo and into a more product-like workflow with authentication, saved history, document-specific context, PDF export, and a separate chat workspace for continuing previous analysis sessions.

---

## Overview

Legal documents are often long, dense, and time-consuming to review. LexiAI simplifies this process by combining document parsing, structured AI summarization, and document-grounded Q&A into a single workflow.

Instead of presenting raw AI output, the system structures responses and ties them directly to the uploaded document, making it more usable and consistent.

---

## Core Features

### 1. Structured Legal Summary Generation

After a document is uploaded, the backend extracts text and sends it to the AI model for analysis.

Instead of displaying free-form responses, the system expects structured output and formats it into a consistent summary containing:

- a concise overview of the document  
- key legal points and takeaways  
- missing, vague, or unclear sections  
- a confidence indicator  
- suggested next steps  

Additional handling is implemented to deal with inconsistent or malformed model outputs, ensuring the app remains stable.

---

### 2. Document-Grounded Follow-Up Q&A

Users can ask follow-up questions related to the uploaded document, such as:

- What are the payment terms?  
- Are there any risky clauses?  
- What obligations are missing?  
- What should be clarified before signing?  

The system uses chunk-based retrieval from the document to generate responses, keeping answers grounded in actual content instead of generic chatbot replies.

---

### 3. User Authentication and Persistent Workspace

The application supports account-based usage with email and password authentication.

Each user has a dedicated workspace where the following data is stored:

- uploaded documents  
- extracted text  
- generated summaries  
- conversation history  

This allows users to return later and continue working without losing context.

---

### 4. Dedicated Chat Interface

LexiAI includes a separate `/chat` page designed for continued interaction.

It provides:

- a list of previously uploaded documents  
- document-specific conversation threads  
- quick access to summaries  
- a clean interface for follow-up queries  

This separation keeps the upload flow simple while supporting deeper interaction in a dedicated space.

---

### 5. Exportable PDF Reports

Generated summaries can be exported as PDF reports. This makes it easier to save, share, or review outputs outside the application.

---

## End-to-End Workflow

1. User signs up or logs in  
2. A legal PDF is uploaded  
3. Text is extracted using `pdfplumber`  
4. The AI model generates a structured summary  
5. Data is stored in the database  
6. The document is split into chunks for retrieval  
7. User asks follow-up questions  
8. Relevant chunks are used to generate answers  
9. Documents and conversations remain available across sessions  

---

## Technical Highlights

This project combines backend development, AI integration, persistence, UI workflow design, and deployment-oriented configuration.

- Built a multi-route Flask application handling authentication, upload, Q&A, history, and downloads  
- Structured the backend into routes, services, models, utilities, and templates  
- Implemented persistence using SQLAlchemy for users, documents, and conversations  
- Added document-specific memory to maintain context during Q&A  
- Created a separate chat interface for better interaction flow  
- Implemented response parsing, cleanup, and fallback handling for unreliable model output  
- Built a local chunk-based retrieval system for grounded responses  
- Designed a multi-page frontend instead of a single demo interface  
- Added WSGI and Gunicorn support so the app can run in a hosted environment without code changes  

---

## Key Design Decisions

### Structured Output Over Raw Responses

Model outputs are treated as structured data rather than plain text. This allows consistent formatting, easier storage, and better usability across features like summaries and exports.

---

### Handling Unreliable Model Output

Since AI responses are not always perfectly formatted, the system includes:

- markdown cleanup  
- JSON extraction and normalization  
- fallback summary generation  
- fallback answers when retrieval fails  

This improves robustness and prevents application crashes.

---

### Persistence Over Session-Based Design

Instead of relying on temporary session data, the application stores user-specific data in a database. This makes the system usable across sessions and closer to real-world applications.

---

### Separation of Upload and Interaction

The upload and chat experiences are separated into different pages. This keeps the interface cleaner and makes it easier to continue working with documents over time.

---

## Tech Stack

### Backend

- Python  
- Flask  
- Flask-Login  
- Flask-SQLAlchemy  
- SQLite for local development  
- PostgreSQL-ready configuration for production deployment  

### AI and Document Processing

- Gemini API  
- pdfplumber  
- custom response parsing and normalization  
- chunk-based retrieval  

### Frontend

- HTML  
- CSS  
- Vanilla JavaScript  

### Reporting and Deployment

- ReportLab  
- Gunicorn  

---

## Data Model

The application uses three main entities:

- **User** - authentication and account data  
- **Document** - uploaded files, extracted text, storage paths, and summaries  
- **Conversation** - document-linked questions and answers  

This structure supports persistent history and document-specific interactions.

---

## Project Structure

```
app/
  routes/        # API endpoints (auth, upload, Q&A, download)
  services/      # AI logic, PDF parsing, retrieval
  templates/     # UI pages (home + chat)
  static/        # CSS and JS
  utils/         # helpers (response cleanup, PDF generation)
  models.py      # database models
  extensions.py  # app + database setup

data/            # SQLite database
uploads/         # user-uploaded PDFs
vector_store/    # chunk data for retrieval

run.py           # local development entry point
wsgi.py          # WSGI entry point for deployment
Procfile         # Gunicorn startup command
```

---

## Running the Project

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Create environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
GEMINI_API_KEY=your_gemini_api_key
FLASK_SECRET_KEY=replace_with_a_long_random_secret
DATABASE_URL=
DATA_FOLDER=data
UPLOAD_FOLDER=uploads
VECTOR_DB_PATH=vector_store
SESSION_COOKIE_SECURE=false
PREFERRED_URL_SCHEME=https
FLASK_DEBUG=false
```

### 3. Run the app

```bash
python run.py
```

### 4. Access the app

- http://127.0.0.1:5000/  
- http://127.0.0.1:5000/chat  

---

## Deployment

The app is configured to run in both local development and hosted environments.

### Deployment-ready changes included

- `wsgi.py` exposes the Flask app for production servers
- `Procfile` starts the app with Gunicorn
- `DATABASE_URL` is supported for hosted databases such as PostgreSQL
- upload, data, and retrieval storage paths can be configured through environment variables
- `PORT` and `FLASK_DEBUG` are environment-driven instead of hardcoded
- secure session cookie behavior can be enabled through environment configuration

### Recommended production environment variables

```env
GEMINI_API_KEY=your_api_key
FLASK_SECRET_KEY=replace_with_a_long_random_secret
DATABASE_URL=your_database_url
DATA_FOLDER=/opt/render/project/src/data
UPLOAD_FOLDER=/opt/render/project/src/uploads
VECTOR_DB_PATH=/opt/render/project/src/vector_store
SESSION_COOKIE_SECURE=true
PREFERRED_URL_SCHEME=https
FLASK_DEBUG=false
```

### Suggested production command

The current Procfile runs:

```bash
gunicorn --bind 0.0.0.0:$PORT wsgi:app
```

### Hosting notes

- Local development falls back to SQLite automatically if `DATABASE_URL` is not set.
- For production, a managed database is recommended so user data survives redeploys more reliably.
- Uploaded files and retrieval chunks are stored on disk, so a persistent disk or mounted volume is recommended in production.
- The app automatically reads the hosting platform's `PORT` value when provided.

### Good fit for deployment on

- Render
- Railway
- Fly.io
- any Python host that supports WSGI apps

---

## Why This Project Is Hiring-Worthy

This project demonstrates more than prompt integration. It shows the ability to build an end-to-end AI application with:

- persistent user accounts and saved workflows  
- structured model-output handling  
- document-grounded follow-up Q and A  
- backend organization with routes, services, models, and utilities  
- deployment-aware configuration for real hosting environments  

---

## Future Improvements

- OCR support for scanned documents  
- clause-level citation and highlighting  
- document management (rename, delete, tagging)  
- improved retrieval with embeddings  
- collaboration features  

---

## Disclaimer

This project is built for educational and development purposes. It is not a substitute for professional legal advice.
