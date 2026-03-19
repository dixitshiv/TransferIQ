import json
import os
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "16384"))

PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a pharmaceutical project manager specializing in tech transfer.
Given a product description and a list of identified gaps, generate a master transfer plan.
Return a JSON array of task objects. Each object must have exactly these fields:
- task_name (string): concise task name
- function (string): department responsible, one of: Analytical, Manufacturing, Regulatory, Quality, Engineering
- predecessor (string or null): task_name of the preceding task, or null if no dependency
- due_offset_days (integer): days from transfer kickoff when this task should be complete
- deliverable (string): the tangible output of this task
- status (string): realistic current status. Use "Not Started" for future tasks, "In Progress" for 2-3 active tasks, "Under Review" for 1-2 tasks pending QA sign-off, "Blocked" for tasks with unresolved dependencies, "Overdue" for 1-2 critical-path tasks that are past their due date. Most tasks should be "Not Started".

Return ONLY a valid JSON array, no other text. Generate 15-25 tasks covering all gap areas."""),
    ("human", """PRODUCT: {product}
TRANSFER TYPE: Post-approval manufacturing site change
SENDING ORG: {sending_org} → RECEIVING ORG: {receiving_org}

IDENTIFIED GAPS:
{gaps_summary}

Generate the master transfer plan as a JSON array.""")
])


def run_planner(product: str, sending_org: str, receiving_org: str, gaps: list[dict]) -> list[dict]:
    llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0, base_url=OLLAMA_HOST, num_ctx=OLLAMA_NUM_CTX)
    parser = JsonOutputParser()
    chain = PROMPT | llm | parser

    gaps_summary = "\n".join(
        f"[{g['severity']}] {g['category']}: {g['description']}"
        for g in gaps
    )

    result = chain.invoke({
        "product": product,
        "sending_org": sending_org,
        "receiving_org": receiving_org,
        "gaps_summary": gaps_summary,
    })
    return result if isinstance(result, list) else []
