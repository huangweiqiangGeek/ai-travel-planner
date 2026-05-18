import { useEffect, useRef, useState } from 'react'
import type { Activity, ItineraryDay } from '../types'

const MAX_PER_GROUP = 4

/** Group activities by their .group field, preserving insertion order */
function groupActivities(
  acts: Activity[],
): { label: string; items: Activity[] }[] {
  const map = new Map<string, Activity[]>()
  for (const a of acts) {
    const key = a.group ?? ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

function groupIcon(label: string): string {
  if (/上午|早上|早餐/.test(label)) return '🌅'
  if (/下午|午餐/.test(label)) return '☀️'
  if (/晚上|傍晚|夜间|晚餐/.test(label)) return '🌙'
  if (/住宿/.test(label)) return '🏨'
  if (/交通/.test(label)) return '🚌'
  if (/购物/.test(label)) return '🛍️'
  if (/娱乐|体验/.test(label)) return '🎯'
  return '📍'
}

function groupAccent(label: string): string {
  if (/上午|早上|早餐/.test(label)) return '#ffd580'
  if (/下午|午餐/.test(label)) return '#80cfff'
  if (/晚上|傍晚|夜间|晚餐/.test(label)) return '#c3a0ff'
  if (/住宿/.test(label)) return '#80ffb4'
  if (/交通/.test(label)) return '#ffb480'
  return '#90a0b0'
}

function ActivityGroup({
  label,
  items,
  isStreaming,
}: {
  label: string
  items: Activity[]
  isStreaming: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, MAX_PER_GROUP)
  const overflow = items.length - MAX_PER_GROUP
  const accent = label ? groupAccent(label) : '#90a0b0'

  return (
    <div className='mb-4 last:mb-1'>
      {/* Section header */}
      {label && (
        <div className='flex items-center gap-1.5 mb-2'>
          <span className='text-[13px] leading-none'>{groupIcon(label)}</span>
          <span
            className="text-[10px] font-['JetBrains_Mono'] font-bold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {label}
          </span>
          <div
            className='flex-1 h-px ml-1'
            style={{ background: `${accent}35` }}
          />
        </div>
      )}

      {/* Activity rows */}
      <div
        className='space-y-1.5 pl-3'
        style={{ borderLeft: `2px solid ${accent}30` }}
      >
        {visible.map(act => (
          <div key={act.id} className='flex items-start gap-2 py-0.5'>
            {act.time && (
              <span className="font-['JetBrains_Mono'] text-[9px] text-[#8899aa] bg-[#1a2d40] px-1.5 py-0.5 rounded shrink-0 mt-[2px]">
                {act.time}
              </span>
            )}
            <p className='text-[12.5px] text-[#cdd8e0] leading-snug line-clamp-2 flex-1'>
              {act.name}
            </p>
          </div>
        ))}

        {!isStreaming && overflow > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] font-['JetBrains_Mono'] transition-colors mt-0.5"
            style={{ color: `${accent}99` }}
            onMouseEnter={e => (e.currentTarget.style.color = accent)}
            onMouseLeave={e => (e.currentTarget.style.color = `${accent}99`)}
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  )
}

const MAP_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDcwST51iy7vVqoSXDP4kr8cLk242DKxnI0FGVHpl3tNkO_G7zoX7PCKFXhitxTFJT4fVfZZRr-S3PivaPS_wlyeooISGN2SMy0LurCSEt1PzZeL810BMV_rPKm-1hwuH6mtgZ97-JFVqgJlhRpPci3_iGN1IpvyvmYL5WbgTKH14Ixbx1sccwMqjg6wI0l_z-n9PjlaK9UQkrfuBQpAQ0dSyrtddwyUMHYpt0L1RK1i2NQDpTaYO84ZV6mxmqDwhJ3nVQhlaFr8DQ'

const EXPORT_ACTIONS = [
  { icon: 'picture_as_pdf', label: 'PDF' },
  { icon: 'map', label: 'Maps' },
  { icon: 'calendar_month', label: 'Apple' },
  { icon: 'description', label: 'Notion' },
]

interface ItineraryPanelProps {
  days: ItineraryDay[]
  location: string
  activeDayIndex: number
  totalDays: number
  streaming?: boolean
  streamingDay?: number | null
}

export default function ItineraryPanel({
  days,
  location,
  activeDayIndex,
  totalDays,
  streaming = false,
  streamingDay = null,
}: ItineraryPanelProps) {
  const activeDay = days[activeDayIndex]
  const lastDayRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the latest day card while streaming
  useEffect(() => {
    if (streaming && lastDayRef.current) {
      lastDayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [days.length, streaming])

  return (
    <aside className='w-[460px] flex flex-col bg-[#0D1B2A] z-10 shrink-0 border-l border-[#20344B]'>
      {/* Map header */}
      <div className='h-[220px] relative border-b border-[#20344B] shrink-0'>
        <div
          className='absolute inset-0 bg-cover bg-center opacity-70'
          style={{ backgroundImage: `url("${MAP_IMG}")` }}
        />
        <div className='absolute inset-0 bg-gradient-to-t from-[#0D1B2A] to-transparent' />

        {/* Location badge */}
        <div className='absolute top-4 left-4 bg-[#0A1420]/80 backdrop-blur-md px-4 py-2 rounded-lg border border-[#20344B] flex items-center gap-2'>
          <span className='material-symbols-outlined text-[16px] text-[#c3f5ff]'>
            location_on
          </span>
          <span className="font-['JetBrains_Mono'] text-xs text-[#c3f5ff]">
            {location}
          </span>
        </div>

        {/* Day indicator */}
        <div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center'>
          <div className='w-12 h-12 rounded-full border-2 border-[#00e5ff] bg-[#0D1B2A]/80 backdrop-blur flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.4)]'>
            <span className="font-['Sora'] text-xl font-bold text-[#c3f5ff]">
              D{activeDay?.day ?? (streaming ? '…' : '?')}
            </span>
          </div>
        </div>
      </div>

      {/* Panel header */}
      <div className='px-6 py-4 flex justify-between items-center border-b border-[#20344B] bg-[#162032] shrink-0'>
        <h2 className="font-['Sora'] text-xl font-bold text-[#dde3ea] flex items-center gap-2">
          Live Itinerary
          {streaming && (
            <span className='flex gap-0.5 items-center ml-1'>
              <span className='w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-bounce [animation-delay:0ms]' />
              <span className='w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-bounce [animation-delay:150ms]' />
              <span className='w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-bounce [animation-delay:300ms]' />
            </span>
          )}
        </h2>
        <span className="bg-[#1E3A5F] text-[#00e5ff] px-3 py-1 rounded-full font-['JetBrains_Mono'] text-[11px] border border-[#28435F]">
          {totalDays > 0 ? `${totalDays} Days` : '—'}
        </span>
      </div>

      {/* Day list */}
      <div className='flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0D1B2A]'>
        {days.length === 0 ? (
          /* Empty / waiting state */
          <div className='flex flex-col items-center justify-center h-full gap-4 text-center opacity-40'>
            <span className='material-symbols-outlined text-[48px] text-[#00e5ff]'>
              {streaming ? 'model_training' : 'map'}
            </span>
            <p className="font-['Sora'] text-[#bac9cc] text-sm">
              {streaming ? 'AI 正在规划行程…' : '开始对话后行程将在此实时生成'}
            </p>
          </div>
        ) : (
          <div className='relative before:absolute before:inset-0 before:h-full before:w-0.5 before:bg-[#20344B] before:left-4 before:-translate-x-1/2'>
            {days.map((day, idx) => {
              const isLast = idx === days.length - 1
              const isActive = idx === activeDayIndex
              // Highlight the day actively being streamed; fall back to last day
              const isStreaming =
                streaming &&
                (streamingDay != null ? day.day === streamingDay : isLast)

              return (
                <div
                  key={day.id}
                  ref={isLast ? lastDayRef : undefined}
                  className={`relative flex items-start group mb-8 transition-opacity duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {/* Circle */}
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#0D1B2A] absolute left-0 font-['JetBrains_Mono'] text-xs z-10 mt-1 transition-all ${
                      isStreaming
                        ? 'bg-[#00e5ff] text-[#00626e] shadow-[0_0_14px_rgba(0,229,255,0.6)] animate-pulse'
                        : isActive
                          ? 'bg-[#00e5ff] text-[#00626e] shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                          : 'bg-[#2f363b] text-[#dde3ea]'
                    }`}
                  >
                    {day.day}
                  </div>

                  {/* Card */}
                  <div className='w-full pl-10'>
                    <div
                      className={`bg-[#162032] p-4 rounded-xl border transition-all duration-300 ${
                        isStreaming
                          ? 'border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.15)]'
                          : isActive
                            ? 'border-[#00e5ff] shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
                            : 'border-[#20344B]'
                      }`}
                    >
                      <div className='flex justify-between items-start mb-4 pb-3 border-b border-[#20344B]'>
                        <div
                          className={`font-['Sora'] text-[15px] font-bold leading-snug pr-2 ${
                            isActive ? 'text-[#c3f5ff]' : 'text-[#dde3ea]'
                          }`}
                        >
                          {day.title}
                        </div>
                        {isStreaming ? (
                          <span className='material-symbols-outlined text-[18px] text-[#00e5ff] animate-spin shrink-0'>
                            progress_activity
                          </span>
                        ) : (
                          <span className='material-symbols-outlined text-[#bac9cc] cursor-grab hover:text-[#c3f5ff] transition-colors text-[20px] shrink-0'>
                            drag_indicator
                          </span>
                        )}
                      </div>

                      {day.activities && day.activities.length > 0 ? (
                        <div>
                          {groupActivities(day.activities).map((g, gi) => (
                            <ActivityGroup
                              key={gi}
                              label={g.label}
                              items={g.items}
                              isStreaming={isStreaming}
                            />
                          ))}
                          {/* Streaming cursor */}
                          {isStreaming && (
                            <div className='flex gap-2.5 items-center mt-2'>
                              <div className='w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-ping shrink-0' />
                              <div className='h-2.5 w-20 rounded bg-[#00e5ff]/20 animate-pulse' />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {day.summary ? (
                            <p className='text-[13px] text-[#bac9cc] line-clamp-2'>
                              {day.summary}
                            </p>
                          ) : isStreaming ? (
                            /* Skeleton lines while AI is writing this day */
                            <div className='space-y-2'>
                              <div className='h-3 w-full rounded bg-[#00e5ff]/10 animate-pulse' />
                              <div className='h-3 w-3/4 rounded bg-[#00e5ff]/10 animate-pulse' />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Export section */}
      <div className='p-6 bg-[#0A1420] border-t border-[#20344B] shrink-0'>
        <h4 className="font-['JetBrains_Mono'] text-[#bac9cc] mb-4 text-[11px] tracking-wider uppercase">
          Export &amp; Sync
        </h4>
        <div className='flex justify-between gap-2'>
          {EXPORT_ACTIONS.map(({ icon, label }) => (
            <button
              key={label}
              className='flex flex-col items-center justify-center gap-2 flex-1 h-16 rounded-xl bg-[#162032] border border-[#20344B] hover:bg-[#1E3A5F] hover:border-[#00e5ff]/50 transition-all group'
            >
              <span className='material-symbols-outlined text-[#bac9cc] group-hover:text-[#00e5ff] text-[20px]'>
                {icon}
              </span>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#bac9cc] group-hover:text-[#00e5ff]">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
