export interface Activity {
  id: string
  name: string
  time: string
  highlight?: boolean
  icon?: string
}

export interface ItineraryDay {
  id: string
  day: number
  title: string
  activities?: Activity[]
  summary?: string
}

export interface Trip {
  id: string
  title: string
  destination: string
  dateRange: string
  passengers: string
  budget: number
  styles: string[]
  createdAt: string
  itinerary: ItineraryDay[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface TripChat {
  tripId: string
  messages: ChatMessage[]
}
