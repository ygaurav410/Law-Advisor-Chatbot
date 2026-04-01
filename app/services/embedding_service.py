import os
import pickle
import re
from collections import Counter

# ------------------------------
# TEXT CHUNKING
# ------------------------------
def split_text(text, chunk_size=500, overlap=50):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


def _chunks_path(path: str) -> str:
    return os.path.join(path, "chunks.pkl")


def _save_chunks(chunks, path: str) -> None:
    with open(_chunks_path(path), "wb") as f:
        pickle.dump(chunks, f)


def _load_chunks(path: str):
    chunks_file = _chunks_path(path)
    if not os.path.exists(chunks_file):
        return []

    with open(chunks_file, "rb") as f:
        return pickle.load(f)


def _tokenize(text: str):
    return re.findall(r"[a-z0-9]+", text.lower())


def _lexical_search(query: str, chunks, k=3):
    query_tokens = _tokenize(query)

    if not query_tokens:
        return chunks[:k]

    query_counts = Counter(query_tokens)
    scored = []

    for index, chunk in enumerate(chunks):
        chunk_tokens = _tokenize(chunk)
        chunk_counts = Counter(chunk_tokens)
        overlap_score = sum(min(count, chunk_counts[token]) for token, count in query_counts.items())
        exact_phrase_bonus = 3 if query.lower() in chunk.lower() else 0
        density_bonus = overlap_score / max(len(chunk_tokens), 1)
        total_score = overlap_score + exact_phrase_bonus + density_bonus
        scored.append((total_score, index, chunk))

    scored.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    best = [chunk for score, _, chunk in scored if score > 0]

    return best[:k] or chunks[:k]


# ------------------------------
# CREATE VECTOR STORE
# ------------------------------
def create_vector_store(text, path="vector_store"):
    os.makedirs(path, exist_ok=True)

    chunks = split_text(text)
    _save_chunks(chunks, path)

    return True


# ------------------------------
# SEARCH SIMILAR CHUNKS
# ------------------------------
def search_similar_chunks(query, path="vector_store", k=3, fallback_text=""):
    chunks = _load_chunks(path)

    if not chunks and fallback_text:
        chunks = split_text(fallback_text)

    if not chunks:
        return []

    return _lexical_search(query, chunks, k=k)
