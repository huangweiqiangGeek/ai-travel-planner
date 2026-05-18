import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import ChatWorkspace from './ChatWorkspace'
import ItineraryPanel from './ItineraryPanel'
import type { ChatMessage, ItineraryDay, Trip } from '../types'
import { fetchMessages, streamMessage, updateTripTitle } from '../api'
import { parseItinerary } from '../utils/parseItinerary'

/** Infer a human-friendly trip title from the first user message + itinerary */
function inferTripTitle(messages: ChatMessage[], days: number): string | null {
  const firstUser = messages.find(m => m.role === 'user')?.content ?? ''
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

function backendToLocal(
  msgs: { id: string; role: 'user' | 'assistant'; content: string }[],
): ChatMessage[] {
  return msgs.map(m => ({
    id: m.id,
    role: m.role === 'assistant' ? ('ai' as const) : ('user' as const),
    content: m.content,
  }))
}

let localMsgId = 0
const nextId = () => `local-${++localMsgId}`

interface TripWorkspaceProps {
  trips: Trip[]
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>
}

export default function TripWorkspace({ trips, setTrips }: TripWorkspaceProps) {
  const { id: tripId } = useParams<{ id: string }>()
  const location = useLocation()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [liveItinerary, setLiveItinerary] = useState<ItineraryDay[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingDay, setStreamingDay] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Store autoMessage from navigation state to send on mount
  const autoMessageRef = useRef<string | null>(
    (location.state as { autoMessage?: string } | null)?.autoMessage ?? null,
  )

  // When trip ID changes: abort ongoing stream, reset state, load messages
  useEffect(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setStreamingDay(null)
    setMessages([])
    setLiveItinerary([])

    if (!tripId) return

    // New trips navigated to with autoMessage skip the fetch (inbox is empty)
    const autoMsg = autoMessageRef.current
    if (autoMsg) return

    if (tripId.startsWith('local-')) return

    fetchMessages(tripId)
      .then(msgs => {
        const local = backendToLocal(msgs)
        setMessages(local)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  // Send the auto-message once on mount for newly created trips.
  // NOTE: do NOT clear autoMessageRef before starting the timer — React StrictMode
  // cancels the timer in its simulated-unmount cleanup, then re-runs the effect.
  // If the ref is already null at that point the message is never sent.
  // Clearing inside the callback means the ref is still set for the remount.
  useEffect(() => {
    const autoMsg = autoMessageRef.current
    if (autoMsg && tripId && !tripId.startsWith('local-')) {
      const t = setTimeout(() => {
        autoMessageRef.current = null
        // Clear the navigation state from browser history so a page refresh
        // does not re-trigger the auto-send (window.history.state persists across refreshes).
        // React Router stores user state under the `usr` key.
        try {
          const hs = window.history.state as Record<string, unknown> | null
          if (hs) window.history.replaceState({ ...hs, usr: null }, '')
        } catch {
          /* ignore in environments without history API */
        }
        handleSend(autoMsg)
      }, 0)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  const handleSend = (text: string) => {
    if (!tripId || streaming) return
    if (tripId.startsWith('local-')) {
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

    let accumulated = ''
    let displayed = ''
    let typeQueue = ''
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
      if (tripId) {
        setTrips(prev => {
          const current = prev.find(t => t.id === tripId)
          if (!current || current.title !== '新建旅行') return prev
          const newTitle = inferTripTitle(
            [{ id: 'u', role: 'user' as const, content: text }],
            parsed.length,
          )
          if (!newTitle) return prev
          updateTripTitle(tripId, newTitle).catch(() => {})
          return prev.map(t =>
            t.id === tripId ? { ...t, title: newTitle } : t,
          )
        })
      }
    }

    const typingTick = () => {
      if (!typeQueue) {
        if (streamDone) finalizeDone(doneRealId)
        return
      }
      const take = typeQueue.length > 200 ? 4 : typeQueue.length > 60 ? 2 : 1
      displayed += typeQueue.slice(0, take)
      typeQueue = typeQueue.slice(take)
      updateDisplayMsg(displayed)

      if (displayed.length - lastParseLen >= 100) {
        lastParseLen = displayed.length
        const parsed = parseItinerary(displayed)
        if (parsed.length > 0) {
          setLiveItinerary(prev => mergeItinerary(prev, parsed))
          setStreamingDay(parsed[parsed.length - 1].day)
        }
      }
    }

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
    }, 180_000)

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
      }, 90_000)
    }

    abortRef.current = streamMessage(tripId, text, {
      onDelta: delta => {
        clearInterval(waitInterval)
        resetTimeout()
        accumulated += delta
        typeQueue += delta
        if (!typingTimer) {
          typingTimer = setInterval(typingTick, 18)
        }
      },
      onDone: realId => {
        doneRealId = realId
        streamDone = true
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

  const activeTitle =
    trips.find(t => t.id === tripId)?.title ?? 'Travel Planner AI'

  return (
    <>
      <ChatWorkspace
        title={activeTitle}
        messages={messages}
        onSend={handleSend}
        disabled={streaming || !tripId}
      />
      <ItineraryPanel
        days={liveItinerary}
        location={activeTitle}
        activeDayIndex={liveItinerary.length > 0 ? liveItinerary.length - 1 : 0}
        totalDays={liveItinerary.length || 0}
        streaming={streaming}
        streamingDay={streamingDay}
      />
    </>
  )
}
