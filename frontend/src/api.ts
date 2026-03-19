import axios from 'axios'
import type { Transfer, CreateTransferRequest, Gap, Task, DraftDocument, AuditEvent, ConfidenceScore, HistoricalComparator } from './types'

const http = axios.create({ baseURL: '/api' })

export const api = {
  listTransfers: () => http.get<Transfer[]>('/transfers').then(r => r.data),

  createTransfer: (req: CreateTransferRequest) =>
    http.post<Transfer>('/transfers', req).then(r => r.data),

  getTransfer: (id: string) =>
    http.get<Transfer>(`/transfers/${id}`).then(r => r.data),

  uploadFile: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<{ message: string; pages: number }>(`/transfers/${id}/upload`, form).then(r => r.data)
  },

  getGapAnalysis: (id: string) =>
    http.get<Gap[]>(`/transfers/${id}/gap-analysis`).then(r => r.data),

  getPlan: (id: string) =>
    http.get<Task[]>(`/transfers/${id}/plan`).then(r => r.data),

  getDraft: (id: string, docType: string) =>
    http.get<DraftDocument>(`/transfers/${id}/draft/${docType}`).then(r => r.data),

  approveDraft: (id: string, docType: string) =>
    http.post<{ status: string }>(`/transfers/${id}/draft/${docType}/approve`).then(r => r.data),

  getDraftConfidence: (id: string, docType: string) =>
    http.get<ConfidenceScore[]>(`/transfers/${id}/draft/${docType}/confidence`).then(r => r.data),

  updateDraft: (id: string, docType: string, content: string) =>
    http.put<{ status: string }>(`/transfers/${id}/draft/${docType}`, { content }).then(r => r.data),

  getSimilarTransfers: (id: string) =>
    http.get<HistoricalComparator[]>(`/transfers/${id}/similar`).then(r => r.data),

  getAuditLog: (id: string) =>
    http.get<AuditEvent[]>(`/transfers/${id}/audit-log`).then(r => r.data),
}

/** Opens an SSE connection for gap analysis. Returns a cleanup function. */
export function streamGapAnalysis(
  transferId: string,
  onEvent: (data: { status: string; gaps?: Gap[]; message?: string }) => void,
  onError: (err: Event) => void,
): () => void {
  const es = new EventSource(`/api/transfers/${transferId}/gap-analysis`, {
    withCredentials: false,
  })

  // POST first to trigger analysis — EventSource only does GET so we use fetch for POST
  // then listen on a separate EventSource after the POST starts the stream.
  // Actually the backend POST endpoint returns SSE, so we use fetch with ReadableStream.
  es.close()

  // Use fetch + ReadableStream for POST-based SSE
  const controller = new AbortController()

  fetch(`/api/transfers/${transferId}/gap-analysis`, {
    method: 'POST',
    signal: controller.signal,
  }).then(async res => {
    if (!res.ok) {
      onError(new Event('error'))
      return
    }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim()
          if (raw) {
            try {
              onEvent(JSON.parse(raw))
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') onError(new Event('error'))
  })

  return () => controller.abort()
}

/** Opens a POST SSE stream for document drafting. Returns a cleanup function. */
export function streamDraft(
  transferId: string,
  docType: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (err: unknown) => void,
): () => void {
  const controller = new AbortController()

  fetch(`/api/transfers/${transferId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_type: docType }),
    signal: controller.signal,
  }).then(async res => {
    if (!res.ok) {
      onError(new Error(`HTTP ${res.status}`))
      return
    }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim()
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              if (parsed.chunk) onChunk(parsed.chunk)
              if (parsed.status === 'complete') onComplete()
            } catch {
              // ignore
            }
          }
        }
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') onError(err)
  })

  return () => controller.abort()
}
