import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, streamGapAnalysis } from '../api'
import type { Gap } from '../types'

const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'badge-critical',
  MAJOR: 'badge-major',
  MINOR: 'badge-minor',
}

const SEV_ROW: Record<string, string> = {
  CRITICAL: 'border-l-2 border-l-red-500',
  MAJOR: 'border-l-2 border-l-amber-500',
  MINOR: 'border-l-2 border-l-yellow-500',
}

function GapRow({ gap }: { gap: Gap }) {
  const [expanded, setExpanded] = useState(false)
  const cls = SEV_ROW[gap.severity] ?? ''

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-slate-50 ${cls}`}
        onClick={() => setExpanded(v => !v)}
      >
        <td>
          <span className={SEV_BADGE[gap.severity] ?? 'badge-minor'}>{gap.severity}</span>
        </td>
        <td className="font-mono text-[12px] text-slate-500">{gap.category}</td>
        <td className="text-slate-900 font-medium">{gap.description}</td>
        <td className="font-mono text-[11px] text-slate-500">{gap.source_ref}</td>
        <td>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </td>
      </tr>
      {expanded && (
        <tr className={cls}>
          <td colSpan={5} className="pb-4 pt-0">
            <div className="mx-3 bg-slate-50 border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">Regulatory Requirement</p>
                  <p className="text-[13px] text-slate-700 font-medium">{gap.requirement}</p>
                </div>
                <div className="flex gap-6">
                  {gap.responsible_function && (
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">Responsible Function</p>
                      <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm whitespace-nowrap">
                        {gap.responsible_function}
                      </span>
                    </div>
                  )}
                  {gap.target_date && (
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">Target Closure</p>
                      <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm whitespace-nowrap">
                        {gap.target_date}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">Recommended Action</p>
                <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <p className="text-[13px] text-slate-700 font-medium">{gap.recommended_action}</p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function GapAnalysis({ transferId }: { transferId: string }) {
  const queryClient = useQueryClient()
  const [streaming, setStreaming] = useState(false)
  const [streamMsg, setStreamMsg] = useState('')
  const [liveGaps, setLiveGaps] = useState<Gap[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'MAJOR' | 'MINOR'>('ALL')

  const { data: savedGaps } = useQuery({
    queryKey: ['gap-analysis', transferId],
    queryFn: () => api.getGapAnalysis(transferId),
  })

  const gaps = liveGaps ?? savedGaps ?? []
  const displayed = filter === 'ALL' ? gaps : gaps.filter(g => g.severity === filter)

  const counts = {
    CRITICAL: gaps.filter(g => g.severity === 'CRITICAL').length,
    MAJOR: gaps.filter(g => g.severity === 'MAJOR').length,
    MINOR: gaps.filter(g => g.severity === 'MINOR').length,
  }

  const runAnalysis = () => {
    setStreaming(true)
    setStreamMsg('Connecting to analysis engine...')
    setError(null)

    const cleanup = streamGapAnalysis(
      transferId,
      (data) => {
        if (data.status === 'running') {
          setStreamMsg(data.message ?? 'Analyzing...')
        } else if (data.status === 'complete' && data.gaps) {
          setLiveGaps(data.gaps)
          queryClient.invalidateQueries({ queryKey: ['gap-analysis', transferId] })
          queryClient.invalidateQueries({ queryKey: ['transfers'] })
          setStreaming(false)
          setStreamMsg('')
        } else if (data.status === 'error') {
          setError(data.message ?? 'Analysis failed')
          setStreaming(false)
        }
      },
      () => {
        setError('Connection failed. Is the backend running?')
        setStreaming(false)
      },
    )

    return cleanup
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="btn-primary"
            onClick={runAnalysis}
            disabled={streaming}
          >
            {streaming ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="17 8" strokeLinecap="round" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 7a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0zM7 4.5V7l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Run Gap Analysis
              </>
            )}
          </button>

          {streaming && (
            <span className="text-[11px] text-slate-500 font-mono font-medium animate-pulse">{streamMsg}</span>
          )}
        </div>

        {gaps.length > 0 && (
          <div className="flex items-center gap-2">
            {(['ALL', 'CRITICAL', 'MAJOR', 'MINOR'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border transition-all ${filter === s
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm'
                  }`}
              >
                {s === 'ALL' ? `ALL (${gaps.length})` : `${s} (${counts[s]})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 font-medium shadow-sm w-full">
          {error}
        </div>
      )}

      {/* Summary badges */}
      {gaps.length > 0 && (
        <div className="flex items-center gap-4 py-4 border-y border-slate-200">
          <span className="text-[11px] text-slate-500 font-mono font-bold mr-2 tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">FINDINGS:</span>
          <div className="flex items-center gap-2">
            <span className="badge-critical shadow-sm px-3">{counts.CRITICAL} Critical</span>
            <span className="badge-major shadow-sm px-3">{counts.MAJOR} Major</span>
            <span className="badge-minor shadow-sm px-3">{counts.MINOR} Minor</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium ml-auto">
            Click row to view details & recommendations
          </span>
        </div>
      )}

      {/* Gaps table */}
      {gaps.length > 0 ? (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }} className="pl-5">Severity</th>
                <th style={{ width: 160 }}>Category</th>
                <th>Description</th>
                <th style={{ width: 130 }}>Reference</th>
                <th style={{ width: 24 }} className="pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((gap, i) => (
                <GapRow key={i} gap={gap} />
              ))}
            </tbody>
          </table>
        </div>
      ) : !streaming ? (
        <div className="border border-dashed border-slate-300 bg-slate-50/50 rounded-xl px-6 py-16 text-center">
          <p className="text-slate-900 font-semibold text-sm mb-1">No gap analysis results yet.</p>
          <p className="text-slate-500 font-medium text-xs">
            Upload a transfer package PDF, then click "Run Gap Analysis" to begin.
          </p>
        </div>
      ) : null}
    </div>
  )
}
