"""
LangGraph orchestration pipeline for TransferIQ.

Models the tech transfer workflow as a stateful graph:

    START → [gap_analysis] →(gaps found?)→ [planner] → [drafter] → END
                            →(no gaps)──────────────────────────→ END

Each node wraps the existing agent functions and reads/writes a shared
TransferState TypedDict. The graph is compiled once at module import and
reused across requests.
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import StateGraph, END

from agents.gap_analysis import run_gap_analysis
from agents.planner import run_planner
from agents.drafter import run_drafter


# ---------------------------------------------------------------------------
# Shared state schema
# ---------------------------------------------------------------------------

class TransferState(TypedDict):
    # ── inputs ──────────────────────────────────────────────────────────────
    transfer_id: str
    package_summary: str
    product: str
    sending_org: str
    receiving_org: str
    doc_type: str          # document type to draft (e.g. "transfer_summary_report")
    # ── outputs accumulated across nodes ────────────────────────────────────
    gaps: list[dict]
    tasks: list[dict]
    draft_content: str
    # ── control ─────────────────────────────────────────────────────────────
    error: str | None


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

def gap_analysis_node(state: TransferState) -> dict:
    """Run gap analysis and return updated gaps list."""
    try:
        gaps = run_gap_analysis(state["package_summary"])
        return {"gaps": gaps, "error": None}
    except Exception as exc:
        return {"gaps": [], "error": f"gap_analysis failed: {exc}"}


def planner_node(state: TransferState) -> dict:
    """Generate transfer plan from identified gaps."""
    try:
        tasks = run_planner(
            state["product"],
            state["sending_org"],
            state["receiving_org"],
            state["gaps"],
        )
        return {"tasks": tasks, "error": None}
    except Exception as exc:
        return {"tasks": [], "error": f"planner failed: {exc}"}


def drafter_node(state: TransferState) -> dict:
    """Draft a regulatory document based on gaps and product info."""
    product_info = {
        "product_name": state["product"],
        "sending_org": state["sending_org"],
        "receiving_org": state["receiving_org"],
    }
    try:
        content = run_drafter(state["doc_type"], product_info, state["gaps"])
        return {"draft_content": content, "error": None}
    except Exception as exc:
        return {"draft_content": "", "error": f"drafter failed: {exc}"}


# ---------------------------------------------------------------------------
# Conditional edge: proceed to planner only if gaps were found
# ---------------------------------------------------------------------------

def _route_after_gap_analysis(state: TransferState) -> str:
    if state.get("error") or not state.get("gaps"):
        return END
    return "planner"


# ---------------------------------------------------------------------------
# Graph construction (compiled once at import time)
# ---------------------------------------------------------------------------

def build_transfer_graph():
    g = StateGraph(TransferState)

    g.add_node("gap_analysis", gap_analysis_node)
    g.add_node("planner", planner_node)
    g.add_node("drafter", drafter_node)

    g.set_entry_point("gap_analysis")

    g.add_conditional_edges("gap_analysis", _route_after_gap_analysis)
    g.add_edge("planner", "drafter")
    g.add_edge("drafter", END)

    return g.compile()


transfer_graph = build_transfer_graph()
