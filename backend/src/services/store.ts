import type { Trip, TripChat, ChatMessage } from '../types/index.ts'

// In-memory store (no DB needed for now)
const trips = new Map<string, Trip>()
const chats = new Map<string, TripChat>()

export const store = {
  // --- Trips ---
  getTrips(): Trip[] {
    return [...trips.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  },

  getTrip(id: string): Trip | undefined {
    return trips.get(id)
  },

  saveTrip(trip: Trip): Trip {
    trips.set(trip.id, trip)
    return trip
  },

  updateTrip(id: string, patch: Partial<Trip>): Trip | undefined {
    const existing = trips.get(id)
    if (!existing) return undefined
    const updated = { ...existing, ...patch }
    trips.set(id, updated)
    return updated
  },

  // --- Chats ---
  getChat(tripId: string): TripChat {
    if (!chats.has(tripId)) {
      chats.set(tripId, { tripId, messages: [] })
    }
    return chats.get(tripId)!
  },

  appendMessage(tripId: string, msg: ChatMessage): void {
    const chat = this.getChat(tripId)
    chat.messages.push(msg)
  },

  getMessages(tripId: string): ChatMessage[] {
    return this.getChat(tripId).messages
  },
}
