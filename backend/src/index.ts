import Fastify from 'fastify'
import cors from '@fastify/cors'
import { tripRoutes } from './routes/trips.ts'
import { chatRoutes } from './routes/chat.ts'

const PORT = Number(process.env.PORT ?? 3001)

const app = Fastify({ logger: { transport: { target: 'pino-pretty' } } })

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://192.168.9.9:5173', 'http://localhost:5174', 'http://192.168.9.9:5174'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
})

await app.register(tripRoutes)
await app.register(chatRoutes)

app.get('/health', async () => ({ status: 'ok' }))

try {
  await app.listen({ port: PORT, host: '192.168.9.9' })
  console.log(`Backend running on http://192.168.9.9:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
