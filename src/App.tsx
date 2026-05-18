import { useState, useEffect } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useMatch,
} from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TripWorkspace from './components/TripWorkspace'
import NewTripModal, { type TripRequirements } from './components/NewTripModal'
import type { Trip, User } from './types'
import { fetchTrips, createTrip, type TripSummary } from './api'

const DEFAULT_USER: User = {
  name: 'Alex Explorer',
  tier: 'Pro Voyager',
  avatar: '',
}

function summaryToTrip(s: TripSummary): Trip {
  return { id: s.id, title: s.title || s.destination || '新建旅行' }
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripsLoaded, setTripsLoaded] = useState(false)
  const navigate = useNavigate()
  const tripMatch = useMatch('/trip/:id')
  const activeTrip = tripMatch?.params?.id ?? ''

  useEffect(() => {
    fetchTrips()
      .then(list => {
        const mapped = list.map(summaryToTrip)
        setTrips(mapped)
        setTripsLoaded(true)
      })
      .catch(() => setTripsLoaded(true))
  }, [])

  const handleSelectTrip = (id: string) => navigate(`/trip/${id}`)
  const handleNewTrip = () => navigate('/new')

  const handleModalStart = async (req: TripRequirements) => {
    try {
      const newTrip = await createTrip({
        destination: req.destination,
        dateRange: req.dateRange,
        passengers: req.passengers,
        budget: req.budget,
        styles: req.styles,
      })
      const trip = summaryToTrip(newTrip)
      setTrips(prev => [trip, ...prev])

      const parts = [
        req.destination ? `我想去${req.destination}旅游` : '我想规划一次旅行',
        req.dateRange ? `时间：${req.dateRange}` : '',
        `${req.passengers}人同行`,
        req.budget ? `预算约￥${req.budget.toLocaleString()}` : '',
        req.styles.length ? `风格偏好：${req.styles.join('、')}` : '',
        '请帮我规划详细行程。',
      ].filter(Boolean)

      navigate(`/trip/${trip.id}`, { state: { autoMessage: parts.join('，') } })
    } catch {
      alert('创建旅行失败，请确认后端已启动')
    }
  }

  const handleModalSkip = async () => {
    try {
      const newTrip = await createTrip({
        destination: '新建旅行',
        dateRange: '',
        passengers: '1',
        budget: 0,
        styles: [],
      })
      const trip = summaryToTrip(newTrip)
      setTrips(prev => [trip, ...prev])
      navigate(`/trip/${trip.id}`)
    } catch {
      const id = `local-${Date.now()}`
      setTrips(prev => [{ id, title: '新建旅行' }, ...prev])
      navigate(`/trip/${id}`)
    }
  }

  return (
    <div className='h-screen w-screen overflow-hidden flex bg-[#0D1B2A] text-[#dde3ea]'>
      <Sidebar
        trips={trips}
        activeTrip={activeTrip}
        onSelectTrip={handleSelectTrip}
        onNewTrip={handleNewTrip}
        user={DEFAULT_USER}
      />

      <main className='ml-[280px] flex-1 flex h-full'>
        <Routes>
          <Route
            path='/'
            element={
              tripsLoaded ? (
                <Navigate
                  to={trips.length > 0 ? `/trip/${trips[0].id}` : '/new'}
                  replace
                />
              ) : null
            }
          />
          <Route
            path='/new'
            element={
              <div className='flex-1 flex h-full'>
                <NewTripModal
                  onStart={handleModalStart}
                  onSkip={handleModalSkip}
                />
              </div>
            }
          />
          <Route
            path='/trip/:id'
            element={<TripWorkspace trips={trips} setTrips={setTrips} />}
          />
        </Routes>
      </main>
    </div>
  )
}
