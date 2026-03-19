import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, streamDraft } from '../api'
import { DOC_TYPES } from '../types'
import type { DocumentStatus, ConfidenceScore } from '../types'

const STATUS_BADGE: Record<DocumentStatus, string> = {
  'Draft': 'bg-slate-50 text-slate-500 border-slate-200',
  'Under Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const CONF_BADGE: Record<string, string> = {
  HIGH: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
  LOW: 'text-red-700 bg-red-50 border-red-200',
}

export default function DocumentDraft({ transferId }: { transferId: string }) {
  const queryClient = useQueryClient()
  const [docType, setDocType] = useState(DOC_TYPES[0].value)
  const [streaming, setStreaming] = useState(false)
  const [streamedContent, setStreamedContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [localStatus, setLocalStatus] = useState<DocumentStatus>('Draft')
  const [reviewNotes, setReviewNotes] = useState('')
  const [showConfidence, setShowConfidence] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const cleanupRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll as content streams in
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamedContent, streaming])

  const { data: savedDraft, refetch: refetchDraft } = useQuery({
    queryKey: ['draft', transferId, docType],
    queryFn: () => api.getDraft(transferId, docType),
    enabled: false,
    retry: false,
  })

  // Sync local status from saved draft when loaded
  useEffect(() => {
    if (savedDraft?.status) {
      setLocalStatus(savedDraft.status)
    }
  }, [savedDraft?.status])

  const { data: confidenceScores, refetch: fetchConfidence, isFetching: fetchingConfidence } = useQuery({
    queryKey: ['draft-confidence', transferId, docType],
    queryFn: () => api.getDraftConfidence(transferId, docType),
    enabled: false,
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: (content: string) => api.updateDraft(transferId, docType, content),
    onSuccess: (_, content) => {
      setStreamedContent(content)
      setEditMode(false)
      setLocalStatus('Draft')
      queryClient.invalidateQueries({ queryKey: ['audit-log', transferId] })
      refetchDraft()
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => api.approveDraft(transferId, docType),
    onSuccess: () => {
      setLocalStatus('Approved')
      queryClient.invalidateQueries({ queryKey: ['audit-log', transferId] })
      refetchDraft()
    },
  })

  const handleGenerate = () => {
    if (cleanupRef.current) cleanupRef.current()
    setStreaming(true)
    setStreamedContent('')
    setError(null)
    setComplete(false)
    setLocalStatus('Draft')

    cleanupRef.current = streamDraft(
      transferId,
      docType,
      (chunk) => {
        setStreamedContent(prev => (prev ?? '') + chunk)
      },
      () => {
        setStreaming(false)
        setComplete(true)
        refetchDraft()
      },
      (err) => {
        console.error(err)
        setError('Draft generation failed. Upload a package PDF and run gap analysis first.')
        setStreaming(false)
      },
    )
  }

  const handleDocTypeChange = (newType: string) => {
    setDocType(newType)
    setStreamedContent(null)
    setComplete(false)
    setError(null)
    setLocalStatus('Draft')
    setReviewNotes('')
    setShowConfidence(false)
    setEditMode(false)
  }

  const displayContent = streamedContent ?? savedDraft?.content ?? null
  const docLabel = DOC_TYPES.find(d => d.value === docType)?.label ?? docType
  const effectiveStatus: DocumentStatus = localStatus

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">
            Document Type
          </label>
          <select
            className="input-field"
            value={docType}
            onChange={e => handleDocTypeChange(e.target.value)}
            disabled={streaming}
          >
            {DOC_TYPES.map(dt => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>

        <div className="pt-5">
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={streaming}
          >
            {streaming ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="17 8" strokeLinecap="round" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 11.5l9-9M11.5 2.5H7M11.5 2.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Generate Draft
              </>
            )}
          </button>
        </div>

        {complete && (
          <div className="pt-5">
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                setShowConfidence(v => !v)
                if (!showConfidence) fetchConfidence()
              }}
            >
              {fetchingConfidence ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="17 8" />
                  </svg>
                  Scoring...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 4v2.5M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {showConfidence ? 'Hide Confidence' : 'Confidence Analysis'}
                </>
              )}
            </button>
          </div>
        )}

        {complete && effectiveStatus !== 'Approved' && (
          <div className="pt-5">
            <button
              className="btn-secondary text-xs"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Draft'}
            </button>
          </div>
        )}

        {complete && (
          <div className="pt-5 flex items-center gap-1.5 text-xs font-mono">
            <span className={`status-pill border text-[10px] ${STATUS_BADGE[effectiveStatus]}`}>
              {effectiveStatus}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 font-medium shadow-sm w-full">
          {error}
        </div>
      )}

      {/* Streaming indicator */}
      {streaming && (
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          AI generating {docLabel}...
        </div>
      )}

      {/* Document content */}
      {displayContent !== null ? (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
          {/* Doc header */}
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Draft Document</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{docLabel}</h3>
              </div>
              {complete && (
                <span className={`status-pill border text-[10px] font-mono tracking-wide ${STATUS_BADGE[effectiveStatus]}`}>
                  {effectiveStatus}
                </span>
              )}
            </div>
            {displayContent && (
              <div className="flex items-center gap-2">
                {/* Edit / Save / Cancel */}
                {!editMode ? (
                  <button
                    className="btn-ghost text-[11px]"
                    onClick={() => { setEditContent(displayContent); setEditMode(true) }}
                    disabled={streaming}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 9.5l1.5-1.5L9 2.5 10 3.5 4.5 9 2 10z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-secondary text-[11px]"
                      onClick={() => saveMutation.mutate(editContent)}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      className="btn-ghost text-[11px]"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* Export buttons */}
                <button
                  className="btn-ghost text-[11px]"
                  onClick={() => {
                    const blob = new Blob([displayContent], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${docType}.md`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v7M3 7l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  .md
                </button>
                <a
                  className="btn-ghost text-[11px]"
                  href={`/api/transfers/${transferId}/draft/${docType}/export/docx`}
                  download
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v7M3 7l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  .docx
                </a>
              </div>
            )}
          </div>

          {/* Markdown content / Edit textarea */}
          {editMode ? (
            <div className="bg-slate-50 p-4">
              <textarea
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 font-mono leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none shadow-sm"
                rows={28}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                spellCheck={false}
              />
              <p className="text-[10px] text-slate-400 font-medium mt-2">Editing markdown source. Save to update the rendered view.</p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="p-8 max-h-[600px] overflow-y-auto bg-white"
            >
              <div className="prose prose-sm prose-slate max-w-none
                prose-headings:font-bold prose-headings:text-slate-900 prose-headings:tracking-tight
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-p:text-slate-600 prose-p:leading-relaxed prose-p:font-medium
                prose-strong:text-slate-800 prose-strong:font-bold
                prose-code:font-mono prose-code:text-[12px] prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:shadow-sm prose-pre:rounded-xl
                prose-table:text-sm prose-th:text-slate-500 prose-th:font-semibold prose-td:text-slate-600 prose-td:font-medium
                prose-li:text-slate-600 prose-li:font-medium
                prose-hr:border-slate-200"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
                {streaming && (
                  <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
                )}
              </div>
            </div>
          )}

          {/* Review notes */}
          {complete && effectiveStatus !== 'Approved' && (
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50">
              <label className="block text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">
                Review Notes
              </label>
              <textarea
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none font-medium"
                rows={3}
                placeholder="Add reviewer comments before approving..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
            </div>
          )}
          {complete && effectiveStatus === 'Approved' && reviewNotes && (
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1">Review Notes</p>
              <p className="text-sm text-slate-700 font-medium">{reviewNotes}</p>
            </div>
          )}
        </div>
      ) : !streaming ? (
        <div className="border border-dashed border-slate-300 bg-slate-50/50 rounded-xl px-6 py-16 text-center">
          <p className="text-slate-900 font-semibold text-sm mb-1">No draft generated yet.</p>
          <p className="text-slate-500 font-medium text-xs">
            Select a document type and click "Generate Draft".
          </p>
        </div>
      ) : null}

      {/* Confidence Analysis Panel */}
      {showConfidence && confidenceScores && confidenceScores.length > 0 && (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-slate-500">
              Section Confidence Analysis
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
              <span className="text-emerald-600">{confidenceScores.filter((s: ConfidenceScore) => s.confidence === 'HIGH').length} High</span>
              <span className="text-amber-600">{confidenceScores.filter((s: ConfidenceScore) => s.confidence === 'MEDIUM').length} Medium</span>
              <span className="text-red-600">{confidenceScores.filter((s: ConfidenceScore) => s.confidence === 'LOW').length} Low — Review Required</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {confidenceScores.map((score: ConfidenceScore, i: number) => (
              <div key={i} className={`flex items-start gap-4 px-5 py-4 ${score.confidence === 'LOW' ? 'bg-red-50/50' : score.confidence === 'MEDIUM' ? 'bg-amber-50/30' : ''}`}>
                <span className={`status-pill border text-[10px] font-mono tracking-wide shrink-0 mt-0.5 ${CONF_BADGE[score.confidence]}`}>
                  {score.confidence}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-slate-900 font-semibold">{score.section}</p>
                  <p className="text-[12px] text-slate-500 font-medium mt-1 leading-relaxed">{score.reason}</p>
                </div>
                {score.confidence === 'LOW' && (
                  <span className="text-[10px] font-mono font-bold text-red-600 shrink-0 border border-red-200 bg-red-100 px-2 py-0.5 rounded-md shadow-sm">
                    MANDATORY REVIEW
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
