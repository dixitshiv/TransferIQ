import os
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

DOC_DESCRIPTIONS = {
    "method_transfer_protocol": "Analytical Method Transfer Protocol",
    "transfer_summary_report": "Tech Transfer Summary Report",
    "gap_closure_plan": "Gap Closure Action Plan",
}

PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a pharmaceutical technical writer drafting GMP-compliant documents for a tech transfer.
Write the requested document in professional pharmaceutical format using markdown.
Include section headers, numbered lists where appropriate, and inline citations like [SOURCE: document_name].
Be specific — reference actual product data, gap findings, and regulatory requirements provided.
Do not add generic filler. Keep it focused and realistic for a CDMO tech transfer scenario."""),
    ("human", """DOCUMENT TYPE: {doc_type_label}

PRODUCT INFO:
{product_info}

IDENTIFIED GAPS:
{gaps_summary}

Draft the complete {doc_type_label} document. Use markdown formatting with clear section headers.""")
])


def run_drafter(doc_type: str, product_info: dict, gaps: list[dict]) -> str:
    llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0.2)
    parser = StrOutputParser()
    chain = PROMPT | llm | parser

    doc_label = DOC_DESCRIPTIONS.get(doc_type, doc_type.replace("_", " ").title())

    gaps_summary = "\n".join(
        f"[{g['severity']}] {g['category']}: {g['description']} — Action: {g['recommended_action']}"
        for g in gaps
    )

    return chain.invoke({
        "doc_type_label": doc_label,
        "product_info": str(product_info),
        "gaps_summary": gaps_summary,
    })


async def run_drafter_stream(doc_type: str, product_info: dict, gaps: list[dict]):
    llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0.2, streaming=True)
    parser = StrOutputParser()
    chain = PROMPT | llm | parser

    doc_label = DOC_DESCRIPTIONS.get(doc_type, doc_type.replace("_", " ").title())

    gaps_summary = "\n".join(
        f"[{g['severity']}] {g['category']}: {g['description']} — Action: {g['recommended_action']}"
        for g in gaps
    )

    async for chunk in chain.astream({
        "doc_type_label": doc_label,
        "product_info": str(product_info),
        "gaps_summary": gaps_summary,
    }):
        yield chunk
