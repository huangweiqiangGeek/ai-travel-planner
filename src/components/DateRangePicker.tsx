import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale'
import 'react-day-picker/style.css'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
}

function formatDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export default function DateRangePicker({
  value,
  onChange,
  placeholder = '选择出发与返程日期',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 计算 fixed 定位
  const openPopover = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const calendarWidth = 560
    let left = rect.left
    if (left + calendarWidth > window.innerWidth - 8) {
      left = window.innerWidth - calendarWidth - 8
    }
    let top = rect.bottom + 8
    setPopoverStyle({ position: 'fixed', top, left, zIndex: 9999 })
    setOpen(true)
  }

  const handleSelect = (range: DateRange | undefined) => {
    // 限制最多 15 天
    if (range?.from && range?.to) {
      const maxEnd = new Date(range.from)
      maxEnd.setDate(maxEnd.getDate() + 6)
      if (range.to > maxEnd) {
        onChange({ from: range.from, to: maxEnd })
        return
      }
    }
    onChange(range)
  }

  const selectedDays =
    value?.from && value?.to
      ? Math.round((value.to.getTime() - value.from.getTime()) / 86400000) + 1
      : null

  const displayText =
    value?.from && value?.to
      ? `${formatDate(value.from)}  →  ${formatDate(value.to)}`
      : value?.from
        ? `${formatDate(value.from)}  →  选择返回日期`
        : ''

  return (
    <div className='relative'>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type='button'
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={`w-full flex items-center gap-3 bg-[#2f363b]/50 border rounded-xl px-4 py-3 transition-colors text-left ${
          open
            ? 'border-[#00e5ff] ring-1 ring-[#00e5ff]'
            : 'border-[#3b494c] hover:border-[#00e5ff]/50'
        }`}
      >
        <span className='material-symbols-outlined text-[#bac9cc] text-[20px] shrink-0'>
          calendar_month
        </span>
        <span
          className={`flex-1 text-[14px] ${displayText ? 'text-[#dde3ea]' : 'text-[#bac9cc]/50'}`}
        >
          {displayText || placeholder}
        </span>
        {value?.from && (
          <span
            role='button'
            tabIndex={0}
            onClick={e => {
              e.stopPropagation()
              onChange(undefined)
            }}
            onKeyDown={e =>
              e.key === 'Enter' && (e.stopPropagation(), onChange(undefined))
            }
            className='material-symbols-outlined text-[#bac9cc]/60 hover:text-[#bac9cc] text-[18px] shrink-0 cursor-pointer'
          >
            close
          </span>
        )}
      </button>

      {/* Popover — fixed 定位，不受任何 overflow 影响 */}
      {open && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className='bg-[#1a2025] border border-[#3b494c] rounded-2xl shadow-2xl shadow-black/60 p-4'
        >
          <DayPicker
            mode='range'
            locale={zhCN}
            selected={value}
            onSelect={handleSelect}
            disabled={[
              { before: new Date() },
              ...(value?.from && !value?.to
                ? [
                    {
                      after: (() => {
                        const max = new Date(value.from)
                        max.setDate(max.getDate() + 6)
                        return max
                      })(),
                    },
                  ]
                : []),
            ]}
            numberOfMonths={2}
          />
          <div className='flex items-center justify-between mt-3 pt-3 border-t border-[#3b494c]'>
            <span className="font-['JetBrains_Mono'] text-[12px] text-[#bac9cc]/60">
              {selectedDays
                ? `已选 ${selectedDays} 天（最多 7 天）`
                : '最多可选 7 天'}
            </span>
            <button
              type='button'
              onClick={() => setOpen(false)}
              disabled={!value?.from}
              className='px-5 py-2 rounded-xl bg-[#00e5ff] text-[#00363d] font-semibold text-[13px] hover:bg-[#33ecff] transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
            >
              {value?.from && value?.to ? '确认日期' : '关闭'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
