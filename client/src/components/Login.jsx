import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const Login = ({ onSwitchToRegister, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("themeMode") || "light"
  )

  const { login, loading, error, clearError } = useAuth()

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    clearError()
    setLocalError('')
  }, [clearError])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear errors when user starts typing
    if (localError) setLocalError('')
    if (error) clearError()
  }

  const validateForm = () => {
    if (!formData.email.trim()) {
      setLocalError('Email is required')
      return false
    }
    if (!formData.password.trim()) {
      setLocalError('Password is required')
      return false
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setLocalError('Please enter a valid email address')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setLocalError('')

    const loadingToast = toast.loading('Logging in...', {
      style: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      }
    })

    try {
      const result = await login(formData.email, formData.password)

      if (result.success) {
        console.log(result)
        toast.success('Welcome back! 🎉', {
          id: loadingToast,
          duration: 1300,
        })
        onClose()
      }
    } catch (err) {
      toast.error(err.message || 'Login failed 😞', {
        id: loadingToast,
        duration: 1300,
      })
      setLocalError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 modal-backdrop-strong flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="modal-container rounded-xl shadow-2xl dark:shadow-gray-900/50 p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-scroll scrollbar-hide relative"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
      >
        {/* Animated Background Gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-indigo-50/50 dark:from-blue-900/10 dark:via-purple-900/5 dark:to-indigo-900/10 -z-10"
          animate={{
            background: [
              "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.05) 100%)",
              "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(99, 102, 241, 0.03) 50%, rgba(59, 130, 246, 0.05) 100%)",
              "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.05) 100%)"
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating Particles */}
        <motion.div
          className="absolute top-4 right-4 w-2 h-2 bg-blue-400/20 dark:bg-blue-300/10 rounded-full"
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-6 left-6 w-1 h-1 bg-purple-400/20 dark:bg-purple-300/10 rounded-full"
          animate={{
            y: [0, -8, 0],
            opacity: [0.4, 0.9, 0.4]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-4 w-1.5 h-1.5 bg-indigo-400/20 dark:bg-indigo-300/10 rounded-full"
          animate={{
            x: [0, 8, 0],
            opacity: [0.2, 0.7, 0.2]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <div className="flex justify-between items-center mb-6">
          <motion.div
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <motion.div
              className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg"
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            >
              <motion.span
                className="text-white text-xl"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🔑
              </motion.span>
            </motion.div>
            <motion.h2
              className="text-2xl font-bold text-gray-800 dark:text-gray-100"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Welcome Back
            </motion.h2>
          </motion.div>
          <motion.button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            ×
          </motion.button>
        </div>

        <AnimatePresence>
          {(error || localError) && (
            <motion.div
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start space-x-3 shadow-sm"
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: [0, -5, 5, -5, 5, 0]
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.5,
                x: { duration: 0.6, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
              }}
            >
              <motion.span
                className="text-red-500 dark:text-red-400 text-lg"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                ⚠️
              </motion.span>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <p className="text-red-800 dark:text-red-300 text-sm font-medium">Login Failed</p>
                <p className="text-red-700 dark:text-red-400 text-sm">{error || localError}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <motion.input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-gray-100 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Enter your email"
              whileFocus={{ scale: 1.02 }}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <motion.input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-gray-100 pr-12 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Enter your password"
                whileFocus={{ scale: 1.02 }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </motion.button>
            </div>
          </motion.div>



          <motion.button
            type="submit"
            disabled={loading || isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-800 dark:hover:to-indigo-800 text-white py-3 px-4 rounded-lg font-medium disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg transition-all duration-200"
            whileHover={{
              scale: loading || isSubmitting ? 1 : 1.02,
              boxShadow: loading || isSubmitting ? undefined : "0 10px 25px rgba(59, 130, 246, 0.3)"
            }}
            whileTap={{ scale: loading || isSubmitting ? 1 : 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatePresence mode="wait">
              {(loading || isSubmitting) ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center space-x-2"
                >
                  <motion.div
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span>Logging in...</span>
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center space-x-2"
                >
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    🚀
                  </motion.span>
                  <span>Login</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.form>

        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Don't have an account?{' '}
            <motion.button
              onClick={onSwitchToRegister}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign up here
            </motion.button>
          </p>
        </motion.div>

        <motion.div
          className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="flex items-start space-x-3">
            <motion.span
              className="text-blue-600 dark:text-blue-400 text-lg"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              💡
            </motion.span>
            <div>
              <p className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-1">Demo Available</p>
              <p className="text-blue-700 dark:text-blue-400 text-xs">
                You can try our AI solver with sample problems without logging in,
                but camera capture and file upload require authentication.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Login Options */}
        <motion.div
          className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <p className="text-center text-gray-500 text-xs mb-4">Quick Demo Login</p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => {
                setFormData({ email: 'demo@example.com', password: 'demo123' })
              }}
              className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-md transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              👤 Demo User
            </motion.button>
            <motion.button
              onClick={() => {
                setFormData({ email: 'student@example.com', password: 'student123' })
              }}
              className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-3 rounded-md transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              🎓 Student Demo
            </motion.button>
          </div>
        </motion.div>

        {/* Welcome Back Info */}
        <motion.div
          className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="flex items-start space-x-3">
            <motion.span
              className="text-blue-600 dark:text-blue-400 text-lg"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🎯
            </motion.span>
            <div>
              <p className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-1">Welcome Back!</p>
              <p className="text-blue-700 dark:text-blue-400 text-xs">
                Access your AI-powered math solutions, image processing tools, and saved work.
                Your personalized dashboard awaits!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 border border-gray-200 dark:border-gray-600 rounded-lg relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 dark:text-gray-400 text-sm">🔒</span>
            <p className="text-gray-600 dark:text-gray-400 text-xs">
              Your session is secured with advanced encryption and Turnstile verification.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export default Login
