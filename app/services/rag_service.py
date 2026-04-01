from app.services.embedding_service import search_similar_chunks
from app.services.ai_service import init_gemini

def rag_answer(question: str, vector_store_path: str, fallback_text: str = "") -> str:
    model = init_gemini()

    # Retrieve relevant chunks
    chunks = search_similar_chunks(question, path=vector_store_path, fallback_text=fallback_text)

    context = "\n\n".join(chunks)

    prompt = f"""
You are a legal assistant.

Use ONLY the context below to answer the question.

If the answer is not in the context, say:
"Not enough information in the document."

---------------------
Context:
{context}
---------------------

Question:
{question}

Answer clearly:
"""

    response = model.generate_content(prompt)

    return response.text if response else "No response"
