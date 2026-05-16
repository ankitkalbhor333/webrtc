import { useState, useEffect, useCallback } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import WebRTCLanding from './pages/WebRTCLanding'
import WebRTCCall from './pages/WebRTCCall'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'

function parsePath(pathname) {
  if (pathname === '/login') return { page: 'login' }
  if (pathname === '/register') return { page: 'register' }
  const callMatch = pathname.match(/^\/call\/(.+)$/)
  if (callMatch) return { page: 'call', roomId: decodeURIComponent(callMatch[1]) }
  return { page: 'landing' }
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState('landing')
  const [roomId, setRoomId] = useState(null)
  const { isAuthenticated, checkAuth } = useAuth()

  const syncFromUrl = useCallback(() => {
    const { page, roomId: id } = parsePath(window.location.pathname)
    setCurrentPage(page)
    setRoomId(id || null)
  }, [])

  useEffect(() => {
    checkAuth()
    syncFromUrl()

    const handlePopState = () => syncFromUrl()
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [checkAuth, syncFromUrl])

  const navigate = (path) => {
    window.history.pushState({}, '', path)
    syncFromUrl()
  }

  const handleLoginSuccess = () => navigate('/')
  const handleRegisterSuccess = () => navigate('/')
  const handleSwitchToRegister = () => navigate('/register')
  const handleSwitchToLogin = () => navigate('/login')
  const handleJoinCall = (id) => navigate(`/call/${encodeURIComponent(id)}`)
  const handleLeaveCall = () => navigate('/')

  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return (
        <Register
          onSwitchToLogin={handleSwitchToLogin}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )
    }
    return (
      <Login
        onSwitchToRegister={handleSwitchToRegister}
        onLoginSuccess={handleLoginSuccess}
      />
    )
  }

  if (currentPage === 'call' && roomId) {
    return <WebRTCCall roomId={roomId} onLeave={handleLeaveCall} />
  }

  return (
    <WebRTCLanding
      onLogout={handleSwitchToLogin}
      onJoinCall={handleJoinCall}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
