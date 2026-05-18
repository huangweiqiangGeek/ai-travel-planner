import type { FastifyInstance } from 'fastify'
import { v4 as uuid } from 'uuid'
import { store } from '../services/store.ts'
import type { Trip } from '../types/index.ts'

export async function tripRoutes(app: FastifyInstance) {
  // GET /api/trips — list all trips
  app.get('/api/trips', async () => {
    return store.getTrips().map(({ id, title, destination, createdAt, passengers, styles, dateRange }) => ({
      id, title, destination, createdAt, passengers, styles, dateRange,
    }))
  })

  // GET /api/trips/:id
  app.get<{ Params: { id: string } }>('/api/trips/:id', async (req, reply) => {
    const trip = store.getTrip(req.params.id)
    if (!trip) return reply.code(404).send({ error: 'Trip not found' })
    return trip
  })

  // POST /api/trips — create new trip
  app.post<{
    Body: {
      destination?: string
      dateRange?: string
      passengers?: string
      budget?: number
      styles?: string[]
    }
  }>('/api/trips', async (req) => {
    const { destination = '', dateRange = '', passengers = '1', budget = 10000, styles = [] } = req.body ?? {}
    const trip: Trip = {
      id: uuid(),
      title: destination || '新建旅行',
      destination,
      dateRange,
      passengers,
      budget,
      styles,
      createdAt: new Date().toISOString(),
      itinerary: [],
    }
    return store.saveTrip(trip)
  })

  // PATCH /api/trips/:id — update trip itinerary
  app.patch<{
    Params: { id: string }
    Body: Partial<Trip>
  }>('/api/trips/:id', async (req, reply) => {
    const updated = store.updateTrip(req.params.id, req.body)
    if (!updated) return reply.code(404).send({ error: 'Trip not found' })
    return updated
  })
}
