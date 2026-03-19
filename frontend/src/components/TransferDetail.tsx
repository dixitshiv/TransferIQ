import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Transfer, AuditEvent, HistoricalComparator } from '../types'
import GapAnalysis from './GapAnalysis'
import TransferPlan from './TransferPlan'
import DocumentDraft from './DocumentDraft'

type Tab = 'overview' | 'gaps' | 'plan' | 'drafts'

const STATUS_COLORS: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Gaps Identified': 'bg-red-50 text-red-700 border-red-200',
  'Plan Ready': 'bg-amber-50 text-amber-700 border-amber-200',
  'Draft Complete': 'bg-green-50 text-green-700 border-green-200',
}

const EVENT_ICONS: Record<string, string> = {
  transfer_created: '✦',
  demo_loaded: '◈',
  file_uploaded: '↑',
  gap_analysis_started: '◌',
  gap_analysis_complete: '◉',
  gap_analysis_error: '✕',
  plan_generated: '▦',
  draft_started: '◌',
  draft_complete: '◉',
  draft_approved: '✓',
}

const EVENT_COLORS: Record<string, string> = {
  transfer_created: 'text-slate-500',
  demo_loaded: 'text-blue-600',
  file_uploaded: 'text-blue-600',
  gap_analysis_started: 'text-amber-600',
  gap_analysis_complete: 'text-emerald-600',
  gap_analysis_error: 'text-red-600',
  plan_generated: 'text-emerald-600',
  draft_started: 'text-amber-600',
  draft_complete: 'text-emerald-600',
  draft_approved: 'text-emerald-600',
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-900 font-mono font-medium">{value}</p>
    </div>
  )
}

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => api.getTransfer(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm font-medium">
        Loading transfer...
      </div>
    )
  }

  if (error || !transfer) {
    return (
      <div className="py-24 text-center">
        <p className="text-red-400 text-sm mb-4">Transfer not found or backend unavailable.</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    )
  }

  const statusCls = STATUS_COLORS[transfer.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'gaps', label: 'Gap Analysis' },
    { key: 'plan', label: 'Transfer Plan' },
    { key: 'drafts', label: 'Document Drafts' },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <button onClick={() => navigate('/')} className="hover:text-slate-900 transition-colors">
          Dashboard
        </button>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-slate-900 truncate max-w-[400px]">{transfer.name}</span>
      </div>

      {/* Transfer header */}
      <div className="border border-slate-200 shadow-sm bg-white rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-1">
              {transfer.name}
            </h1>
            <p className="text-sm text-slate-500 font-mono font-medium">{transfer.product}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`status-pill border text-[11px] font-mono tracking-wide ${statusCls}`}>
              {transfer.status}
            </span>
            {transfer.has_demo_data && (
              <span className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Data loaded
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 pt-4 border-t border-slate-100">
          <InfoRow label="Transfer ID" value={transfer.id} />
          <InfoRow label="Sending Org" value={transfer.sending_org} />
          <InfoRow label="Receiving Org" value={transfer.receiving_org} />
          <InfoRow label="Status" value={transfer.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-2 px-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : 'tab-btn-inactive'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab transfer={transfer} transferId={transfer.id} queryClient={queryClient} />
        )}
        {activeTab === 'gaps' && (
          <GapAnalysis transferId={transfer.id} />
        )}
        {activeTab === 'plan' && (
          <TransferPlan transferId={transfer.id} />
        )}
        {activeTab === 'drafts' && (
          <DocumentDraft transferId={transfer.id} />
        )}
      </div>
    </div>
  )
}

function OverviewTab({
  transfer,
  transferId,
  queryClient,
}: {
  transfer: Transfer
  transferId: string
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; pages: number }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activityOpen, setActivityOpen] = useState(true)

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit-log', transferId],
    queryFn: () => api.getAuditLog(transferId),
    refetchInterval: 8000,
  })

  const { data: comparators = [] } = useQuery({
    queryKey: ['similar', transferId],
    queryFn: () => api.getSimilarTransfers(transferId),
    enabled: transfer.has_demo_data,
  })

  const handleFiles = async (files: FileList) => {
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    const results: { name: string; pages: number }[] = []
    for (const file of Array.from(files)) {
      try {
        const res = await api.uploadFile(transferId, file)
        results.push({ name: file.name, pages: res.pages })
      } catch {
        setUploadError(`Failed to upload ${file.name}. Only PDF files are fully parsed.`)
      }
    }
    setUploadedFiles(prev => [...prev, ...results])
    setUploading(false)
    queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
    queryClient.invalidateQueries({ queryKey: ['transfers'] })
    queryClient.invalidateQueries({ queryKey: ['audit-log', transferId] })
  }

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Product info */}
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Product Information
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <InfoField label="Product Name" value={transfer.product} />
            <InfoField label="Transfer Route" value={`${transfer.sending_org} → ${transfer.receiving_org}`} />
            <InfoField label="Transfer ID" value={transfer.id} mono />
            <InfoField label="Current Status" value={transfer.status} />
            <InfoField label="Package Data" value={transfer.has_demo_data ? 'Loaded' : 'Not Loaded'} />
          </div>
        </div>

        {/* Document Ingestion */}
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Document Ingestion
            </h3>
            {transfer.has_demo_data && (
              <span className="text-[11px] font-mono text-emerald-600 font-bold flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Package loaded
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'
                }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <svg className="animate-spin w-5 h-5 text-blue-600 mx-auto" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="17 8" strokeLinecap="round" />
                  </svg>
                  <p className="text-xs text-slate-500 font-medium mt-2">Uploading...</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-2 text-slate-400" width="24" height="24" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3v10M6 7l4-4 4 4M4 15h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-700">Drop PDF here or click to browse</p>
                  <p className="text-[11px] text-slate-400 mt-1">PDF</p>
                </>
              )}
            </div>

            {uploadError && (
              <p className="text-[11px] text-red-600 font-medium">{uploadError}</p>
            )}

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-mono px-3 py-2 bg-slate-50 rounded-md border border-slate-200">
                    <span className="text-slate-700 font-medium truncate">{f.name}</span>
                    <span className="text-slate-500 shrink-0 ml-2 font-medium">{f.pages}p</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sample package download */}
            <div className="pt-1 text-center">
              <a
                href="/api/demo-package/download"
                download="demo_transfer_package.pdf"
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Don't have a package? Download our sample PDF →
              </a>
            </div>
          </div>
        </div>

        {/* Document inventory */}
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Document Inventory
            </h3>
            <span className="text-[11px] font-mono font-medium text-slate-500">
              {transfer.has_demo_data
                ? `${uploadedFiles.length > 0 ? uploadedFiles.length + ' uploaded + ' : ''}Demo Package`
                : 'No documents'}
            </span>
          </div>
          {transfer.has_demo_data ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-5">Document</th>
                  <th>Type</th>
                  <th className="pr-5">Completeness</th>
                </tr>
              </thead>
              <tbody>
                {uploadedFiles.map((f, i) => (
                  <tr key={`upload-${i}`}>
                    <td className="text-slate-900 font-medium pl-5">{f.name}</td>
                    <td className="font-mono text-[11px] text-slate-500 font-medium">
                      {f.name.endsWith('.pdf') ? 'PDF' : f.name.endsWith('.xlsx') ? 'Excel' : 'Word'}
                    </td>
                    <td className="pr-5">
                      <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Uploaded</span>
                    </td>
                  </tr>
                ))}
                {[
                  { name: 'Master Batch Record', type: 'PDF', status: 'Available' },
                  { name: 'Process Description', type: 'PDF', status: 'Available' },
                  { name: 'Analytical Method Package', type: 'PDF', status: 'Available' },
                  { name: 'Stability Data Package', type: 'PDF', status: 'Available' },
                  { name: 'Equipment Qualification', type: 'PDF', status: 'Partial' },
                  { name: 'Risk Assessment', type: 'PDF', status: 'Missing' },
                ].map((doc, i) => (
                  <tr key={`demo-${i}`}>
                    <td className="text-slate-900 font-medium pl-5">{doc.name}</td>
                    <td className="font-mono text-[11px] font-medium text-slate-500">{doc.type}</td>
                    <td className="pr-5">
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${doc.status === 'Available' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                          doc.status === 'Partial' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-red-700 bg-red-50 border-red-200'
                        }`}>
                        {doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-8 text-center font-medium text-slate-500 text-sm">
              Upload a PDF package to see document inventory.
            </div>
          )}
        </div>

        {/* Workflow status */}
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Workflow Progress
            </h3>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-0">
              {[
                { step: 1, label: 'Data Ingestion', done: transfer.has_demo_data },
                { step: 2, label: 'Gap Analysis', done: ['Gaps Identified', 'Plan Ready', 'Draft Complete'].includes(transfer.status) },
                { step: 3, label: 'Transfer Plan', done: ['Plan Ready', 'Draft Complete'].includes(transfer.status) },
                { step: 4, label: 'Draft Documents', done: transfer.status === 'Draft Complete' },
              ].map((item, i, arr) => (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${item.done
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                      {item.done ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : item.step}
                    </div>
                    <p className={`text-[11px] mt-2 font-bold tracking-wide uppercase ${item.done ? 'text-blue-700' : 'text-slate-400'}`}>
                      {item.label}
                    </p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 mb-4 transition-colors ${item.done ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Comparators */}
      {comparators.length > 0 && (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              Historical Context — Similar Transfers
            </h3>
            <span className="text-[10px] font-mono font-medium text-slate-500">{comparators.length} comparators · ranked by similarity</span>
          </div>
          <div className="divide-y divide-slate-100">
            {(comparators as HistoricalComparator[]).map((c) => (
              <HistoricalComparatorRow key={c.id} comp={c} />
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
        <button
          className="w-full px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors"
          onClick={() => setActivityOpen(o => !o)}
        >
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500">
            Activity Log
          </h3>
          <div className="flex items-center gap-2">
            {auditEvents.length > 0 && (
              <span className="text-[10px] font-mono font-medium text-slate-500">{auditEvents.length} events</span>
            )}
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`text-slate-400 transition-transform ${activityOpen ? 'rotate-180' : ''}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {activityOpen && (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
            {auditEvents.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-500 font-medium text-sm">
                No activity recorded yet.
              </div>
            ) : (
              auditEvents.map((ev: AuditEvent, i: number) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className={`text-[13px] font-mono font-bold shrink-0 mt-[1px] ${EVENT_COLORS[ev.event_type] ?? 'text-slate-400'}`}>
                    {EVENT_ICONS[ev.event_type] ?? '·'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-700">{ev.detail}</p>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0">{formatTimestamp(ev.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoricalComparatorRow({ comp }: { comp: HistoricalComparator }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.round(comp.similarity_score * 100)
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-slate-400'
  const outcomeColor = comp.outcome === 'Successful' ? 'text-emerald-600' : comp.outcome === 'Delayed' ? 'text-amber-600' : 'text-red-600'

  return (
    <>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Similarity bar */}
        <div className="shrink-0 w-16 text-center">
          <p className={`text-sm font-black font-mono tracking-tight ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-slate-500'}`}>{pct}%</p>
          <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-900 font-bold truncate">{comp.product}</p>
          <p className="text-[11px] text-slate-500 font-mono font-medium mt-1">
            {comp.sending_org} → {comp.receiving_org} · {comp.year}
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Duration</p>
            <p className="text-[12px] font-mono font-bold text-slate-700">{comp.duration_days}d</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Outcome</p>
            <p className={`text-[12px] font-mono font-bold ${outcomeColor}`}>{comp.outcome}</p>
          </div>
          <div className="flex gap-1.5 ml-2">
            {comp.gap_count.CRITICAL > 0 && (
              <span className="badge-critical text-[9px]">{comp.gap_count.CRITICAL}C</span>
            )}
            {comp.gap_count.MAJOR > 0 && (
              <span className="badge-major text-[9px]">{comp.gap_count.MAJOR}M</span>
            )}
            {comp.gap_count.MINOR > 0 && (
              <span className="badge-minor text-[9px]">{comp.gap_count.MINOR}m</span>
            )}
          </div>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
          <div className="mt-4 border border-slate-200 bg-white shadow-sm rounded-xl p-5 space-y-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">Matched Attributes</p>
              <div className="flex flex-wrap gap-2">
                {comp.matched_attributes.map((attr, i) => (
                  <span key={i} className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                    {attr}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">Key Gaps in This Transfer</p>
              <ul className="space-y-1.5">
                {comp.key_gaps.map((gap, i) => (
                  <li key={i} className="text-[13px] text-slate-700 flex items-start gap-2">
                    <span className="text-slate-400 font-bold mt-0.5">·</span>{gap}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-amber-600 mb-1.5">Lessons Learned</p>
              <p className="text-[13px] text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3 italic">"{comp.lessons_learned}"</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px] py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 font-medium shrink-0">{label}</span>
      <span className={`text-slate-900 text-right font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
