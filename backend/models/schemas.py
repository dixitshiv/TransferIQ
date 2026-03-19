from pydantic import BaseModel
from typing import Optional
from enum import Enum


class TransferStatus(str, Enum):
    in_progress = "In Progress"
    gaps_identified = "Gaps Identified"
    plan_ready = "Plan Ready"
    draft_complete = "Draft Complete"


class Transfer(BaseModel):
    id: str
    name: str
    product: str
    sending_org: str
    receiving_org: str
    status: TransferStatus = TransferStatus.in_progress
    has_demo_data: bool = False


class Gap(BaseModel):
    category: str
    description: str
    severity: str
    source_ref: str
    requirement: str
    recommended_action: str
    responsible_function: Optional[str] = None
    target_date: Optional[str] = None


class Task(BaseModel):
    task_name: str
    function: str
    predecessor: Optional[str] = None
    due_offset_days: int
    deliverable: str
    status: str = "Not Started"


class DraftDocument(BaseModel):
    doc_type: str
    content: str


class CreateTransferRequest(BaseModel):
    name: str
    product: str
    sending_org: str
    receiving_org: str


class DraftRequest(BaseModel):
    doc_type: str = "transfer_summary_report"
