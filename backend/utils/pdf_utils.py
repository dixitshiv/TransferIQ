"""LangChain PyPDFLoader wrapper for uploaded PDF documents."""

import os
import tempfile
from langchain_community.document_loaders import PyPDFLoader


def extract_text_from_pdf_bytes(content: bytes) -> tuple[str, int]:
    """
    Write PDF bytes to a temp file, load with PyPDFLoader, return (text, page_count).
    Cleans up the temp file on exit.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()
        text = "\n".join(d.page_content for d in docs)
        return text, len(docs)
    finally:
        os.unlink(tmp_path)
