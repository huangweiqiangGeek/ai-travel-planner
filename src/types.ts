export interface Trip {
  id: string
  title: string
  active?: boolean
}

export interface Activity {
  id: string
  name: string
  time: string
  highlight?: boolean
  icon?: string
  group?: string   // time-of-day section label, e.g. '上午' '下午' '晚上'
}

export interface ItineraryDay {
  id: string
  day: number
  title: string
  activities?: Activity[]
  summary?: string
  active?: boolean
}

export type MessageRole = 'user' | 'ai' | 'thinking'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  thinking?: boolean
}

export interface User {
  name: string
  tier: string
  avatar: string
}
