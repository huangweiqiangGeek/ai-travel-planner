import { Link } from 'react-router-dom'
import type { Trip, User } from '../types'

const AVATAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAzkCZ9YKizdp6-K96kxeBpoQCzc74aRwGAtmrbZL8JSOaS4qe73KMZw6wkEYKddV6-mreRMipSPezSJ43JZ_HlSzssW-o2cpSTTKTrA4Xh--F-pQwRsrDsag2pHTcWrrZcj95Dm0aBXntKA-fpQnfY3eVRUvP3DwNUprIMVLtBkmdcY7WBn9JNUOOsIWglolP-AOI6yPD5EqJGjJiXyaujg6FkLBoKJElzk2ULF8pzT4EJjfA8LlVqi_05Dzo93llKSRVu5TJ-IJ4'

interface SidebarProps {
  trips: Trip[]
  activeTrip: string
  onSelectTrip: (id: string) => void
  onNewTrip: () => void
  user: User
}

const NAV_ITEMS = [
  { icon: 'explore', label: 'Exploration', path: '/' },
  { icon: 'bookmark', label: 'Saved Places', path: '#' },
  { icon: 'map', label: 'Travel Guides', path: '#' },
  { icon: 'settings', label: 'Settings', path: '#' },
]

export default function Sidebar({
  trips,
  activeTrip,
  onSelectTrip,
  onNewTrip,
  user,
}: SidebarProps) {
  return (
    <aside className='fixed left-0 top-0 h-full w-[280px] bg-[#0D1B2A] border-r border-[#20344B] flex flex-col py-6 z-20'>
      {/* Logo */}
      <div className='px-6 mb-6 flex items-center gap-3'>
        <span
          className='material-symbols-outlined text-[#00e5ff]'
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          auto_awesome
        </span>
        <span className="font-['Sora'] text-xl font-bold text-[#c3f5ff]">
          Travel Planner AI
        </span>
      </div>

      {/* New Trip */}
      <div className='px-6 mb-8'>
        <button
          onClick={onNewTrip}
          className="w-full h-11 bg-[#00e5ff] text-[#00626e] rounded-[14px] font-['JetBrains_Mono'] text-xs tracking-wide flex items-center justify-center gap-2 hover:bg-[#9cf0ff] transition-colors"
        >
          <span className='material-symbols-outlined text-[18px]'>add</span>
          新建旅行
        </button>
      </div>

      {/* Nav */}
      <nav className='px-4 mb-6'>
        <ul className='space-y-1'>
          {NAV_ITEMS.map(({ icon, label, path }) => {
            const isActive = path === '/' && activeTrip !== ''
            return (
              <li key={label}>
                <Link
                  to={path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-[#c3f5ff] font-bold bg-[#16283D]/50'
                      : 'text-[#bac9cc] hover:bg-[#16283D]/30'
                  }`}
                >
                  <span className='material-symbols-outlined'>{icon}</span>
                  <span className='text-[15px]'>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Recent Trips */}
      <div className='flex-1 overflow-y-auto custom-scrollbar px-4 pb-4'>
        <h3 className="font-['JetBrains_Mono'] text-xs tracking-widest text-[#bac9cc] mb-3 px-4 uppercase">
          Recent Trips
        </h3>
        <ul className='space-y-1'>
          {trips.map(trip => (
            <li key={trip.id}>
              <Link
                to={`/trip/${trip.id}`}
                className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition-colors border-l-[3px] ${
                  trip.id === activeTrip
                    ? 'bg-[#16283D] border-[#00e5ff] text-[#dde3ea]'
                    : 'border-transparent text-[#bac9cc] hover:bg-[#16283D]/50'
                }`}
                onClick={() => onSelectTrip(trip.id)}
              >
                <span
                  className={`material-symbols-outlined text-[18px] ${trip.id === activeTrip ? 'text-[#00e5ff]' : ''}`}
                >
                  history
                </span>
                <span className='truncate text-[13px]'>{trip.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* User Profile */}
      <div className='mt-auto px-4'>
        <div className='p-3 rounded-xl bg-[#162032] border border-[#20344B] flex items-center gap-3'>
          <img
            src={user.avatar || AVATAR_URL}
            alt='User Avatar'
            className='w-10 h-10 rounded-full object-cover'
          />
          <div className='flex-1 min-w-0'>
            <div className='text-[13px] font-semibold truncate text-[#dde3ea]'>
              {user.name}
            </div>
            <div className="font-['JetBrains_Mono'] text-[11px] text-[#00e5ff] mt-1">
              {user.tier}
            </div>
          </div>
          <button className='text-[#bac9cc] hover:text-[#c3f5ff] transition-colors'>
            <span className='material-symbols-outlined'>settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
