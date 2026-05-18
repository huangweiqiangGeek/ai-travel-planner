import type { FastifyInstance } from 'fastify'
import { v4 as uuid } from 'uuid'
import { store } from '../services/store.ts'
import { streamChat } from '../services/ai.ts'

export async function chatRoutes(app: FastifyInstance) {
  // GET /api/chat/:tripId — fetch message history
  app.get<{ Params: { tripId: string } }>('/api/chat/:tripId', async (req, reply) => {
    const trip = store.getTrip(req.params.tripId)
    if (!trip) return reply.code(404).send({ error: 'Trip not found' })
    return store.getMessages(req.params.tripId)
  })

  // POST /api/chat/:tripId/stream — send message, stream AI reply via SSE
  app.post<{
    Params: { tripId: string }
    Body: { content: string }
  }>('/api/chat/:tripId/stream', async (req, reply) => {
    const { tripId } = req.params
    const { content } = req.body ?? {}

    if (!content?.trim()) {
      return reply.code(400).send({ error: 'content is required' })
    }

    const trip = store.getTrip(tripId)
    if (!trip) return reply.code(404).send({ error: 'Trip not found' })

    // Persist user message
    const userMsg = { id: uuid(), role: 'user' as const, content, createdAt: new Date().toISOString() }
    store.appendMessage(tripId, userMsg)

    console.log('[stream] starting SSE for trip', tripId)

    // Set SSE headers and flush immediately so the client gets headers right away
    const res = reply.raw
    // Manually set CORS — @fastify/cors doesn't apply when we flush raw headers directly
    const origin = req.headers.origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.statusCode = 200
    res.flushHeaders()

    // Disable Nagle buffering so each write is sent immediately
    ;(req.raw.socket as import('net').Socket)?.setNoDelay(true)

    const send = (event: string, data: unknown) => {
      if (res.writableEnded) return
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      res.write(payload)
    }

    // Abort the AI call if the client disconnects early (browser cancel / timeout)
    const clientAbort = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) {
        console.log('[stream] client disconnected — aborting AI call')
        clientAbort.abort()
      }
    })

    // SSE keepalive: send a comment line every 15s to prevent proxy / browser timeouts
    // gpt-5.5 is a reasoning model that can take 60-120s before the first token
    const keepalive = setInterval(() => {
      if (!res.writableEnded) res.write(': keepalive\n\n')
    }, 15_000)

    // Build message history for AI context.
    // AI replies are often 2000-4000 chars (full itineraries). Sending them all verbatim
    // causes the context to grow unbounded, leading to API timeouts / context-length errors.
    // Strategy:
    //   - Keep at most MAX_HISTORY messages total
    //   - The most recent RECENT_FULL messages are kept verbatim (immediate context)
    //   - Older assistant messages are truncated to OLD_AI_MAX_CHARS so the model still
    //     knows what was discussed without burning tokens on full itinerary text
    const MAX_HISTORY = 12
    const RECENT_FULL = 6         // last N messages kept verbatim
    const OLD_AI_MAX_CHARS = 500  // older AI messages truncated to this length

    const allMessages = store.getMessages(tripId)
    const rawHistory = allMessages.slice(-MAX_HISTORY)

    const history = rawHistory.map((msg, idx) => {
      const isRecent = idx >= rawHistory.length - RECENT_FULL
      if (!isRecent && msg.role === 'assistant' && msg.content.length > OLD_AI_MAX_CHARS) {
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content.slice(0, OLD_AI_MAX_CHARS) + '\n…[早期行程内容已省略]',
        }
      }
      return { role: msg.role as 'user' | 'assistant', content: msg.content }
    })

    // Build trip context string — injected into the system prompt so the AI
    // never forgets established destination/details across conversation turns.
    const contextLines: string[] = []
    if (trip.destination && trip.destination !== '新建旅行') {
      contextLines.push(`目的地：${trip.destination}`)
    }
    if (trip.dateRange) contextLines.push(`出行时间：${trip.dateRange}`)
    if (trip.passengers) contextLines.push(`同行人员：${trip.passengers}`)
    if (trip.budget > 0) contextLines.push(`总预算：¥${trip.budget.toLocaleString()}`)
    if (trip.styles?.length) contextLines.push(`偏好风格：${trip.styles.join('、')}`)
    const tripContext = contextLines.length > 0 ? contextLines.join('\n') : undefined

    console.log('[stream] calling streamChat, history length:', history.length)

    try {
      await streamChat(
        history,
        (delta) => send('delta', { delta }),
        (fullText) => {
          clearInterval(keepalive)
          const aiMsg = { id: uuid(), role: 'assistant' as const, content: fullText, createdAt: new Date().toISOString() }
          store.appendMessage(tripId, aiMsg)
          send('done', { messageId: aiMsg.id })
          res.end()
        },
        (err) => {
          clearInterval(keepalive)
          console.error('[stream] AI error:', err)
          send('error', { message: err.message })
          res.end()
        },
        tripContext,
        clientAbort.signal,
      )
    } catch (err) {
      clearInterval(keepalive)
      console.error('[stream] unexpected error:', err)
      if (!res.writableEnded) res.end()
    }
  })
}
