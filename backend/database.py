"""
SQLite persistence layer for TransferIQ.
Replaces all in-memory dicts with a single transferiq.db file in backend/data/.
"""

import json
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "transferiq.db")


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS transfers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                product TEXT NOT NULL,
                sending_org TEXT NOT NULL,
                receiving_org TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'In Progress',
                has_demo_data INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS packages (
                tid TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (tid, key)
            );

            CREATE TABLE IF NOT EXISTS gap_results (
                tid TEXT PRIMARY KEY,
                gaps_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plan_results (
                tid TEXT PRIMARY KEY,
                tasks_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS draft_results (
                tid TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                content TEXT NOT NULL,
                approval_status TEXT NOT NULL DEFAULT 'Draft',
                PRIMARY KEY (tid, doc_type)
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tid TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                detail TEXT NOT NULL
            );
        """)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pack(value) -> str:
    """Serialize a value for storage; dicts/lists get a JSON prefix."""
    if isinstance(value, (dict, list)):
        return "__JSON__:" + json.dumps(value)
    return str(value)


def _unpack(raw: str):
    """Deserialize a stored value."""
    if raw.startswith("__JSON__:"):
        return json.loads(raw[9:])
    return raw


def _transfer_row(row) -> dict:
    d = dict(row)
    d["has_demo_data"] = bool(d["has_demo_data"])
    return d


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------

def db_get_all_transfers() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM transfers ORDER BY rowid").fetchall()
        return [_transfer_row(r) for r in rows]


def db_get_transfer(tid: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM transfers WHERE id = ?", (tid,)).fetchone()
        return _transfer_row(row) if row else None


def db_transfer_exists(tid: str) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM transfers WHERE id = ?", (tid,)).fetchone()
        return row is not None


def db_create_transfer(t: dict):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO transfers "
            "(id, name, product, sending_org, receiving_org, status, has_demo_data) "
            "VALUES (?,?,?,?,?,?,?)",
            (
                t["id"], t["name"], t["product"],
                t["sending_org"], t["receiving_org"],
                t["status"], int(t.get("has_demo_data", False)),
            ),
        )


def db_update_transfer_status(tid: str, status: str):
    with get_conn() as conn:
        conn.execute("UPDATE transfers SET status = ? WHERE id = ?", (status, tid))


def db_set_has_demo_data(tid: str, val: bool):
    with get_conn() as conn:
        conn.execute("UPDATE transfers SET has_demo_data = ? WHERE id = ?", (int(val), tid))


# ---------------------------------------------------------------------------
# Packages
# ---------------------------------------------------------------------------

def db_get_package(tid: str) -> dict | None:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT key, value FROM packages WHERE tid = ?", (tid,)
        ).fetchall()
        if not rows:
            return None
        return {r["key"]: _unpack(r["value"]) for r in rows}


def db_has_package(tid: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM packages WHERE tid = ? LIMIT 1", (tid,)
        ).fetchone()
        return row is not None


def db_set_package_key(tid: str, key: str, value):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO packages (tid, key, value) VALUES (?,?,?)",
            (tid, key, _pack(value)),
        )


# ---------------------------------------------------------------------------
# Gap results
# ---------------------------------------------------------------------------

def db_get_gaps(tid: str) -> list:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT gaps_json FROM gap_results WHERE tid = ?", (tid,)
        ).fetchone()
        return json.loads(row["gaps_json"]) if row else []


def db_has_gaps(tid: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM gap_results WHERE tid = ?", (tid,)
        ).fetchone()
        return row is not None


def db_set_gaps(tid: str, gaps: list):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO gap_results (tid, gaps_json) VALUES (?,?)",
            (tid, json.dumps(gaps)),
        )


# ---------------------------------------------------------------------------
# Plan results
# ---------------------------------------------------------------------------

def db_get_plan(tid: str) -> list:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT tasks_json FROM plan_results WHERE tid = ?", (tid,)
        ).fetchone()
        return json.loads(row["tasks_json"]) if row else []


def db_set_plan(tid: str, tasks: list):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO plan_results (tid, tasks_json) VALUES (?,?)",
            (tid, json.dumps(tasks)),
        )


# ---------------------------------------------------------------------------
# Draft results
# ---------------------------------------------------------------------------

def db_get_draft(tid: str, doc_type: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT content, approval_status FROM draft_results "
            "WHERE tid = ? AND doc_type = ?",
            (tid, doc_type),
        ).fetchone()
        return dict(row) if row else None


def db_has_draft(tid: str, doc_type: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM draft_results WHERE tid = ? AND doc_type = ?",
            (tid, doc_type),
        ).fetchone()
        return row is not None


def db_set_draft(tid: str, doc_type: str, content: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO draft_results "
            "(tid, doc_type, content, approval_status) VALUES (?,?,?,?)",
            (tid, doc_type, content, "Draft"),
        )


def db_update_draft_content(tid: str, doc_type: str, content: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE draft_results SET content = ?, approval_status = 'Draft' "
            "WHERE tid = ? AND doc_type = ?",
            (content, tid, doc_type),
        )


def db_approve_draft(tid: str, doc_type: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE draft_results SET approval_status = 'Approved' "
            "WHERE tid = ? AND doc_type = ?",
            (tid, doc_type),
        )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

def db_log_event(tid: str, event_type: str, detail: str, timestamp: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO audit_log (tid, timestamp, event_type, detail) VALUES (?,?,?,?)",
            (tid, timestamp, event_type, detail),
        )


def db_get_audit_log(tid: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT timestamp, event_type, detail FROM audit_log "
            "WHERE tid = ? ORDER BY id DESC",
            (tid,),
        ).fetchall()
        return [dict(r) for r in rows]
