import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import DateRangePicker from './DateRangePicker'

const BG_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCkPY7QjwOw8haKTL9XeGhHsukT2IvnwkIc_VWPbtG440ikHy8rwCCA96gTSYY2n-DYrKfSQr1gIJFw-OdKMIqv_-bza3zCspK8h3E6SRWAr0Mz2R6TlAnjw7ldBe2yAVHsGwMi3euHmFCT5Fq5JOn2tzYg1x7VTAkQYKmTZ80rZGF-HM2c6smcNK_vA1dYZXyYvzbIUM3eYCz6x6g4dcLzrHdsQV50X5DAH3SyGDRGjDq64F0Fre9sIScm9vLLTz4tjLptXOXfzPw'

const TRAVEL_STYLES = ['休闲', '摄影', '美食', '亲子', '冒险', '购物']
const PASSENGER_OPTIONS = [
  { value: '1', label: '1 人 (独自旅行)' },
  { value: '2', label: '2 人 (伴侣/朋友)' },
  { value: '3', label: '3 人 (小家庭)' },
  { value: '4', label: '4 人' },
  { value: '5+', label: '5 人或以上' },
]

export interface TripRequirements {
  destination: string
  dateRange: string
  passengers: string
  budget: number
  styles: string[]
}

interface NewTripModalProps {
  onStart: (req: TripRequirements) => void
  onSkip: () => void
}

function formatBudget(value: number) {
  const lo = Math.round((value * 0.7) / 1000) * 1000
  const hi = value
  return `￥${lo.toLocaleString()} - ￥${hi.toLocaleString()}`
}

export default function NewTripModal({ onStart, onSkip }: NewTripModalProps) {
  const [destination, setDestination] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [passengers, setPassengers] = useState('2')
  const [budget, setBudget] = useState(20000)
  const [styles, setStyles] = useState<string[]>(['休闲', '美食'])

  const toggleStyle = (style: string) => {
    setStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style],
    )
  }

  const handleStart = () => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    const dateRangeStr =
      dateRange?.from && dateRange?.to
        ? `${fmt(dateRange.from)} 至 ${fmt(dateRange.to)}`
        : dateRange?.from
          ? `${fmt(dateRange.from)} 出发`
          : ''
    onStart({
      destination,
      dateRange: dateRangeStr,
      passengers,
      budget,
      styles,
    })
  }

  return (
    <div className='relative flex-1 flex items-center justify-center overflow-y-auto'>
      {/* Background */}
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat'
        style={{ backgroundImage: `url("${BG_IMG}")` }}
      >
        <div className='absolute inset-0 bg-black/60 backdrop-blur-md' />
      </div>

      {/* Modal */}
      <main className='relative z-10 w-full max-w-[900px] bg-[#1a2025] rounded-[28px] border border-[#3b494c]/50 shadow-2xl flex flex-col p-10 m-4'>
        {/* Header */}
        <header className='flex flex-col items-center text-center mb-8'>
          <div className='w-12 h-12 rounded-full bg-[#00e5ff]/10 flex items-center justify-center mb-4 border border-[#00e5ff]/30'>
            <span
              className='material-symbols-outlined text-[#00e5ff]'
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              auto_awesome
            </span>
          </div>
          <h1 className="font-['Sora'] text-3xl font-semibold text-[#dde3ea] mb-2">
            开始你的下一段旅行 ✈️
          </h1>
          <p className='text-[15px] text-[#bac9cc]'>
            AI 将为您生成个性化旅行计划
          </p>
        </header>

        {/* Form Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-8'>
          {/* Left Column */}
          <div className='flex flex-col gap-6'>
            {/* Destination */}
            <div className='flex flex-col gap-2'>
              <label className="font-['JetBrains_Mono'] text-xs text-[#bac9cc] uppercase tracking-widest">
                目的地
              </label>
              <div className='relative'>
                <span className='material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#bac9cc]'>
                  location_on
                </span>
                <input
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className='w-full bg-[#2f363b]/50 border border-[#3b494c] text-[#dde3ea] rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-colors text-[15px] placeholder:text-[#bac9cc]/50'
                  placeholder='例如：东京、巴黎、巴厘岛'
                  type='text'
                />
              </div>
            </div>

            {/* Date Range */}
            <div className='flex flex-col gap-2'>
              <label className="font-['JetBrains_Mono'] text-xs text-[#bac9cc] uppercase tracking-widest">
                出发与返程
              </label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            {/* Passengers */}
            <div className='flex flex-col gap-2'>
              <label className="font-['JetBrains_Mono'] text-xs text-[#bac9cc] uppercase tracking-widest">
                同行人数
              </label>
              <div className='relative'>
                <span className='material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#bac9cc]'>
                  group
                </span>
                <select
                  value={passengers}
                  onChange={e => setPassengers(e.target.value)}
                  className='w-full bg-[#2f363b]/50 border border-[#3b494c] text-[#dde3ea] rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff] transition-colors text-[15px] appearance-none cursor-pointer'
                >
                  {PASSENGER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className='material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#bac9cc] pointer-events-none'>
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className='flex flex-col gap-6'>
            {/* Budget Slider */}
            <div className='flex flex-col gap-2'>
              <div className='flex justify-between items-center'>
                <label className="font-['JetBrains_Mono'] text-xs text-[#bac9cc] uppercase tracking-widest">
                  旅行预算
                </label>
                <span className="font-['JetBrains_Mono'] text-xs text-[#00e5ff]">
                  {formatBudget(budget)}
                </span>
              </div>
              <div className='pt-2 pb-4'>
                <input
                  type='range'
                  min={1000}
                  max={50000}
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className='w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#2f4a70] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00e5ff] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:-mt-1.5'
                />
                <div className="flex justify-between mt-2 font-['JetBrains_Mono'] text-[10px] text-[#bac9cc]/50">
                  <span>经济</span>
                  <span>舒适</span>
                  <span>奢华</span>
                </div>
              </div>
            </div>

            {/* Travel Style Chips */}
            <div className='flex flex-col gap-3'>
              <label className="font-['JetBrains_Mono'] text-xs text-[#bac9cc] uppercase tracking-widest">
                旅行风格 (可多选)
              </label>
              <div className='flex flex-wrap gap-2'>
                {TRAVEL_STYLES.map(style => {
                  const active = styles.includes(style)
                  return (
                    <button
                      key={style}
                      onClick={() => toggleStyle(style)}
                      className={`px-4 py-2 rounded-full border font-['JetBrains_Mono'] text-xs transition-colors flex items-center gap-1 ${
                        active
                          ? 'border-[#00e5ff] bg-[#00e5ff]/20 text-[#00e5ff]'
                          : 'border-[#3b494c] bg-[#2f363b]/30 text-[#bac9cc] hover:border-[#00e5ff]/50 hover:text-[#00e5ff]'
                      }`}
                    >
                      {active && (
                        <span className='material-symbols-outlined text-[16px]'>
                          done
                        </span>
                      )}
                      {style}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex flex-col items-center gap-4 mt-auto'>
          <button
            onClick={handleStart}
            className="w-full h-[52px] bg-gradient-to-r from-[#00e5ff] to-[#00daf3] text-[#00363d] font-['Sora'] text-xl font-semibold rounded-xl hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all duration-300 flex items-center justify-center gap-2"
          >
            <span className='text-2xl'>🤖</span> 开始 AI 规划
          </button>
          <button
            onClick={onSkip}
            className='text-[13px] text-[#bac9cc] hover:text-[#00e5ff] transition-colors underline decoration-[#bac9cc]/30 hover:decoration-[#00e5ff]'
          >
            跳过，直接聊天
          </button>
        </div>
      </main>
    </div>
  )
}
