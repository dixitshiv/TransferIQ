"""
RAG module — indexes historical tech transfer comparators into a persistent
ChromaDB vector store and retrieves the most similar ones for a given transfer.

Embedding model: nomic-embed-text (via Ollama)
Vector store:    ChromaDB (cosine similarity, persistent on disk)
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

HIST_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "historical_comparators.json")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE = os.getenv("OLLAMA_HOST", "http://localhost:11434")

_collection = None


def _make_embeddings():
    from langchain_ollama import OllamaEmbeddings
    return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE)


def _build_doc(c: dict) -> str:
    """Flatten a comparator record into a single rich text document for embedding."""
    return (
        f"{c['product']} {c['dosage_form']} API: {c['api']}. "
        f"Transfer from {c['sending_org']} to {c['receiving_org']} ({c['year']}). "
        f"Outcome: {c['outcome']}. Duration: {c['duration_days']} days. "
        f"Key gaps: {', '.join(c['key_gaps'])}. "
        f"Lessons learned: {c['lessons_learned']}"
    )


def _get_collection():
    global _collection
    if _collection is not None:
        return _collection

    import chromadb

    with open(HIST_PATH) as f:
        comparators = json.load(f)

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    coll = client.get_or_create_collection(
        name="historical_transfers",
        metadata={"hnsw:space": "cosine"},
    )

    if coll.count() == 0:
        logger.info("[RAG] Indexing %d historical comparators with %s...", len(comparators), EMBED_MODEL)
        emb = _make_embeddings()
        docs = [_build_doc(c) for c in comparators]
        vectors = emb.embed_documents(docs)
        coll.add(
            ids=[c["id"] for c in comparators],
            documents=docs,
            embeddings=vectors,
        )
        logger.info("[RAG] Indexing complete — %d vectors stored.", len(docs))
    else:
        logger.info("[RAG] Loaded existing collection (%d vectors).", coll.count())

    _collection = coll
    return _collection


def retrieve_similar(query_text: str, top_k: int = 5) -> list[dict]:
    """
    Embed query_text and return the top_k most similar historical comparators,
    with similarity_score replaced by the real cosine similarity (0–1).
    Falls back to static sort order if Ollama or ChromaDB is unavailable.
    """
    with open(HIST_PATH) as f:
        all_comps = {c["id"]: c for c in json.load(f)}

    try:
        coll = _get_collection()
        n = min(top_k, coll.count())
        if n == 0:
            raise ValueError("Empty collection")

        query_vec = _make_embeddings().embed_query(query_text)
        results = coll.query(query_embeddings=[query_vec], n_results=n)

        output = []
        for cid, dist in zip(results["ids"][0], results["distances"][0]):
            if cid in all_comps:
                comp = dict(all_comps[cid])
                # ChromaDB cosine distance: 0 = identical, 1 = orthogonal
                comp["similarity_score"] = round(max(0.0, 1.0 - dist), 4)
                output.append(comp)

        return sorted(output, key=lambda x: x["similarity_score"], reverse=True)

    except Exception as exc:
        logger.warning("[RAG] Falling back to static similarity scores: %s", exc)
        return sorted(all_comps.values(), key=lambda x: x["similarity_score"], reverse=True)


def index_transfer(tid: str, text: str) -> None:
    """
    Add or update a newly uploaded transfer package in the vector store
    so it can appear as a comparator for future transfers.
    """
    try:
        coll = _get_collection()
        vec = _make_embeddings().embed_documents([text])
        existing = coll.get(ids=[tid])
        if existing["ids"]:
            coll.update(ids=[tid], documents=[text], embeddings=vec)
            logger.info("[RAG] Updated vector for transfer %s.", tid)
        else:
            coll.add(ids=[tid], documents=[text], embeddings=vec)
            logger.info("[RAG] Indexed transfer %s.", tid)
    except Exception as exc:
        logger.warning("[RAG] Failed to index transfer %s: %s", tid, exc)


def init_rag() -> None:
    """
    Pre-warm the vector store at startup so the first /similar call is fast.
    Call this in a background thread.
    """
    try:
        _get_collection()
        print(f"[TransferIQ] RAG ready — {EMBED_MODEL} embeddings, ChromaDB at {CHROMA_DIR}")
    except Exception as exc:
        print(f"[TransferIQ] RAG init warning (will retry on first request): {exc}")
