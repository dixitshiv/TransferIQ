import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Transfer, CreateTransferRequest } from '../types'

const STATUS_COLORS: Record<string, string> = {
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Gaps Identified': 'bg-red-50 text-red-700 border-red-200',
  'Plan Ready': 'bg-amber-50 text-amber-700 border-amber-200',
  'Draft Complete': 'bg-green-50 text-green-700 border-green-200',
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`status-pill border text-[11px] font-mono tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="stat-card">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-2">{label}</p>
      <p className="text-3xl font-light font-mono text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

const EMPTY_FORM: CreateTransferRequest = {
  name: '',
  product: '',
  sending_org: '',
  receiving_org: '',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateTransferRequest>(EMPTY_FORM)

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: api.listTransfers,
    refetchInterval: 10_000,
  })

  const createMutation = useMutation({
    mutationFn: api.createTransfer,
    onSuccess: async (transfer) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      setShowForm(false)
      setForm(EMPTY_FORM)
      navigate(`/transfers/${transfer.id}`)
    },
  })

  const stats = {
    active: transfers.length,
    gaps: transfers.filter(t => t.status === 'Gaps Identified').length,
    planReady: transfers.filter(t => t.status === 'Plan Ready').length,
    drafts: transfers.filter(t => t.status === 'Draft Complete').length,
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.product || !form.sending_org || !form.receiving_org) return
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Technology Transfer Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            AI-assisted gap analysis and transfer planning for pharmaceutical CDMOs
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowForm(v => !v)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Transfer
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Transfers" value={stats.active} sub="total projects" />
        <StatCard label="Open Gaps" value={stats.gaps} sub="pending review" />
        <StatCard label="Plans Ready" value={stats.planReady} sub="awaiting execution" />
        <StatCard label="Drafts Complete" value={stats.drafts} sub="ready for review" />
      </div>

      {/* New Transfer Form */}
      {showForm && (
        <div className="border border-slate-200 shadow-sm bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"></span>
            New Technology Transfer
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5">
                  Transfer Name
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Metformin HCl 500mg — Site Transfer"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5">
                  Product
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Metformin HCl Tablets 500mg"
                  value={form.product}
                  onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5">
                  Sending Organization
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. InnoPharm Inc."
                  value={form.sending_org}
                  onChange={e => setForm(f => ({ ...f, sending_org: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5">
                  Receiving Organization
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. BioMed CDMO"
                  value={form.receiving_org}
                  onChange={e => setForm(f => ({ ...f, receiving_org: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              >
                Cancel
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-red-500 font-medium">
                Failed to create transfer. Is the backend running?
              </p>
            )}
          </form>
        </div>
      )}

      {/* Transfers table */}
      <div className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
            Active Transfers
          </h2>
          <span className="text-[11px] font-mono text-slate-500 font-medium">{transfers.length} records</span>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
            Loading transfers...
          </div>
        ) : transfers.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
            No transfers found. Create one to get started.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-5">Transfer Name</th>
                <th>Product</th>
                <th>Sending Org</th>
                <th>Receiving Org</th>
                <th>Status</th>
                <th>Package</th>
                <th className="pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t: Transfer) => (
                <tr
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/transfers/${t.id}`)}
                >
                  <td className="font-semibold text-slate-900 pl-5">{t.name}</td>
                  <td className="font-mono text-[12px] text-slate-500">{t.product}</td>
                  <td className="text-slate-600 font-medium">{t.sending_org}</td>
                  <td className="text-slate-600 font-medium">{t.receiving_org}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td>
                    {t.has_demo_data ? (
                      <span className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">LOADED</span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400 font-bold">—</span>
                    )}
                  </td>
                  <td className="pr-5 text-right">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400 inline-block">
                      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Backend status indicator */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shadow-sm min-w-[6px]"></span>
        Backend connected · localhost:8000
      </div>
    </div>
  )
}
