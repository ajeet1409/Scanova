import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTheme from '../context/ThemeContext'

const TestSamples = ({ onSampleSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const { themeMode } = useTheme()

  const sampleProblems = [
    {
      id: 1,
      title: "Basic Algebra",
      text: "Solve for x: 2x + 5 = 13",
      description: "Simple linear equation",
      icon: "🔢",
      difficulty: "Easy",
      category: "Algebra"
    },
    {
      id: 2,
      title: "Quadratic Equation",
      text: "Solve: x² - 5x + 6 = 0",
      description: "Factoring quadratic equation",
      icon: "📈",
      difficulty: "Medium",
      category: "Algebra"
    },
    {
      id: 3,
      title: "Calculus - Derivative",
      text: "Find the derivative of f(x) = 3x² + 2x - 1",
      description: "Basic differentiation",
      icon: "📊",
      difficulty: "Medium",
      category: "Calculus"
    },
    {
      id: 4,
      title: "Geometry",
      text: "Find the area of a circle with radius 5 cm",
      description: "Circle area calculation",
      icon: "⭕",
      difficulty: "Easy",
      category: "Geometry"
    },
    {
      id: 5,
      title: "System of Equations",
      text: "Solve the system:\n2x + y = 7\nx - y = 2",
      description: "Linear system solving",
      icon: "🔗",
      difficulty: "Hard",
      category: "Algebra"
    },
    {
      id: 6,
      title: "Trigonometry",
      text: "Find sin(30°) + cos(60°)",
      description: "Basic trigonometric values",
      icon: "📐",
      difficulty: "Easy",
      category: "Trigonometry"
    }
  ]

  const handleSampleClick = (sample) => {
    setSelectedSample(sample.id)
    onSampleSelect(sample.text)

    // Reset selection after animation
    setTimeout(() => {
      setSelectedSample(null)
    }, 2000)
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700'
      case 'Medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700'
      case 'Hard':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
    }
  }

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="flex items-center space-x-3">
          <motion.div
            className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-white text-xl">🚀</span>
          </motion.div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Try Our Demo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Click any problem to see AI in action</p>
          </div>
        </div>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isOpen ? '🔼 Hide Demo' : '🔽 Show Demo'}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                ✨ <strong>Experience Scanova's AI Power:</strong> Click any problem below to see instant step-by-step solutions!
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleProblems.map((sample, index) => (
                <motion.div
                  key={sample.id}
                  onClick={() => handleSampleClick(sample)}
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 group ${
                    selectedSample === sample.id
                      ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20 scale-105'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-102'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Processing indicator */}
                  {selectedSample === sample.id && (
                    <motion.div
                      className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="w-3 h-3 bg-white rounded-full"
                        animate={{ scale: [1, 0.8, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      />
                    </motion.div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{sample.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {sample.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{sample.category}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getDifficultyColor(sample.difficulty)}`}>
                      {sample.difficulty}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{sample.description}</p>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {sample.text}
                    </pre>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Click to solve with AI</span>
                    <motion.div
                      className="text-blue-500 dark:text-blue-400"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      →
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h5 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Pro Tip</h5>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    You can also upload images containing handwritten or printed math problems.
                    Our advanced OCR will extract the text and AI will provide detailed step-by-step solutions!
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default TestSamples
