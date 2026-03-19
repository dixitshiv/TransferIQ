"""PDF text extraction for uploaded documents."""

import io
import pypdf


def extract_text_from_pdf_bytes(content: bytes) -> tuple[str, int]:
    """
    Parse PDF bytes with pypdf directly. Returns (text, page_count).
    """
    reader = pypdf.PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages), len(pages)
