import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const Register = ({ onSwitchToLogin, onClose }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [passwordMatch, setPasswordMatch] = useState(true)
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("themeMode") || "light"
  )

  const { register, loading, error, clearError } = useAuth()

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    clearError()
  }, [clearError])

  useEffect(() => {
    if (formData.password && formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword)
    }
  }, [formData.password, formData.confirmPassword])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!passwordMatch) {
      toast.error('Passwords do not match! 🔒')
      return
    }

    const loadingToast = toast.loading('Creating your account...', {
      style: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      }
    })

    try {
      const { confirmPassword, ...registrationData } = formData
      const result = await register(registrationData)

      if (result.success) {
        toast.success('Account created successfully! Welcome! 🎉', {
          id: loadingToast,
          duration: 3000,
        })
        onClose()
      } else {
        toast.error(result.error || 'Registration failed 😞', {
          id: loadingToast,
          duration: 4000,
        })
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again. 😞', {
        id: loadingToast,
        duration: 4000,
      })
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
        className="modal-container rounded-xl shadow-2xl dark:shadow-gray-900/50 p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-scroll scrollbar-hide relative"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
        whileHover={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
      >
        {/* Animated Background Gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-emerald-50/30 to-teal-50/50 dark:from-green-900/10 dark:via-emerald-900/5 dark:to-teal-900/10 -z-10 rounded-xl"
          animate={{
            background: [
              "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.03) 50%, rgba(20, 184, 166, 0.05) 100%)",
              "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(20, 184, 166, 0.03) 50%, rgba(34, 197, 94, 0.05) 100%)",
              "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 185, 129, 0.03) 50%, rgba(20, 184, 166, 0.05) 100%)"
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating Particles */}
        <motion.div
          className="absolute top-4 right-4 w-2 h-2 bg-green-400/20 dark:bg-green-300/10 rounded-full"
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-6 left-6 w-1 h-1 bg-emerald-400/20 dark:bg-emerald-300/10 rounded-full"
          animate={{
            y: [0, -8, 0],
            opacity: [0.4, 0.9, 0.4]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-4 w-1.5 h-1.5 bg-teal-400/20 dark:bg-teal-300/10 rounded-full"
          animate={{
            x: [0, 8, 0],
            opacity: [0.2, 0.7, 0.2]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <div className="flex justify-between items-center mb-6 relative z-10">
          <motion.div
            className="flex items-center space-x-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <motion.div
              className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              animate={{
                boxShadow: [
                  "0 4px 20px rgba(34, 197, 94, 0.3)",
                  "0 4px 20px rgba(16, 185, 129, 0.3)",
                  "0 4px 20px rgba(34, 197, 94, 0.3)"
                ]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.span
                className="text-white text-xl"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🚀
              </motion.span>
            </motion.div>
            <div>
              <motion.h2
                className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Join Us
              </motion.h2>
              <motion.p
                className="text-sm text-gray-500 dark:text-gray-400"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Create your account
              </motion.p>
            </div>
          </motion.div>
          <motion.button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            ×
          </motion.button>
        </div>

        {error && (
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
              <p className="text-red-800 dark:text-red-300 text-sm font-medium">Registration Failed</p>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </motion.div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name
              </label>
              <motion.input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-gray-100 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="First name"
                whileFocus={{ scale: 1.02 }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name
              </label>
              <motion.input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-gray-100 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Last name"
                whileFocus={{ scale: 1.02 }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <motion.input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 focus:bg-white dark:focus:bg-gray-600 text-gray-900 dark:text-gray-100 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Choose a username"
              whileFocus={{ scale: 1.02 }}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pr-10"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Must be at least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                !passwordMatch ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Confirm your password"
            />
            {!passwordMatch && formData.confirmPassword && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={loading || !passwordMatch}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 text-white py-3 px-4 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 dark:hover:from-green-800 dark:hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shadow-lg"
            whileHover={{
              scale: loading || !passwordMatch ? 1 : 1.02,
              boxShadow: loading || !passwordMatch ? undefined : "0 10px 25px rgba(34, 197, 94, 0.3)",
            }}
            whileTap={{ scale: loading || !passwordMatch ? 1 : 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? (
              <motion.div
                className="flex items-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating Account...</span>
              </motion.div>
            ) : (
              <motion.div
                className="flex items-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🎉
                </motion.span>
                <span>Create Account</span>
              </motion.div>
            )}
          </motion.button>
        </form>

        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Already have an account?{' '}
            <motion.button
              onClick={onSwitchToLogin}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Login here
            </motion.button>
          </p>
        </motion.div>

        {/* Welcome Info Box */}
        <motion.div
          className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <div className="flex items-start space-x-3">
            <motion.span
              className="text-green-600 dark:text-green-400 text-lg"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              🎉
            </motion.span>
            <div>
              <p className="text-green-800 dark:text-green-300 text-sm font-medium mb-1">Join Our Community</p>
              <p className="text-green-700 dark:text-green-400 text-xs">
                Get access to AI-powered math solutions, image processing features, and more!
                Your account gives you full access to all premium features.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Features Preview */}
        <motion.div
          className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <h4 className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-2">✨ What you'll get:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-blue-600 dark:text-blue-400">🧮</span>
              <span className="text-blue-700 dark:text-blue-400">AI Math Solver</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-blue-600 dark:text-blue-400">📸</span>
              <span className="text-blue-700 dark:text-blue-400">Image Processing</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-blue-600 dark:text-blue-400">🔒</span>
              <span className="text-blue-700 dark:text-blue-400">Secure Storage</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-blue-600 dark:text-blue-400">⚡</span>
              <span className="text-blue-700 dark:text-blue-400">Fast Results</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export default Register
