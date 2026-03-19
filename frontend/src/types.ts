export type TransferStatus =
  | 'In Progress'
  | 'Gaps Identified'
  | 'Plan Ready'
  | 'Draft Complete'

export type DocumentStatus = 'Draft' | 'Under Review' | 'Approved'

export interface Transfer {
  id: string
  name: string
  product: string
  sending_org: string
  receiving_org: string
  status: TransferStatus
  has_demo_data: boolean
}

export interface CreateTransferRequest {
  name: string
  product: string
  sending_org: string
  receiving_org: string
}

export interface Gap {
  category: string
  description: string
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
  source_ref: string
  requirement: string
  recommended_action: string
  responsible_function?: string
  target_date?: string
}

export interface ConfidenceScore {
  section: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
}

export interface Task {
  task_name: string
  function: string
  predecessor: string | null
  due_offset_days: number
  deliverable: string
  status: string
}

export interface DraftDocument {
  doc_type: string
  content: string
  status: DocumentStatus
}

export interface AuditEvent {
  timestamp: string
  event_type: string
  detail: string
}

export interface HistoricalComparator {
  id: string
  product: string
  dosage_form: string
  api: string
  sending_org: string
  receiving_org: string
  year: number
  outcome: 'Successful' | 'Delayed' | 'Failed'
  duration_days: number
  similarity_score: number
  matched_attributes: string[]
  gap_count: { CRITICAL: number; MAJOR: number; MINOR: number }
  key_gaps: string[]
  lessons_learned: string
}

export interface PipelineEvent {
  node?: 'gap_analysis' | 'planner' | 'drafter'
  status: string
  gaps?: Gap[]
  tasks?: Task[]
}

export const DOC_TYPES = [
  { value: 'tech_transfer_protocol', label: 'Technology Transfer Protocol' },
  { value: 'process_description', label: 'Process Description' },
  { value: 'analytical_method_transfer', label: 'Analytical Method Transfer Report' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
  { value: 'validation_protocol', label: 'Validation Protocol' },
  { value: 'batch_record_template', label: 'Batch Record Template' },
]
