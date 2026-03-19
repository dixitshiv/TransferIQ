import json
import os
from langchain_ollama import OllamaLLM
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

ICH_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "requirements", "ich_requirements.json")

with open(ICH_PATH) as f:
    ICH_DATA = json.load(f)

ICH_CHECKLIST = json.dumps(ICH_DATA["requirements"], indent=2)

PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a pharmaceutical regulatory expert specializing in tech transfer gap analysis.
Analyze the provided tech transfer package against ICH requirements and identify gaps.
Return a JSON array of gap objects. Each object must have exactly these fields:
- category (string): one of Formulation & Process, Analytical Methods, Specifications, Stability Data, Regulatory Documentation, Equipment & Facility
- description (string): clear description of the gap
- severity (string): one of CRITICAL, MAJOR, MINOR
- source_ref (string): which document the gap was found in
- requirement (string): the ICH requirement ID and text (e.g. "ST-01: Long-term stability...")
- recommended_action (string): specific action to close the gap
- responsible_function (string): primary function responsible for closing this gap, one of: Analytical, Manufacturing, Regulatory, Quality, Engineering
- target_date (string): suggested target completion as relative offset, e.g. "Day 30", "Day 60", "Day 90"

Return ONLY a valid JSON array, no other text."""),
    ("human", """ICH REQUIREMENTS CHECKLIST:
{ich_checklist}

TECH TRANSFER PACKAGE:
{package_summary}

Identify all gaps between the package and ICH requirements. Return JSON array only.""")
])


def run_gap_analysis(package_summary: str) -> list[dict]:
    llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0)
    parser = JsonOutputParser()
    chain = PROMPT | llm | parser
    result = chain.invoke({
        "ich_checklist": ICH_CHECKLIST,
        "package_summary": package_summary,
    })
    return result if isinstance(result, list) else []
