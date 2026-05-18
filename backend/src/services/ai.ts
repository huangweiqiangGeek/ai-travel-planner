import OpenAI from 'openai'
import { SYSTEM_PROMPT } from './systemPrompt.ts'

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey: process.env.AI_API_KEY ?? '',
  timeout: 600_000,  // 10 min — reasoning models (gpt-5.5 etc.) can take 2-5 min
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

    const isTimeout =
      err instanceof Error && (
        err.name === 'TimeoutError' ||
        err.name === 'APIConnectionTimeoutError' ||
        err.message.toLowerCase().includes('timed out') ||
        // OpenAI SDK emits "Request timed out" for our client-level timeout
        err.message.toLowerCase().includes('request timed out')
      )
    if (isTimeout) {
      onError(new Error('AI 响应超时，请重试（模型响应过慢，可尝试换用更快的模型）'))
      return
    }

    const isClientAbort =
      err instanceof Error && (
        err.name === 'AbortError' ||
        err.name === 'APIUserAbortError' ||
        (err.constructor?.name?.includes('Abort')) ||
        err.message.toLowerCase().includes('abort')
      )
    if (isClientAbort) return  // deliberate abort, silently ignore

    // For all other errors (API errors, connection errors, model errors, etc.)
    // surface the real message so it's easier to diagnose
    const msg = err instanceof Error ? err.message : String(err)
    onError(new Error(`AI 调用失败：${msg}`))
  }
}
