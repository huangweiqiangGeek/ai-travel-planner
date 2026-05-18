import type { ItineraryDay, Activity } from '../types'

const CN_NUM: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
}

/** Extract day number from any text containing "Day N" or "第N天" */
function extractDayNumber(text: string): number | null {
  const eng = text.match(/\bday\s*(\d+)\b/i)
  if (eng) return parseInt(eng[1])
  const cn = text.match(/第\s*([一二三四五六七八九十\d]+)\s*天/)
  if (cn) {
    const n = parseInt(cn[1])
    return isNaN(n) ? (CN_NUM[cn[1]] ?? null) : n
  }
  return null
}

const SUBSECTION_RE = /^(上午|早上|下午|傍晚|晚上|夜间|早餐|午餐|晚餐|住宿|交通|购物|娱乐|体验|景点|活动)/

const NOISE_RE =
  /^(?:人均|约¥|约\$|推荐[：:]|记得|注意[：:]|备注[：:]|tip:|提示[：:]|费用[：:]|消费[：:]|价格[：:])/i

// If a line contains these keywords it marks the start of a summary section —
// stop parsing day content after it to avoid re-parsing the itinerary overview.
const SUMMARY_MARKER_RE = /行程总览|行程总结|行程概览|行程安排总览|行程概要|行程回顾|总览|总结|小结/

let _actId = 0
const MAX_ACTS_PER_DAY = 9

export function parseItinerary(text: string): ItineraryDay[] {
  const lines = text.split('\n')
  const days: ItineraryDay[] = []
  let currentDay: ItineraryDay | null = null
  let currentGroup = ''
  let stopParsing = false          // set to true when we hit a summary section
  const seenDayNums = new Set<number>()  // skip duplicate day headings

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (stopParsing) continue

    const isBullet =
      /^[-•*]\s/.test(line) ||
      /^\d+\.\s/.test(line) ||
      /^→/.test(line)         // AI often uses → for activity updates

    // ── Markdown heading (# ## ###) ── search "Day N" anywhere in heading ─
    const mdMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (mdMatch) {
      const content = mdMatch[2].replace(/\*\*/g, '').trim()
      // Summary section heading → stop (only after we've already parsed at least one day)
      if (seenDayNums.size > 0 && SUMMARY_MARKER_RE.test(content)) { stopParsing = true; continue }
      const dayNum = extractDayNumber(content)
      if (dayNum !== null) {
        if (seenDayNums.has(dayNum)) {
          // Duplicate heading for the SAME day = sub-heading within that day → keep collecting
          // Duplicate heading for a DIFFERENT day = summary re-listing → stop collecting
          if (currentDay?.day !== dayNum) currentDay = null
          continue
        }
        seenDayNums.add(dayNum)
        if (currentDay) days.push(currentDay)
        currentDay = { id: `pd-${dayNum}`, day: dayNum, title: content, activities: [] }
        currentGroup = ''
      } else if (currentDay) {
        const stripped = content.replace(/[：:].*$/, '').trim()
        if (stripped.length <= 12 && SUBSECTION_RE.test(stripped)) {
          currentGroup = stripped
        }
      }
      continue
    }

    // ── Bold at start of line  **Day 3**: xxx  OR  **Day 3** ──────────────
    if (!mdMatch && (line.startsWith('**') || line.startsWith('*'))) {
      const content = line.replace(/\*/g, '').trim()
      if (seenDayNums.size > 0 && SUMMARY_MARKER_RE.test(content)) { stopParsing = true; continue }
      const dayNum = extractDayNumber(content)
      if (dayNum !== null && !seenDayNums.has(dayNum)) {
        seenDayNums.add(dayNum)
        if (currentDay) days.push(currentDay)
        currentDay = { id: `pd-${dayNum}`, day: dayNum, title: content, activities: [] }
        currentGroup = ''
        continue
      }
    }

    // ── Standalone line starting with "Day N" or "第N天" ──────────────────
    if (!isBullet) {
      // Check for summary marker first (only after we've already parsed at least one day)
      if (seenDayNums.size > 0 && SUMMARY_MARKER_RE.test(line) && line.length <= 25) { stopParsing = true; continue }
      const startMatch = line.match(/^(?:day\s*(\d+)|第\s*([一二三四五六七八九十\d]+)\s*天)/i)
      if (startMatch) {
        const dayNum = startMatch[1]
          ? parseInt(startMatch[1])
          : (parseInt(startMatch[2]) || CN_NUM[startMatch[2]] || 0)
        if (dayNum > 0 && !seenDayNums.has(dayNum)) {
          seenDayNums.add(dayNum)
          if (currentDay) days.push(currentDay)
          const title = line.replace(/[：:]\s*$/, '').trim()
          currentDay = { id: `pd-${dayNum}`, day: dayNum, title, activities: [] }
          currentGroup = ''
          continue
        }
      }
    }

    if (!currentDay) continue

    // ── Activity / bullet line ─────────────────────────────────────────────
    if (isBullet) {
      const acts = currentDay.activities as Activity[]
      if (acts.length >= MAX_ACTS_PER_DAY) continue

      const content = line
        .replace(/^[-•*]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/^→\s*(?:改为|更新为|换成|调整为)?\s*/u, '')  // strip → prefix and common change verbs
        .replace(/\*\*/g, '')
        .trim()

      if (!content || content.length < 2) continue
      if (NOISE_RE.test(content)) continue
      if (/^[¥￥$（(]/.test(content)) continue
      if (/[¥￥]/.test(content) && content.length <= 20) continue

      const timeMatch = content.match(
        /^((?:上午|下午|早上|晚上)?\s*\d{1,2}[：:]\d{2}(?:\s*[AP]M)?|\d{1,2}点)\s*[-–—：:·]?\s*/i,
      )
      const time = timeMatch ? timeMatch[1].trim() : ''
      const name = (timeMatch ? content.slice(timeMatch[0].length) : content).trim()

      if (name.length > 1) {
        acts.push({
          id: `act-${++_actId}`,
          name: name.slice(0, 80),
          time,
          group: currentGroup || undefined,
        })
      }
    }
  }

  if (currentDay) days.push(currentDay)
  return days
}
