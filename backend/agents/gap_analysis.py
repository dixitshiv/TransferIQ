"""
Gap Analysis Agent — ReAct agent with tool use, with LCEL chain fallback.

Primary path (ReAct):
    langchain.agents.create_agent (LangChain v1, built on LangGraph)
    ChatOllama + [lookup_ich_requirement, check_package_section] tools
    → Thought / Action / Observation loop
    → JSON gap list output

Fallback path (LCEL chain):
    ChatPromptTemplate | OllamaLLM | JsonOutputParser
    Activated automatically if the ReAct agent errors or returns
    unparseable output.
"""

from __future__ import annotations

import json
import os
import re

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.messages import HumanMessage
from langchain_ollama import OllamaLLM, ChatOllama
from langchain.tools import tool
from langchain.agents import create_agent

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "16384"))
MAX_SUMMARY_CHARS = int(os.getenv("OLLAMA_MAX_SUMMARY_CHARS", "3500"))

ICH_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "requirements", "ich_requirements.json")

with open(ICH_PATH) as f:
    ICH_DATA = json.load(f)

ICH_CHECKLIST = json.dumps(ICH_DATA["requirements"], indent=2)

# Module-level variable injected before each ReAct agent call so the
# check_package_section tool can access it without threading complexity.
_CURRENT_PACKAGE_SUMMARY: str = ""


# ---------------------------------------------------------------------------
# Tools available to the ReAct agent
# ---------------------------------------------------------------------------

@tool
def lookup_ich_requirement(category: str) -> str:
    """Look up ICH Q8/Q9/Q10 requirements for a specific category.

    Valid categories (exact match, case-insensitive):
      - Formulation & Process
      - Analytical Methods
      - Specifications
      - Stability Data
      - Regulatory Documentation
      - Equipment & Facility

    Returns a JSON list of requirement objects for that category.
    """
    matching = [
        r for r in ICH_DATA["requirements"]
        if r.get("category", "").lower() == category.lower()
    ]
    if not matching:
        return f"No ICH requirements found for category '{category}'. Valid categories: Formulation & Process, Analytical Methods, Specifications, Stability Data, Regulatory Documentation, Equipment & Facility"
    return json.dumps(matching, indent=2)


@tool
def check_package_section(section: str) -> str:
    """Search the current tech transfer package for content about a specific section.

    Use this to check whether the package addresses a particular area before
    declaring a gap. Useful sections to search: 'stability', 'analytical',
    'batch record', 'formulation', 'CQA', 'CPP', 'equipment', 'regulatory'.

    Returns matching lines from the package summary (up to 20 lines).
    """
    global _CURRENT_PACKAGE_SUMMARY
    if not _CURRENT_PACKAGE_SUMMARY:
        return "Package summary not available."
    matches = [
        line for line in _CURRENT_PACKAGE_SUMMARY.split("\n")
        if section.lower() in line.lower()
    ]
    if not matches:
        return f"No content found in the package for section '{section}'. This area may be missing — consider flagging as a gap."
    return "\n".join(matches[:20])


TOOLS = [lookup_ich_requirement, check_package_section]


# ---------------------------------------------------------------------------
# LCEL fallback chain (original implementation)
# ---------------------------------------------------------------------------

_FALLBACK_PROMPT = ChatPromptTemplate.from_messages([
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


def _run_fallback_chain(package_summary: str) -> list[dict]:
    llm = OllamaLLM(model=OLLAMA_MODEL, temperature=0, base_url=OLLAMA_HOST, num_ctx=OLLAMA_NUM_CTX)
    parser = JsonOutputParser()
    chain = _FALLBACK_PROMPT | llm | parser
    result = chain.invoke({
        "ich_checklist": ICH_CHECKLIST,
        "package_summary": package_summary[:MAX_SUMMARY_CHARS],
    })
    return result if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# ReAct agent path
# ---------------------------------------------------------------------------

def _parse_gaps_from_agent_output(output: str) -> list[dict]:
    """Extract a JSON array from the agent's final Answer."""
    # Try to find a JSON array in the output
    match = re.search(r"\[.*\]", output, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(output)


SYSTEM_PROMPT = """You are a pharmaceutical regulatory expert performing a tech transfer gap analysis.

Your goal: identify ALL gaps between the provided tech transfer package and ICH Q8/Q9/Q10 requirements.

Instructions:
1. For each ICH category (Formulation & Process, Analytical Methods, Specifications, Stability Data, Regulatory Documentation, Equipment & Facility), call lookup_ich_requirement to get the requirements.
2. Call check_package_section to verify whether the package addresses each requirement area.
3. After checking all 6 categories, output ONLY a JSON array of gap objects. No other text.

Each gap object must have exactly these fields:
- category: one of the 6 ICH categories
- description: clear description of the gap
- severity: CRITICAL, MAJOR, or MINOR
- source_ref: requirement ID (e.g. FP-01)
- requirement: the ICH requirement text
- recommended_action: specific action to close the gap
- responsible_function: one of Analytical, Manufacturing, Regulatory, Quality, Engineering
- target_date: e.g. "Day 30", "Day 60", "Day 90"
"""


def _run_react_agent(package_summary: str) -> list[dict]:
    global _CURRENT_PACKAGE_SUMMARY
    _CURRENT_PACKAGE_SUMMARY = package_summary

    llm = ChatOllama(model=OLLAMA_MODEL, temperature=0, base_url=OLLAMA_HOST, num_ctx=OLLAMA_NUM_CTX)
    # langchain.agents.create_agent — the LangChain v1 standard, built on LangGraph
    # replaces the deprecated langgraph.prebuilt.create_react_agent
    agent = create_agent(llm, TOOLS, system_prompt=SYSTEM_PROMPT)

    user_message = (
        f"Analyze this tech transfer package for ICH compliance gaps:\n\n"
        f"{package_summary[:MAX_SUMMARY_CHARS]}\n\n"
        "Check all 6 ICH categories using the tools, then output ONLY a JSON array of gap objects."
    )

    result = agent.invoke({"messages": [HumanMessage(content=user_message)]})
    # Final AI message contains the JSON output
    final_content = result["messages"][-1].content
    return _parse_gaps_from_agent_output(final_content)


# ---------------------------------------------------------------------------
# Public API — signature unchanged, callers need no modification
# ---------------------------------------------------------------------------

def run_gap_analysis(package_summary: str) -> list[dict]:
    """
    Analyze a tech transfer package against ICH requirements.

    Primary: ReAct agent with lookup_ich_requirement and check_package_section tools.
    Fallback: LCEL chain (original implementation) if agent fails or output is unparseable.
    """
    try:
        gaps = _run_react_agent(package_summary)
        if gaps:
            print(f"[TransferIQ] ReAct gap analysis complete — {len(gaps)} gaps found")
            return gaps
        print("[TransferIQ] ReAct agent returned empty gaps, falling back to chain")
    except Exception as exc:
        print(f"[TransferIQ] ReAct agent failed ({exc}), falling back to LCEL chain")

    return _run_fallback_chain(package_summary)
