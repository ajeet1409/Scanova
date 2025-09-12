import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Turnstile } from '@marsidev/react-turnstile'
import axios from 'axios'
import useTheme from '../context/ThemeContext'

const PostLoginVerification = ({ isOpen, onVerificationComplete, user }) => {
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [step, setStep] = useState('checking') // 'checking', 'challenge', 'success'
  const [rayId, setRayId] = useState('')
  const { themeMode } = useTheme()

  // Cloudflare Turnstile site key
  const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

  // Check if we're in production and have proper Turnstile configuration
  const isProduction = import.meta.env.PROD
  const hasValidTurnstileKey = TURNSTILE_SITE_KEY && TURNSTILE_SITE_KEY !== 'your-site-key-here'

  // Fetch real Cloudflare Ray ID from headers
  const fetchRayId = async () => {
    try {
      // First, check if we have a stored Ray ID from recent requests
      const storedRayId = sessionStorage.getItem('cf-ray-id')
      if (storedRayId) {
        return storedRayId
      }

      // Try to get Ray ID from current page headers
      const response = await fetch(window.location.origin + '/health', {
        method: 'GET',
        cache: 'no-cache'
      })

      // Get Ray ID from Cloudflare headers
      const cfRayId = response.headers.get('cf-ray') ||
                     response.headers.get('CF-RAY') ||
                     response.headers.get('Cf-Ray')

      if (cfRayId) {
        // Store for future use
        sessionStorage.setItem('cf-ray-id', cfRayId)
        return cfRayId
      }

      // Alternative: Try to extract from browser's performance entries
      const entries = performance.getEntriesByType('navigation')
      if (entries.length > 0) {
        // Check if we can find Ray ID in server timing
        const serverTiming = entries[0].serverTiming
        if (serverTiming) {
          for (const timing of serverTiming) {
            if (timing.name.toLowerCase().includes('ray')) {
              return timing.description || timing.name
            }
          }
        }
      }

      // If no Ray ID available, return a placeholder
      return 'Not available'
    } catch (error) {
      console.log('Could not fetch Ray ID:', error)
      return 'Not available'
    }
  }

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setIsVerifying(false)
      setVerificationError('')
      setTurnstileToken('')

      // Fetch real Cloudflare Ray ID
      fetchRayId().then(id => setRayId(id))

      // Start with checking step
      setStep('checking')
      // After 2 seconds, show the challenge
      const timer = setTimeout(() => {
        setStep('challenge')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleTurnstileSuccess = (token) => {
    setTurnstileToken(token)
    setVerificationError('')
    handleVerifyAndProceed(token)
  }

  const handleTurnstileError = (error) => {
    console.error('Turnstile error:', error)

    // Check if it's a domain/configuration error
    if (!hasValidTurnstileKey) {
      setVerificationError('Security verification is not properly configured. Please contact support.')
    } else {
      setVerificationError('Verification failed. Please try again.')
    }
    setTurnstileToken('')
  }

  const handleVerifyAndProceed = async (token) => {
    setIsVerifying(true)
    setVerificationError('')

    try {
      // Verify the token with your backend
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/verify-turnstile`, {
        token: token
      }, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data.success) {
        // Update Ray ID if provided by backend
        if (response.data.rayId) {
          setRayId(response.data.rayId)
          sessionStorage.setItem('cf-ray-id', response.data.rayId)
        }

        setStep('success')
        // Store verification status
        const verificationData = {
          verified: true,
          timestamp: Date.now(),
          expiresIn: 30 * 60 * 1000 // 30 minutes
        }
        localStorage.setItem('turnstileVerification', JSON.stringify(verificationData))

        // Complete verification immediately without redirect
        setTimeout(() => {
          onVerificationComplete()
        }, 1000)
      } else {
        setVerificationError('Verification failed. Please try again.')
        setStep('challenge')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationError('Verification failed. Please try again.')
      setStep('challenge')
    } finally {
      setIsVerifying(false)
    }
  }

  if (!isOpen) return null

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col items-center justify-center min-h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-md w-full mx-4 text-center">
          {/* Site Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Scanova
            </h1>
            <h2 className="text-xl text-gray-600 dark:text-gray-400">
              {step === 'checking' && 'Checking if the site connection is secure'}
              {step === 'challenge' && 'Security verification required'}
              {step === 'success' && 'Verification complete'}
            </h2>
          </motion.div>

          {/* Content based on step */}
          <AnimatePresence mode="wait">
            {step === 'checking' && (
              <motion.div
                key="checking"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <motion.div
                  className="text-gray-700 dark:text-gray-300 text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  Scanova needs to review the security of your connection before proceeding.
                </motion.div>
                
                <motion.div
                  className="flex justify-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                >
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </motion.div>
              </motion.div>
            )}

            {step === 'challenge' && (
              <motion.div
                key="challenge"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <motion.div
                  className="text-gray-700 dark:text-gray-300 text-lg mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Please complete the security check to continue.
                </motion.div>

                {/* Error Message */}
                {verificationError && (
                  <motion.div
                    className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-red-800 dark:text-red-300 text-sm">{verificationError}</p>
                  </motion.div>
                )}

                {/* Turnstile Widget or Fallback */}
                <motion.div
                  className="flex justify-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-lg dark:shadow-gray-900/20">
                    {hasValidTurnstileKey ? (
                      <Turnstile
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={handleTurnstileSuccess}
                        onError={handleTurnstileError}
                        options={{
                          theme: themeMode === 'dark' ? 'dark' : 'light',
                          size: 'normal',
                          'refresh-expired': 'auto'
                        }}
                      />
                    ) : (
                      // Fallback when Turnstile is not properly configured
                      <div className="text-center space-y-4">
                        <div className="text-yellow-600 dark:text-yellow-400 text-sm">
                          ⚠️ Security verification temporarily unavailable
                        </div>
                        <button
                          onClick={() => {
                            // Skip verification in development or when misconfigured
                            setStep('success')
                            setTimeout(() => {
                              onVerificationComplete()
                            }, 1000)
                          }}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          Continue to Application
                        </button>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Development mode or configuration issue
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {isVerifying && (
                  <motion.div
                    className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span>Verifying...</span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <motion.div
                  className="text-green-600 dark:text-green-400 text-6xl"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  ✅
                </motion.div>
                
                <motion.div
                  className="text-gray-700 dark:text-gray-300 text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Verification successful! Welcome back!
                </motion.div>
                
                <motion.div
                  className="flex justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="animate-pulse text-blue-500 dark:text-blue-400">
                    Welcome back, {user?.firstName || user?.username || 'User'}!
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cloudflare Logo and Ray ID */}
          <motion.div
            className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
          >
            <div className="flex flex-col items-center space-y-4">
              {/* Cloudflare Logo */}
              <motion.div
                className="flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">CF</span>
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-wider">
                  CLOUDFLARE
                </span>
              </motion.div>
              
              {/* Ray ID */}
              <div className="text-xs text-gray-500 dark:text-gray-400 group relative">
                Ray ID:
                <button
                  className="font-mono hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer ml-1"
                  onClick={() => navigator.clipboard.writeText(rayId)}
                  title="Click to copy Ray ID"
                >
                  {rayId || 'Loading...'}
                </button>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none z-10">
                  Click to copy • Used for troubleshooting
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PostLoginVerification
