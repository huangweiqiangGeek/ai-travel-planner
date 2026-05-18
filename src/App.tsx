import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ChatWorkspace from './components/ChatWorkspace'
import ItineraryPanel from './components/ItineraryPanel'
import NewTripModal, { type TripRequirements } from './components/NewTripModal'
import type { ChatMessage, ItineraryDay, Trip, User } from './types'
import {
  fetchTrips,
  createTrip,
  updateTripTitle,
  fetchMessages,
  streamMessage,
  type TripSummary,
} from './api'
import { parseItinerary } from './utils/parseItinerary'

/** Infer a human-friendly trip title from the first user message + itinerary */
function inferTripTitle(messages: ChatMessage[], days: number): string | null {
  const firstUser = messages.find(m => m.role === 'user')?.content ?? ''
  // Extract destination: patterns like "去/到/前往 X", "X旅游/旅行"
  const m =
    firstUser.match(
      /(?:去|到|前往)\s*([^\s，,。！!?？、\d]{2,8})(?:旅游|旅行|游玩|玩|看看)?/,
    ) ??
    firstUser.match(
      /([^\s，,。！!?？、我想规划行程\d]{2,6})(?:旅游|旅行|行程|游|的行程)/,
    ) ??
    firstUser.match(/我想去([^\s，,。！!?？、]{2,8})/)
  const dest = m?.[1]?.replace(/[的地]$/, '')
  if (dest && days > 0) return `${dest} · ${days}天`
  if (dest) return dest
  if (days > 0) return `${days}天行程`
  return null
}

/** Merge new parsed days into existing itinerary by day number (upsert) */
function mergeItinerary(
  existing: ItineraryDay[],
  updates: ItineraryDay[],
): ItineraryDay[] {
  if (updates.length === 0) return existing
  const map = new Map(existing.map(d => [d.day, d]))
  for (const u of updates) map.set(u.day, u)
  return Array.from(map.values()).sort((a, b) => a.day - b.day)
}

const DEFAULT_USER: User = {
  name: 'Alex Explorer',
  tier: 'Pro Voyager',
  avatar: '',
}

let localMsgId = 0
const nextId = () => `local-${++localMsgId}`

function summaryToTrip(s: TripSummary): Trip {
  return { id: s.id, title: s.title || s.destination || '新建旅行' }
}

function backendToLocal(
  msgs: { id: string; role: 'user' | 'assistant'; content: string }[],
): ChatMessage[] {
  return msgs.map(m => ({
    id: m.id,
    role: m.role === 'assistant' ? ('ai' as const) : ('user' as const),
    content: m.content,
  }))
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [activeTrip, setActiveTrip] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [liveItinerary, setLiveItinerary] = useState<ItineraryDay[]>([])
  const [showModal, setShowModal] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [streamingDay, setStreamingDay] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipNextFetchRef = useRef(false)

  useEffect(() => {
    fetchTrips()
      .then(list => {
        const mapped = list.map(summaryToTrip)
        setTrips(mapped)
        if (mapped.length > 0) setActiveTrip(mapped[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeTrip) {
      setMessages([])
      setLiveItinerary([])
      return
    }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }
    fetchMessages(activeTrip)
      .then(msgs => {
        const local = backendToLocal(msgs)
        setMessages(local)
        // Restore itinerary by merging all AI messages in order
        let itinerary: ItineraryDay[] = []
        for (const msg of local.filter(m => m.role === 'ai')) {
          const parsed = parseItinerary(msg.content)
          if (parsed.length > 0) itinerary = mergeItinerary(itinerary, parsed)
        }
        if (itinerary.length > 0) setLiveItinerary(itinerary)
      })
      .catch(() => {
        setMessages([])
        setLiveItinerary([])
      })
  }, [activeTrip])

  const handleSend = (text: string, tripId?: string) => {
    const currentTripId = tripId ?? activeTrip
    if (!currentTripId || streaming) return
    if (currentTripId.startsWith('local-')) {
      alert('无法发送消息：此旅行未同步到后端，请新建旅行。')
      return
    }

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const thinkingId = nextId()
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: 'thinking',
      content: 'AI 正在规划中...',
    }
    setMessages(prev => [...prev, userMsg, thinkingMsg])
    setStreaming(true)

    // Update thinking message every 5s so user knows we're still waiting (reasoning models are slow)
    let waitSecs = 0
    const waitInterval = setInterval(() => {
      waitSecs += 5
      setMessages(prev =>
        prev.map(m =>
          m.id === thinkingId
            ? { ...m, content: `AI 正在规划中... (已等待 ${waitSecs}s)` }
            : m,
        ),
      )
    }, 5_000)

    let accumulated = '' // full text received from AI
    let displayed = '' // text currently shown in UI
    let typeQueue = '' // characters waiting to be typed out
    let typingTimer: ReturnType<typeof setInterval> | null = null
    let streamDone = false
    let doneRealId = ''
    let lastParseLen = 0
    const streamingId = nextId()

    const updateDisplayMsg = (snap: string) => {
      setMessages(prev => {
        const withoutThinking = prev.filter(m => m.id !== thinkingId)
        const existing = withoutThinking.find(m => m.id === streamingId)
        if (existing) {
          return withoutThinking.map(m =>
            m.id === streamingId ? { ...m, content: snap } : m,
          )
        }
        return [
          ...withoutThinking,
          { id: streamingId, role: 'ai' as const, content: snap },
        ]
      })
    }

    const finalizeDone = (realId: string) => {
      if (typingTimer) {
        clearInterval(typingTimer)
        typingTimer = null
      }
      clearInterval(waitInterval)
      clearTimeout(timeoutId)
      // Flush any remaining queued chars instantly
      if (typeQueue) {
        displayed += typeQueue
        typeQueue = ''
      }
      setMessages(prev =>
        prev.map(m => (m.id === streamingId ? { ...m, id: realId } : m)),
      )
      const parsed = parseItinerary(accumulated)
      if (parsed.length > 0)
        setLiveItinerary(prev => mergeItinerary(prev, parsed))
      setStreaming(false)
      setStreamingDay(null)
      if (currentTripId) {
        setTrips(prev => {
          const current = prev.find(t => t.id === currentTripId)
          if (!current || current.title !== '新建旅行') return prev
          const newTitle = inferTripTitle(
            [{ id: 'u', role: 'user' as const, content: text }],
            parsed.length,
          )
          if (!newTitle) return prev
          updateTripTitle(currentTripId, newTitle).catch(() => {})
          return prev.map(t =>
            t.id === currentTripId ? { ...t, title: newTitle } : t,
          )
        })
      }
    }

    // Typewriter tick: drain one character (or a few if lagging) from the queue
    const typingTick = () => {
      if (!typeQueue) {
        if (streamDone) finalizeDone(doneRealId)
        return
      }
      // Adaptive speed: take more chars at once if the queue is growing large
      const take = typeQueue.length > 200 ? 4 : typeQueue.length > 60 ? 2 : 1
      displayed += typeQueue.slice(0, take)
      typeQueue = typeQueue.slice(take)
      updateDisplayMsg(displayed)

      // Parse itinerary from DISPLAYED text (not accumulated) so day cards
      // appear one by one as the typewriter "types" them, not all at once.
      if (displayed.length - lastParseLen >= 100) {
        lastParseLen = displayed.length
        const parsed = parseItinerary(displayed)
        if (parsed.length > 0) {
          setLiveItinerary(prev => mergeItinerary(prev, parsed))
          setStreamingDay(parsed[parsed.length - 1].day)
        }
      }
    }

    // Timeout: abort if no first response within 100s, or no new data for 20s mid-stream
    let timeoutId = setTimeout(() => {
      clearInterval(waitInterval)
      if (typingTimer) {
        clearInterval(typingTimer)
        typingTimer = null
      }
      abortRef.current?.abort()
      setMessages(prev => [
        ...prev.filter(m => m.id !== thinkingId && m.id !== streamingId),
        { id: nextId(), role: 'ai' as const, content: '⏱️ 请求超时，请重试。' },
      ])
      setStreaming(false)
      setStreamingDay(null)
    }, 180_000) // gpt-5.5 reasoning model can take 2+ min before first token

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (typingTimer) {
          clearInterval(typingTimer)
          typingTimer = null
        }
        abortRef.current?.abort()
        setMessages(prev => [
          ...prev.filter(m => m.id !== thinkingId && m.id !== streamingId),
          {
            id: nextId(),
            role: 'ai' as const,
            content: '⏱️ 请求超时，请重试。',
          },
        ])
        setStreaming(false)
        setStreamingDay(null)
      }, 90_000) // reasoning models can pause 60-90s between output bursts
    }

    abortRef.current = streamMessage(currentTripId, text, {
      onDelta: delta => {
        clearInterval(waitInterval) // first chunk arrived — stop the wait counter
        resetTimeout()
        accumulated += delta
        typeQueue += delta
        // Start the typewriter if not already running
        if (!typingTimer) {
          typingTimer = setInterval(typingTick, 18) // ~55 chars/sec display speed
        }
      },
      onDone: realId => {
        doneRealId = realId
        streamDone = true
        // Let the typewriter drain naturally; finalizeDone() called from typingTick
        // If queue is already empty, finalize immediately
        if (!typeQueue && typingTimer) finalizeDone(realId)
      },
      onError: msg => {
        clearInterval(waitInterval)
        clearTimeout(timeoutId)
        if (typingTimer) {
          clearInterval(typingTimer)
          typingTimer = null
        }
        setMessages(prev => [
          ...prev.filter(m => m.id !== thinkingId && m.id !== streamingId),
          { id: nextId(), role: 'ai' as const, content: `❌ 出错了：${msg}` },
        ])
        setStreaming(false)
        setStreamingDay(null)
      },
    })
  }

  const handleNewTrip = () => setShowModal(true)

  const handleModalStart = async (req: TripRequirements) => {
    setShowModal(false)
    try {
      const newTrip = await createTrip({
        destination: req.destination,
        dateRange: req.dateRange,
        passengers: req.passengers,
        budget: req.budget,
        styles: req.styles,
      })
      const trip = summaryToTrip(newTrip)
      setTrips(prev => [trip, ...prev])
      skipNextFetchRef.current = true
      setActiveTrip(trip.id)
      setMessages([])
      setLiveItinerary([])

      const parts = [
        req.destination ? `我想去${req.destination}旅游` : '我想规划一次旅行',
        req.dateRange ? `时间：${req.dateRange}` : '',
        `${req.passengers}人同行`,
        req.budget ? `预算约￥${req.budget.toLocaleString()}` : '',
        req.styles.length ? `风格偏好：${req.styles.join('、')}` : '',
        '请帮我规划详细行程。',
      ].filter(Boolean)

      handleSend(parts.join('，'), trip.id)
    } catch {
      alert('创建旅行失败，请确认后端已启动')
    }
  }

  const handleModalSkip = async () => {
    setShowModal(false)
    try {
      const newTrip = await createTrip({
        destination: '新建旅行',
        dateRange: '',
        passengers: '1',
        budget: 0,
        styles: [],
      })
      setTrips(prev => [{ id: newTrip.id, title: newTrip.title }, ...prev])
      setActiveTrip(newTrip.id)
      setMessages([])
      setLiveItinerary([])
    } catch {
      // Backend unavailable — fall back to local-only trip
      const id = `local-${Date.now()}`
      setTrips(prev => [{ id, title: '新建旅行' }, ...prev])
      setActiveTrip(id)
      setMessages([])
    }
  }

  const handleSelectTrip = (id: string) => {
    abortRef.current?.abort()
    setStreaming(false)
    setLiveItinerary([])
    setActiveTrip(id)
  }

  const activeTitle =
    trips.find(t => t.id === activeTrip)?.title ?? 'Travel Planner AI'

  return (
    <div className='h-screen w-screen overflow-hidden flex bg-[#0D1B2A] text-[#dde3ea]'>
      {showModal && (
        <NewTripModal onStart={handleModalStart} onSkip={handleModalSkip} />
      )}

      <Sidebar
        trips={trips}
        activeTrip={activeTrip ?? ''}
        onSelectTrip={handleSelectTrip}
        onNewTrip={handleNewTrip}
        user={DEFAULT_USER}
      />

      <main className='ml-[280px] flex-1 flex h-full'>
        <ChatWorkspace
          title={activeTitle}
          messages={messages}
          onSend={handleSend}
          disabled={streaming || !activeTrip}
        />
        <ItineraryPanel
          days={liveItinerary}
          location={
            trips.find(t => t.id === activeTrip)?.title ?? 'Travel Planner AI'
          }
          activeDayIndex={
            liveItinerary.length > 0 ? liveItinerary.length - 1 : 0
          }
          totalDays={liveItinerary.length || 0}
          streaming={streaming}
          streamingDay={streamingDay}
        />
      </main>
    </div>
  )
}
