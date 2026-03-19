# TransferIQ

An AI-powered platform for pharmaceutical technology transfers. Automates the most time-consuming parts of a CDMO-to-CDMO tech transfer programme — gap analysis against ICH requirements, master plan generation, and regulatory document drafting — using a local LLM with no data leaving your environment.

> Built as a proof of concept to explore how generative AI can reduce the manual overhead of small molecule drug product technology transfers.

---

## The problem

A tech transfer package arrives as a stack of PDFs: batch records, analytical methods, stability reports, product information sheets. A project team manually reviews every document against ICH Q8/Q9/Q10 requirements to identify what's missing or incomplete, builds a remediation plan, assigns owners, and writes protocol documents. That process takes weeks of expert time.

TransferIQ automates three core steps of that workflow.

---

## What it does

**Gap Analysis**
Ingests the transfer package (uploaded PDF or pre-loaded demo) and runs it against a 30-item ICH requirements checklist across six categories: Formulation & Process, Analytical Methods, Specifications, Stability Data, Regulatory Documentation, Equipment & Facility. Surfaces gaps by severity — CRITICAL / MAJOR / MINOR — with source reference, responsible function, recommended action, and target completion date. Results stream in real time via SSE.

**Transfer Plan Generation**
Takes the identified gaps and generates a sequenced master task list covering the full transfer lifecycle. Each task includes owning function (Analytical, QA, Manufacturing, Regulatory, Engineering), predecessor dependency, due-date offset, and expected deliverable.

**Document Drafting**
Generates draft regulatory documents — Method Transfer Protocol, Technology Transfer Protocol, Risk Assessment, Validation Protocol, and others — pre-populated with product-specific context and gap findings. Output streams token-by-token, is editable in-app, exportable as `.docx`, and includes per-section confidence scoring (HIGH / MEDIUM / LOW based on gap coverage).

**Historical Context (RAG)**
Seven historical comparator transfer records are embedded with `nomic-embed-text` and stored in ChromaDB. When viewing any transfer, the system retrieves the most similar historical cases by cosine similarity and surfaces their outcomes, gap counts, and lessons learned.

---

## Demo transfers

Four pre-seeded examples covering different formulation types, BCS classifications, and transfer complexities. All data survives backend restarts (SQLite persistence).

| Transfer | Sending → Receiving | Highlights |
|----------|---------------------|------------|
| **Metformin HCl 500mg Tablets** | InnoPharm Inc. → BioMed CDMO | Post-approval site change · dissolution method transfer gap · incomplete long-term stability |
| **Ibuprofen 400mg Film-Coated Tablets** | Catalent Pharma Solutions → Lonza Group AG | BCS Class II · surfactant dissolution method · PSD instrument equivalence (Malvern vs Sympatec) · roller compaction scale-up |
| **Sitagliptin Phosphate Monohydrate 100mg** | Cambrex Corporation → Recipharm AB | Polymorphic form control (monohydrate Form I) · chiral HPLC transfer · XRPD capability gap at receiving site · narrow LOD drying window |
| **Valsartan 80mg Hard Gelatin Capsules** | Fareva SA → Thermo Fisher Scientific | Amorphous API recrystallisation risk · nitrosamine (NDMA/NMBA) regulatory requirement · accelerated stability failure at 6M |

Each demo includes a full synthetic transfer package — product info, batch record, analytical methods package, and stability data summary — with realistic, intentional gaps designed to produce a meaningful analysis.

---

## Architecture

```
┌──────────────────────────────────────┐
│  React + TypeScript (Vite, :5173)    │
│  Dashboard · Gap Analysis            │
│  Transfer Plan · Document Drafts     │
└───────────────┬──────────────────────┘
                │  REST + SSE
                │  Vite proxy → :8000
┌───────────────▼──────────────────────┐
│  FastAPI (Python, :8000)             │
│                                      │
│  ┌──────────┐   ┌──────────────────┐ │
│  │  Agents  │   │  SQLite          │ │
│  │  ──────  │   │  ─────────────── │ │
│  │  Gap     │   │  transfers       │ │
│  │  Planner │   │  packages        │ │
│  │  Drafter │   │  gap_results     │ │
│  │  RAG     │   │  plan_results    │ │
│  └────┬─────┘   │  draft_results   │ │
│       │         │  audit_log       │ │
│  ┌────▼──────┐  └──────────────────┘ │
│  │  Ollama   │                       │
│  │  llama3.2 │  ┌──────────────────┐ │
│  │  nomic-   │  │  ChromaDB        │ │
│  │  embed    │  │  historical RAG  │ │
│  └───────────┘  └──────────────────┘ │
└──────────────────────────────────────┘
```

**Backend:** FastAPI · SQLite (stdlib `sqlite3`) · LangChain LCEL · ChromaDB
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query v5
**LLM:** `llama3.2` for reasoning · `nomic-embed-text` for RAG embeddings, both via Ollama
**SSE:** Gap analysis and document drafting stream token-by-token via POST + `sse-starlette`; frontend consumes with `fetch` + `ReadableStream` (not `EventSource`, which doesn't support POST)

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) running locally

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

---

## Running locally

**Backend**

```bash
cd "Transfer IQ"
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
uvicorn main:app --reload
# API:   http://localhost:8000
# Docs:  http://localhost:8000/docs
```

On first start, the backend automatically:
- Creates `data/transferiq.db` and seeds all four demo transfers with package data
- Generates demo PDFs (`data/demo_*.pdf`)
- Pre-warms the ChromaDB vector store in a background thread

Subsequent restarts are instant — all seeded data is preserved.

**Frontend**

```bash
cd "Transfer IQ/frontend"
npm install
npm run dev
# App: http://localhost:5173
```

---

## Walkthrough

1. Open `http://localhost:5173` — the Dashboard shows all four pre-loaded demo transfers with status badges and summary stats.

2. Click any transfer row to open Transfer Detail.

3. **Overview tab** — product metadata, document inventory, and the historical context panel showing the most similar past transfers (cosine similarity scored) with their outcomes and lessons learned.

4. **Gap Analysis tab** — click **Run Analysis**. Gaps stream in categorised by severity:
   - CRITICAL (red) — blocking issues; batch release or regulatory filing at risk
   - MAJOR (amber) — significant gaps requiring remediation before transfer completion
   - MINOR (yellow) — documentation or process improvements recommended
   Expand any row for the full ICH requirement text, responsible function, and recommended action.

5. **Transfer Plan tab** — click **Generate Plan**. Produces 20+ sequenced tasks with function ownership, predecessor dependencies, and due-date offsets across the full transfer lifecycle.

6. **Document Drafts tab** — select a document type and click **Generate**:
   - Full document streams in rendered markdown
   - **Confidence Analysis** button shows per-section HIGH / MEDIUM / LOW ratings based on gap coverage
   - **Edit** → make inline changes → **Save** to persist
   - **Approve** locks the document with an Approved status stamp
   - **Export .docx** downloads a formatted Word document

7. Back on Dashboard, **New Transfer** → upload any PDF → the system extracts text, indexes it into ChromaDB, and runs the same analysis pipeline against it.

---

## How the agents work

All agents use LangChain Expression Language (LCEL): `prompt | llm | output_parser`.

| Agent | File | Parser | Output |
|-------|------|--------|--------|
| Gap analysis | `agents/gap_analysis.py` | `JsonOutputParser` | Structured gap objects streamed via SSE |
| Transfer planner | `agents/planner.py` | `JsonOutputParser` | Sequenced task list |
| Document drafter | `agents/drafter.py` | `StrOutputParser` | Streaming markdown |
| RAG retrieval | `agents/rag.py` | ChromaDB cosine query | Top-K similar historical transfers |

The gap analysis prompt includes the full ICH checklist and the package summary; the drafter prompt includes product info, the gap list, and a document-type-specific template instruction. Prompts are in each agent file and are the primary levers for improving output quality.

---

## Project structure

```
Transfer IQ/
├── backend/
│   ├── main.py                          # FastAPI app — all routes
│   ├── database.py                      # SQLite persistence layer (all CRUD)
│   ├── requirements.txt
│   ├── agents/
│   │   ├── gap_analysis.py              # ICH gap analysis agent
│   │   ├── planner.py                   # Transfer plan generation agent
│   │   ├── drafter.py                   # Document drafting agent (streaming)
│   │   ├── ingestion.py                 # Demo package loading + PDF generation
│   │   └── rag.py                       # ChromaDB vector store + retrieval
│   ├── models/
│   │   └── schemas.py                   # Pydantic models
│   ├── utils/
│   │   └── pdf_utils.py                 # PDF text extraction
│   └── data/
│       ├── transferiq.db                # SQLite DB (auto-created on first run)
│       ├── demo_package/                # Metformin HCl transfer package
│       ├── demo_package_ibuprofen/      # Ibuprofen transfer package
│       ├── demo_package_sitagliptin/    # Sitagliptin transfer package
│       ├── demo_package_valsartan/      # Valsartan transfer package
│       ├── requirements/
│       │   └── ich_requirements.json   # ICH Q8/Q9/Q10 checklist (30 items)
│       ├── historical_comparators.json  # RAG knowledge base (7 records)
│       └── chroma_db/                   # ChromaDB vector store (auto-created)
└── frontend/
    └── src/
        ├── App.tsx
        ├── api.ts                       # Axios + SSE fetch client
        ├── types.ts
        └── components/
            ├── Layout.tsx               # Sidebar navigation
            ├── Dashboard.tsx            # Transfer list + stats
            ├── TransferDetail.tsx       # Tabbed transfer view
            ├── GapAnalysis.tsx          # Severity-coded gap table
            ├── TransferPlan.tsx         # Task table
            └── DocumentDraft.tsx        # Draft editor + confidence + export
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transfers` | List all transfers |
| `POST` | `/api/transfers` | Create a new transfer |
| `GET` | `/api/transfers/{id}` | Get transfer detail |
| `POST` | `/api/transfers/{id}/upload` | Upload a PDF document |
| `POST` | `/api/transfers/{id}/gap-analysis` | Run gap analysis (SSE stream) |
| `GET` | `/api/transfers/{id}/gap-analysis` | Get saved gap results |
| `POST` | `/api/transfers/{id}/plan` | Generate transfer plan |
| `GET` | `/api/transfers/{id}/plan` | Get saved plan |
| `POST` | `/api/transfers/{id}/draft` | Generate document draft (SSE stream) |
| `GET` | `/api/transfers/{id}/draft/{doc_type}` | Get saved draft |
| `PUT` | `/api/transfers/{id}/draft/{doc_type}` | Update draft content |
| `POST` | `/api/transfers/{id}/draft/{doc_type}/approve` | Approve a draft |
| `GET` | `/api/transfers/{id}/draft/{doc_type}/confidence` | Per-section confidence scores |
| `GET` | `/api/transfers/{id}/draft/{doc_type}/export/docx` | Export draft as `.docx` |
| `GET` | `/api/transfers/{id}/similar` | Similar historical transfers (RAG) |
| `GET` | `/api/transfers/{id}/audit-log` | Full audit log (newest first) |
| `GET` | `/api/demo-package/{demo_id}/download` | Download demo package PDF |

---

## Document types

| `doc_type` value | Document |
|------------------|----------|
| `tech_transfer_protocol` | Technology Transfer Protocol |
| `analytical_method_transfer` | Analytical Method Transfer Report |
| `risk_assessment` | Risk Assessment |
| `validation_protocol` | Validation Protocol |
| `process_description` | Process Description |
| `batch_record_template` | Batch Record Template |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `llama3.2` | Ollama model for gap analysis, planning, drafting |
| `EMBED_MODEL` | `nomic-embed-text` | Ollama model for RAG embeddings |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |

---

## Production gaps

This is a proof of concept. A production deployment for a regulated CDMO environment would additionally require:

- **Authentication & RBAC** — no auth exists; production needs SSO (Azure AD/Okta) and role-based access (Author, QA, Client, Project Manager)
- **Multi-tenancy** — a CDMO serving multiple clients needs complete data isolation between clients; currently all transfers are visible to all users
- **21 CFR Part 11 / EU Annex 11** — electronic signatures must be attributable to a named individual; the audit trail must be tamper-evident; the system must be validated per GAMP 5 (IQ/OQ/PQ)
- **LLM governance** — the model version used to generate each draft is not logged; model updates are not treated as change control events; hallucinations in AI output are not detected
- **Document management** — approved documents should live in a validated eDMS (Veeva Vault, Documentum) rather than the app database; documents need controlled numbering and formal version history
- **System integrations** — gaps should create CAPA actions in the QMS; analytical data should flow from LIMS rather than extracted from PDFs; transfer tasks should sync to ERP/project management tooling
- **Infrastructure** — SQLite does not support concurrent writes; production needs PostgreSQL; TLS, rate limiting, structured logging, and monitoring are all absent
