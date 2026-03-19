import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Task } from '../types'

const STATUS_COLORS: Record<string, string> = {
  'Not Started': 'bg-slate-50 text-slate-500 border-slate-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Complete': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Blocked': 'bg-red-50 text-red-700 border-red-200',
  'Under Review': 'bg-violet-50 text-violet-700 border-violet-200',
  'Overdue': 'bg-orange-50 text-orange-700 border-orange-200',
}

const RISK_ROW: Record<string, string> = {
  'Blocked': 'bg-red-50/50',
  'Overdue': 'bg-orange-50/50',
}

function TaskStatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-50 text-slate-500 border-slate-200'
  return (
    <span className={`status-pill border text-[10px] font-mono tracking-wide ${cls}`}>{status}</span>
  )
}

export default function TransferPlan({ transferId }: { transferId: string }) {
  const queryClient = useQueryClient()
  const [funcFilter, setFuncFilter] = useState<string>('ALL')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['plan', transferId],
    queryFn: () => api.getPlan(transferId),
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      setGenerating(true)
      setError(null)
      return fetch(`/api/transfers/${transferId}/plan`, { method: 'POST' }).then(async r => {
        if (!r.ok) {
          const text = await r.text()
          throw new Error(text)
        }
        return r.json()
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', transferId] })
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      setGenerating(false)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to generate plan. Run gap analysis first.')
      setGenerating(false)
    },
  })

  const functions = ['ALL', ...Array.from(new Set(tasks.map((t: Task) => t.function)))]
  const displayed = funcFilter === 'ALL' ? tasks : tasks.filter((t: Task) => t.function === funcFilter)
  const riskTasks = tasks.filter((t: Task) => t.status === 'Blocked' || t.status === 'Overdue')

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          className="btn-primary"
          onClick={() => generateMutation.mutate()}
          disabled={generating || generateMutation.isPending}
        >
          {generating || generateMutation.isPending ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="17 8" strokeLinecap="round" />
              </svg>
              Generating Plan...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7h4M5 5h4M5 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {tasks.length > 0 ? 'Regenerate Plan' : 'Generate Transfer Plan'}
            </>
          )}
        </button>

        {tasks.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500 font-medium">{tasks.length} tasks generated</span>
            <button
              className="btn-ghost text-[11px]"
              onClick={() => {
                const headers = ['#', 'Task', 'Function', 'Predecessor', 'Day', 'Deliverable', 'Status']
                const rows = tasks.map((t: Task, i: number) => [
                  i + 1,
                  `"${t.task_name.replace(/"/g, '""')}"`,
                  `"${t.function.replace(/"/g, '""')}"`,
                  t.predecessor ?? '',
                  `+${t.due_offset_days}d`,
                  `"${t.deliverable.replace(/"/g, '""')}"`,
                  t.status,
                ])
                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `transfer-plan-${transferId}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v7M3 7l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 font-medium shadow-sm w-full">
          {error}
        </div>
      )}

      {/* Risk banner */}
      {riskTasks.length > 0 && (
        <div className="border border-orange-200 shadow-sm bg-orange-50 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-orange-600 shrink-0 mt-0.5">
            <path d="M8 2L14.5 13H1.5L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm text-orange-800 font-bold">Timeline Risk Detected</p>
            <p className="text-xs text-orange-700 mt-0.5 font-medium">
              {riskTasks.filter(t => t.status === 'Overdue').length > 0 && (
                <span>{riskTasks.filter(t => t.status === 'Overdue').length} overdue task(s). </span>
              )}
              {riskTasks.filter(t => t.status === 'Blocked').length > 0 && (
                <span>{riskTasks.filter(t => t.status === 'Blocked').length} blocked task(s) with unresolved dependencies.</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Function filter */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mr-1">Filter by Function:</span>
          {functions.map(fn => (
            <button
              key={fn}
              onClick={() => setFuncFilter(fn)}
              className={`text-[11px] font-mono font-bold px-3 py-1 rounded-lg border transition-all ${funcFilter === fn
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm'
                }`}
            >
              {fn}
            </button>
          ))}
        </div>
      )}

      {/* Tasks table */}
      {isLoading ? (
        <div className="text-sm font-medium text-slate-500 py-8 text-center">Loading plan...</div>
      ) : tasks.length > 0 ? (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-6">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-5 w-10">#</th>
                <th className="w-[30%]">Task</th>
                <th className="w-32">Function</th>
                <th className="w-28">Predecessor</th>
                <th className="w-20">Day</th>
                <th>Deliverable</th>
                <th className="pr-5 w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((task: Task, i: number) => (
                <tr key={i} className={RISK_ROW[task.status] ?? 'hover:bg-slate-50'}>
                  <td className="font-mono text-[11px] text-slate-400 font-medium pl-5">
                    {(task.status === 'Blocked' || task.status === 'Overdue') ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-orange-500 mx-auto">
                        <path d="M7 2L12 11H2L7 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M7 5.5v2.5M7 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    ) : (i + 1)}
                  </td>
                  <td className="font-semibold text-slate-900">{task.task_name}</td>
                  <td>
                    <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      {task.function}
                    </span>
                  </td>
                  <td className="font-mono text-[11px] font-medium text-slate-500">
                    {task.predecessor ?? '—'}
                  </td>
                  <td className="font-mono text-[12px] font-bold text-slate-700">
                    +{task.due_offset_days}d
                  </td>
                  <td className="text-slate-600 font-medium text-[12px]">{task.deliverable}</td>
                  <td className="pr-5"><TaskStatusBadge status={task.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !isLoading && !generating ? (
        <div className="border border-dashed border-slate-300 bg-slate-50/50 rounded-xl px-6 py-16 text-center">
          <p className="text-slate-900 font-semibold text-sm mb-1">No transfer plan generated yet.</p>
          <p className="text-slate-500 font-medium text-xs">
            Complete gap analysis first, then generate the plan.
          </p>
        </div>
      ) : null}
    </div>
  )
}
