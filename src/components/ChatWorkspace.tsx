import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../types'

const AVATAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAzkCZ9YKizdp6-K96kxeBpoQCzc74aRwGAtmrbZL8JSOaS4qe73KMZw6wkEYKddV6-mreRMipSPezSJ43JZ_HlSzssW-o2cpSTTKTrA4Xh--F-pQwRsrDsag2pHTcWrrZcj95Dm0aBXntKA-fpQnfY3eVRUvP3DwNUprIMVLtBkmdcY7WBn9JNUOOsIWglolP-AOI6yPD5EqJGjJiXyaujg6FkLBoKJElzk2ULF8pzT4EJjfA8LlVqi_05Dzo93llKSRVu5TJ-IJ4'

interface ChatWorkspaceProps {
  title: string
  messages: ChatMessage[]
  onSend: (text: string) => void
  disabled?: boolean
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className='flex gap-4'>
      <img
        src={AVATAR_URL}
        alt='User'
        className='w-8 h-8 rounded-full mt-1 shrink-0 object-cover'
      />
      <div className='bg-[#1E3A5F] border border-[#28435F] text-[#dde3ea] px-6 py-4 rounded-2xl text-[15px] leading-[1.7] shadow-sm max-w-2xl'>
        {content}
      </div>
    </div>
  )
}

function AiMessage({ content }: { content: string }) {
  return (
    <div className='flex gap-4'>
      <div className='w-8 h-8 rounded-full bg-gradient-to-br from-[#00e5ff] to-[#2f4a70] flex items-center justify-center shrink-0 mt-1'>
        <span
          className='material-symbols-outlined text-[18px] text-[#00626e]'
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          auto_awesome
        </span>
      </div>
      <div
        className='prose prose-invert max-w-2xl text-[15px] leading-[1.7] py-2
        prose-headings:text-[#c3f5ff] prose-headings:font-semibold
        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-h4:text-[15px]
        prose-p:text-[#dde3ea] prose-p:my-2
        prose-strong:text-[#9cf0ff] prose-strong:font-semibold
        prose-em:text-[#b0d4e8]
        prose-li:text-[#dde3ea] prose-li:my-0.5
        prose-ul:my-2 prose-ol:my-2
        prose-ul:pl-5 prose-ol:pl-5
        prose-hr:border-[#20344B] prose-hr:my-4
        prose-code:text-[#00e5ff] prose-code:bg-[#0d2033] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-[#0d2033] prose-pre:border prose-pre:border-[#20344B] prose-pre:rounded-xl
        prose-blockquote:border-l-[#00e5ff] prose-blockquote:text-[#b0d4e8]
      '
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

function ThinkingMessage({ content }: { content: string }) {
  return (
    <div className='flex gap-4'>
      <div className='w-8 h-8 rounded-full bg-[#2f363b] flex items-center justify-center shrink-0 mt-1 relative overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-[#00e5ff]/20 to-transparent animate-pulse' />
        <span className='material-symbols-outlined text-[18px] text-[#00e5ff] animate-pulse'>
          model_training
        </span>
      </div>
      <div className='flex flex-col gap-3 w-full max-w-lg'>
        <div className='flex items-center gap-3 text-[#c3f5ff] text-[13px] py-1'>
          <span>✦ {content}</span>
          <div className='flex gap-1'>
            {[0, 0.2, 0.4].map((delay, i) => (
              <div
                key={i}
                className='w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse-dot'
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
        <div className='w-full h-24 rounded-xl bg-[#162032] border border-[#20344B] overflow-hidden relative'>
          <div className='absolute inset-0 shimmer-bg' />
          <div className='p-4 flex flex-col gap-3'>
            <div className='h-3 w-1/3 bg-[#2A3E59] rounded' />
            <div className='h-2 w-3/4 bg-[#1E3A5F] rounded' />
            <div className='h-2 w-1/2 bg-[#1E3A5F] rounded' />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatWorkspace({
  title,
  messages,
  onSend,
  disabled = false,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // When a new message is added (count increases), always jump to bottom
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // During streaming (content changes, count stays same), follow only if already near bottom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 150) el.scrollTop = el.scrollHeight
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || disabled) return
    setInput('')
    onSend(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section className='flex-1 flex flex-col relative border-r border-[#20344B] bg-[#0A1420]'>
      {/* Header */}
      <header className='h-16 bg-[#0A1420]/90 backdrop-blur-md border-b border-[#20344B] flex justify-between items-center px-6 z-10 shrink-0'>
        <h1 className="font-['Sora'] text-xl font-bold text-[#c3f5ff] flex items-center gap-2">
          {title}
          <span className='w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_rgba(0,229,255,0.6)]' />
        </h1>
        <div className='flex items-center gap-4 text-[#bac9cc] border-l border-[#20344B] pl-6'>
          <button className='hover:text-[#c3f5ff] transition-colors'>
            <span className='material-symbols-outlined'>notifications</span>
          </button>
          <button className='hover:text-[#c3f5ff] transition-colors'>
            <span className='material-symbols-outlined'>share</span>
          </button>
          <button className='hover:text-[#c3f5ff] transition-colors'>
            <span className='material-symbols-outlined'>more_vert</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={containerRef}
        className='flex-1 overflow-y-auto custom-scrollbar p-8 pb-32'
      >
        <div className='w-full max-w-3xl flex flex-col gap-8'>
          {messages.map(msg => {
            if (msg.role === 'user')
              return <UserMessage key={msg.id} content={msg.content} />
            if (msg.role === 'ai')
              return <AiMessage key={msg.id} content={msg.content} />
            return <ThinkingMessage key={msg.id} content={msg.content} />
          })}
        </div>
      </div>

      {/* Input HUD */}
      <div className='absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0A1420] via-[#0A1420] to-transparent z-20'>
        <div className='w-full bg-[#162032] rounded-[24px] border border-[#20344B] flex items-center px-4 py-2 shadow-lg focus-within:border-[#00e5ff]/50 transition-colors'>
          <button className='p-2 text-[#bac9cc] hover:text-[#c3f5ff] transition-colors'>
            <span className='material-symbols-outlined'>add_circle</span>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className='flex-1 bg-transparent border-none text-[#dde3ea] focus:outline-none text-[15px] placeholder-[#bac9cc]/50 px-3 py-3'
            placeholder="Tell me what you'd like to change..."
          />
          <button
            onClick={handleSend}
            disabled={disabled}
            className='w-10 h-10 rounded-full bg-[#00e5ff] text-[#00626e] flex items-center justify-center hover:bg-[#9cf0ff] transition-colors shrink-0 ml-2 shadow-[0_0_15px_rgba(0,229,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed'
          >
            <span
              className='material-symbols-outlined'
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              send
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
