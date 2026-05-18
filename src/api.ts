const BASE = 'http://192.168.9.9:3001'

export interface TripSummary {
  id: string
  title: string
  destination: string
  dateRange: string
  passengers: string
  styles: string[]
  createdAt: string
}

export interface TripRequirementsPayload {
  destination: string
  dateRange: string
  passengers: string
  budget: number
  styles: string[]
}

export interface BackendMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// Trips
export async function fetchTrips(): Promise<TripSummary[]> {
  const r = await fetch(`${BASE}/api/trips`)
  if (!r.ok) throw new Error('Failed to fetch trips')
  return r.json()
}

export async function createTrip(payload: TripRequirementsPayload): Promise<TripSummary> {
  const r = await fetch(`${BASE}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('Failed to create trip')
  return r.json()
}

export async function updateTripTitle(id: string, title: string): Promise<void> {
  await fetch(`${BASE}/api/trips/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

// Chat history
export async function fetchMessages(tripId: string): Promise<BackendMessage[]> {
  const r = await fetch(`${BASE}/api/chat/${tripId}`)
  if (!r.ok) throw new Error('Failed to fetch messages')
  return r.json()
}

// Stream AI response via SSE
export interface StreamCallbacks {
  onDelta: (delta: string) => void
  onDone: (messageId: string) => void
  onError: (msg: string) => void
}

export function streamMessage(tripId: string, content: string, cb: StreamCallbacks): AbortController {
  const ctrl = new AbortController()

  fetch(`${BASE}/api/chat/${tripId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      cb.onError('Request failed')
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let gotDone = false

    const processLines = () => {
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      let event = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (event === 'delta') cb.onDelta(data.delta)
            else if (event === 'done') { cb.onDone(data.messageId); gotDone = true }
            else if (event === 'error') { cb.onError(data.message); gotDone = true }
          } catch { /* ignore malformed */ }
          event = ''
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      // Always decode and process, even on the final chunk
      if (value) buf += decoder.decode(value, { stream: !done })
      processLines()
      if (done) break
    }

    // Flush any remaining buffer content after stream closes
    if (buf.trim()) processLines()

    // If the stream closed without a done/error event, surface a recoverable error
    if (!gotDone) cb.onError('连接中断，请重试')
  }).catch((err) => {
    if (err.name !== 'AbortError') cb.onError(String(err))
  })

  return ctrl
}
