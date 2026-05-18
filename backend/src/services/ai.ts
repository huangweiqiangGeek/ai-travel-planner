import OpenAI from 'openai'
import { SYSTEM_PROMPT } from './systemPrompt.ts'

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey: process.env.AI_API_KEY ?? '',
  timeout: 120_000,  // high ceiling; real timeout managed by AbortController in streamChat
  maxRetries: 0,
})

const MODEL = process.env.AI_MODEL ?? 'gpt-5.5'

export type OnChunk = (delta: string) => void
export type OnDone = (fullText: string) => void

export async function streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  onChunk: OnChunk,
  onDone: OnDone,
  onError: (err: Error) => void,
  tripContext?: string,    // optional trip metadata appended to system prompt
  signal?: AbortSignal,   // caller-controlled abort (e.g. client disconnect)
) {
  const systemContent = tripContext
    ? `${SYSTEM_PROMPT}\n\n---\n\n# 当前规划的行程信息（全程牢记）\n${tripContext}`
    : SYSTEM_PROMPT

  try {
    const stream = await client.chat.completions.create(
      {
        model: MODEL,
        stream: true,
        messages: [{ role: 'system', content: systemContent }, ...messages],
      },
      // Only pass signal if one was given — avoids spurious aborts from internal timers
      signal ? { signal } : undefined,
    )

    let full = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        full += delta
        onChunk(delta)
      }
    }
    onDone(full)
  } catch (err) {
    console.error('[AI error]', err)
    // If caller deliberately aborted (e.g. client disconnect), ignore the resulting error
    if (signal?.aborted) return

    const isAbortLike =
      err instanceof Error && (
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.name === 'APIUserAbortError' ||
        err.name === 'APIConnectionTimeoutError' ||
        (err.constructor?.name?.includes('Abort')) ||
        err.message.toLowerCase().includes('abort') ||
        err.message.toLowerCase().includes('timed out') ||
        err.message.toLowerCase().includes('timeout') ||
        // OpenAI SDK wraps aborted undici connections as APIConnectionError("Connection error.")
        err.message.toLowerCase().includes('connection error')
      )
    if (isAbortLike) {
      onError(new Error('AI 响应超时，请重试'))
      return
    }
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
