import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Login from './Login'
import Register from './Register'

const AuthPrompt = () => {
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  const handleLoginClick = useCallback(() => {
    setShowLogin(true)
    setShowRegister(false)
  }, [])

  const handleRegisterClick = useCallback(() => {
    setShowRegister(true)
    setShowLogin(false)
  }, [])

  const handleCloseModals = useCallback(() => {
    setShowLogin(false)
    setShowRegister(false)
  }, [])

  return (
    <motion.div
      className="max-w-6xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Authentication Required Notice */}
      <motion.div
        className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 dark:from-blue-800 dark:via-purple-800 dark:to-indigo-900 rounded-2xl shadow-2xl dark:shadow-gray-900/50 p-8 mb-8 text-white overflow-hidden border dark:border-gray-700"
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, type: "spring", stiffness: 100 }}
        whileHover={{
          scale: 1.02,
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)"
        }}
      >
        {/* Animated background elements */}
        <motion.div
          className="absolute top-0 left-0 w-full h-full opacity-10"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, #ffffff 0%, transparent 50%)",
              "radial-gradient(circle at 40% 50%, #ffffff 0%, transparent 50%)"
            ]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating particles */}
        <motion.div
          className="absolute top-4 right-4 w-2 h-2 bg-white rounded-full opacity-60"
          animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-6 left-6 w-1 h-1 bg-white rounded-full opacity-40"
          animate={{ y: [0, -8, 0], x: [0, -3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-8 w-1.5 h-1.5 bg-white rounded-full opacity-50"
          animate={{ y: [0, -6, 0], x: [0, 4, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <div className="text-center relative z-10">
          <motion.div
            className="text-7xl mb-6 inline-block"
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.1, 1],
              filter: ["drop-shadow(0 0 0px rgba(255,255,255,0.5))", "drop-shadow(0 0 20px rgba(255,255,255,0.8))", "drop-shadow(0 0 0px rgba(255,255,255,0.5))"]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            whileHover={{
              scale: 1.2,
              rotate: 15,
              transition: { duration: 0.3 }
            }}
          >
            🔐
          </motion.div>
          <motion.h2
            className="text-4xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
          >
            Authentication Required
          </motion.h2>
          <motion.p
            className="text-xl mb-8 opacity-95 leading-relaxed max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, type: "spring" }}
          >
            Unlock the full potential of our AI-powered math solver! Log in to access camera capture, file uploads, and advanced features.
          </motion.p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl mb-2">📷</div>
              <h3 className="font-semibold mb-2">Camera Capture</h3>
              <p className="text-sm opacity-80">
                Use your device camera to capture math problems directly
              </p>
            </div>
            
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl mb-2">📁</div>
              <h3 className="font-semibold mb-2">File Upload</h3>
              <p className="text-sm opacity-80">
                Upload images with mathematical problems for AI analysis
              </p>
            </div>
          </div>

          <motion.div
            className="flex flex-col sm:flex-row gap-6 justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, type: "spring" }}
          >
            <motion.button
              onClick={handleRegisterClick}
              className="relative bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg shadow-lg overflow-hidden group"
              whileHover={{
                scale: 1.05,
                boxShadow: "0 15px 35px rgba(255, 255, 255, 0.3)",
                y: -2
              }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.3 }}
              />
              <div className="relative flex items-center justify-center">
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl mr-3"
                >
                  🚀
                </motion.span>
                <span>Sign Up Free</span>
              </div>
            </motion.button>

            <motion.button
              onClick={handleLoginClick}
              className="relative border-2 border-white text-white px-10 py-4 rounded-xl font-bold text-lg backdrop-blur-sm overflow-hidden group"
              whileHover={{
                scale: 1.05,
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                borderColor: "#ffffff",
                boxShadow: "0 15px 35px rgba(255, 255, 255, 0.2)",
                y: -2
              }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.3 }}
              />
              <div className="relative flex items-center justify-center">
                <motion.span
                  animate={{
                    y: [0, -3, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-2xl mr-3"
                >
                  🔑
                </motion.span>
                <span>Login</span>
              </div>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div
        className="text-center bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl dark:shadow-gray-900/50 p-10 border border-blue-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        whileHover={{
          boxShadow: "0 30px 60px rgba(59, 130, 246, 0.15)",
          y: -5
        }}
      >
        <motion.h3
          className="text-3xl font-bold text-gray-800 dark:text-white mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
        >
          Ready to Unlock Full Features?
        </motion.h3>
        <motion.p
          className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          Join thousands of students already using our AI-powered math solver!
          <br />
          <span className="text-blue-600 dark:text-blue-400 font-semibold">Create your free account to access camera capture, file uploads, and save your work.</span>
        </motion.p>
        <motion.div
          className="flex flex-col sm:flex-row gap-6 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.5 }}
        >
          <motion.button
            onClick={handleRegisterClick}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg dark:shadow-blue-900/50"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 15px 35px rgba(59, 130, 246, 0.3)",
              background: "linear-gradient(to right, #2563eb, #4f46e5)"
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <span className="mr-3">🚀</span>
            Get Started Free
          </motion.button>
          <motion.button
            onClick={handleLoginClick}
            className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 15px 35px rgba(59, 130, 246, 0.2)"
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <span className="mr-3">🔑</span>
            Already Have Account?
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Authentication Modals */}
      {showLogin && (
        <Login
          onSwitchToRegister={handleRegisterClick}
          onClose={handleCloseModals}
        />
      )}

      {showRegister && (
        <Register
          onSwitchToLogin={handleLoginClick}
          onClose={handleCloseModals}
        />
      )}
    </motion.div>
  )
}

export default AuthPrompt
