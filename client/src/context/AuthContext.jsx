import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext()

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
        needsTurnstileVerification: false
      }
    case 'LOGIN_PENDING_VERIFICATION':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
        needsTurnstileVerification: true
      }
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: action.payload,
        needsTurnstileVerification: false
      }
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        error: null,
        loading: false,
        needsTurnstileVerification: false
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      }
    case 'COMPLETE_VERIFICATION':
      return {
        ...state,
        isAuthenticated: true,
        needsTurnstileVerification: false
      }
    default:
      return state
  }
}

// Initial state
const initialState = {
  isAuthenticated: false,
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
  needsTurnstileVerification: false
}

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  // Set up axios interceptor for token and cookies
  useEffect(() => {
    // Always include credentials for cookie support
    axios.defaults.withCredentials = true

    if (state.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
      localStorage.setItem('token', state.token)
    } else {
      delete axios.defaults.headers.common['Authorization']
      localStorage.removeItem('token')
    }
  }, [state.token])

  const checkAuthStatus = useCallback(async (token) => {
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.data.user,
          token: token
        }
      })
    } catch (error) {
      console.error('Auth check failed:', error)
      dispatch({ type: 'LOGOUT' })
    }
  }, [API_URL])

  // Check if user is logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      checkAuthStatus(token)
    }
  }, [checkAuthStatus])

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      }, {
        withCredentials: true
      })

      const { user, tokens } = response.data

      // Check if Turnstile verification is needed
      const verificationData = localStorage.getItem('turnstileVerification')
      const needsVerification = !verificationData ||
        JSON.parse(verificationData).timestamp + JSON.parse(verificationData).expiresIn < Date.now()

      if (needsVerification) {
        // Store tokens but don't mark as fully authenticated yet
        dispatch({
          type: 'LOGIN_PENDING_VERIFICATION',
          payload: {
            user,
            token: tokens.accessToken
          }
        })

        // Store refresh token separately
        localStorage.setItem('refreshToken', tokens.refreshToken)

        return { success: true, user, needsVerification: true }
      } else {
        // User has valid verification, proceed with full login
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user,
            token: tokens.accessToken
          }
        })

        // Store refresh token separately
        localStorage.setItem('refreshToken', tokens.refreshToken)

        return { success: true, user, needsVerification: false }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      })
      return { success: false, error: errorMessage }
    }
  }, [API_URL])

  const register = useCallback(async (userData) => {
    dispatch({ type: 'LOGIN_START' })

    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData, {
        withCredentials: true
      })

      const { user, tokens } = response.data

      // New users always need Turnstile verification
      dispatch({
        type: 'LOGIN_PENDING_VERIFICATION',
        payload: {
          user,
          token: tokens.accessToken
        }
      })

      // Store refresh token separately
      localStorage.setItem('refreshToken', tokens.refreshToken)

      return { success: true, user, needsVerification: true }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      })
      return { success: false, error: errorMessage }
    }
  }, [API_URL])

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to clear server-side cookies
      await axios.post(`${API_URL}/auth/logout`, {}, {
        withCredentials: true
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Always clear client-side state regardless of server response
      localStorage.removeItem('refreshToken')
      dispatch({ type: 'LOGOUT' })
    }
  }, [API_URL])

  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await axios.put(`${API_URL}/auth/profile`, profileData)

      dispatch({
        type: 'UPDATE_USER',
        payload: response.data.user
      })

      return { success: true, user: response.data.user }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Profile update failed'
      return { success: false, error: errorMessage }
    }
  }, [API_URL])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const completeVerification = useCallback(() => {
    dispatch({ type: 'COMPLETE_VERIFICATION' })
  }, [])

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    clearError,
    completeVerification
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export AuthContext as named export


export default AuthContext
