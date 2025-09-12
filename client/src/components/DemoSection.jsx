import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTheme from '../context/ThemeContext'

const DemoSection = ({ onSampleSelect }) => {
  const [showDemo, setShowDemo] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProblem, setCurrentProblem] = useState('')
  const [currentSolution, setCurrentSolution] = useState('')
  const [showSolution, setShowSolution] = useState(false)
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

  const handleSampleClick = async (sample) => {
    setSelectedSample(sample.id)
    setIsProcessing(true)
    setCurrentProblem(sample.text)
    setCurrentSolution('')
    setShowSolution(false)

    try {
      const result = await onSampleSelect(sample.text)
      if (result && result.solution) {
        setCurrentSolution(result.solution)
        // Delay showing solution for better UX
        setTimeout(() => {
          setShowSolution(true)
        }, 500)
      }
    } catch (error) {
      console.error('Error processing sample:', error)
      setCurrentSolution('Error processing the sample. Please try again.')
      setShowSolution(true)
    } finally {
      setIsProcessing(false)
      // Reset selection after animation
      setTimeout(() => {
        setSelectedSample(null)
      }, 2000)
    }
  }

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-600'
      case 'Medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600'
      case 'Hard':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-600'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600'
    }
  }

  const formatSolution = (solution) => {
    if (!solution) return []

    const lines = solution.split('\n')
    const formattedElements = []
    let stepCounter = 0

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        formattedElements.push(<div key={`br-${index}`} className="h-2" />)
        return
      }

      // Check for step numbers (1., 2., etc.)
      if (/^\d+\.\s/.test(trimmedLine)) {
        stepCounter++
        const stepText = trimmedLine.replace(/^\d+\.\s/, '')
        formattedElements.push(
          <motion.div
            key={index}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 my-4 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: stepCounter * 0.1 }}
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {stepCounter}
              </div>
              <div className="flex-1">
                <strong className="text-blue-800 dark:text-blue-300 text-lg">{processInlineFormatting(stepText)}</strong>
              </div>
            </div>
          </motion.div>
        )
        return
      }

      // Check for section headers (ending with :)
      if (/^[A-Z].*:$/.test(trimmedLine)) {
        const headerText = trimmedLine.replace(/:$/, '')
        formattedElements.push(
          <motion.div
            key={index}
            className="mt-6 mb-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full"></div>
              <h5 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                {headerText}
              </h5>
            </div>
          </motion.div>
        )
        return
      }

      // Check for bullet points
      if (/^[-•]\s/.test(trimmedLine)) {
        const bulletText = trimmedLine.replace(/^[-•]\s/, '')
        formattedElements.push(
          <motion.div
            key={index}
            className="flex items-start space-x-3 my-2 pl-4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mt-2"></div>
            <span className="text-gray-700 dark:text-gray-300">{processInlineFormatting(bulletText)}</span>
          </motion.div>
        )
        return
      }

      // Check for final answers (x = something)
      if (/[a-z]\s*=\s*[0-9\-+*/\s]+/.test(trimmedLine)) {
        formattedElements.push(
          <motion.div
            key={index}
            className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-600 rounded-xl p-4 my-4 shadow-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <div>
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">Final Answer</div>
                <strong className="text-green-700 dark:text-green-300 text-xl font-mono">{trimmedLine}</strong>
              </div>
            </div>
          </motion.div>
        )
        return
      }

      // Process line for inline formatting
      const processedLine = processInlineFormatting(trimmedLine)
      formattedElements.push(
        <motion.div
          key={index}
          className="my-2 text-gray-700 dark:text-gray-300 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 * index }}
        >
          {processedLine}
        </motion.div>
      )
    })

    return formattedElements
  }

  const processInlineFormatting = (text) => {
    const parts = []
    let currentIndex = 0

    // Process **bold** text
    const boldRegex = /\*\*(.*?)\*\*/g
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index)
        parts.push(processEquations(beforeText))
      }

      // Add the bold text
      parts.push(
        <motion.strong
          key={`bold-${match.index}`}
          className="text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {match[1]}
        </motion.strong>
      )

      currentIndex = match.index + match[0].length
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(processEquations(text.slice(currentIndex)))
    }

    return parts.length > 0 ? parts : processEquations(text)
  }

  const processEquations = (text) => {
    // Look for various mathematical expressions
    const patterns = [
      // Variables with operations: x = 5, 2x + 3, etc.
      /([a-z]\s*[=+\-*/]\s*[0-9a-z\s+\-*/()]+)/g,
      // Standalone equations: 2x + 5 = 13
      /(\d+[a-z]\s*[+\-]\s*\d+\s*=\s*\d+)/g,
      // Fractions and complex expressions
      /(\d+\/\d+|\([^)]+\))/g,
      // Mathematical functions: sin(30°), cos(60°)
      /(sin|cos|tan|log)\([^)]+\)/g
    ]

    const parts = []
    let lastIndex = 0

    // Combine all patterns and find matches
    const allMatches = []
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        allMatches.push({
          match: match[0],
          index: match.index,
          length: match[0].length
        })
      }
    })

    // Sort matches by index to process them in order
    allMatches.sort((a, b) => a.index - b.index)

    // Remove overlapping matches
    const uniqueMatches = []
    allMatches.forEach(current => {
      const hasOverlap = uniqueMatches.some(existing =>
        (current.index >= existing.index && current.index < existing.index + existing.length) ||
        (existing.index >= current.index && existing.index < current.index + current.length)
      )
      if (!hasOverlap) {
        uniqueMatches.push(current)
      }
    })

    uniqueMatches.forEach((matchObj, i) => {
      // Add text before the equation
      if (matchObj.index > lastIndex) {
        parts.push(text.slice(lastIndex, matchObj.index))
      }

      // Add the equation with highlighting
      parts.push(
        <motion.code
          key={`eq-${i}`}
          className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 px-3 py-1.5 rounded-lg text-purple-700 dark:text-purple-300 font-mono mx-1 border border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-all"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i, type: "spring", stiffness: 300 }}
        >
          {matchObj.match}
        </motion.code>
      )

      lastIndex = matchObj.index + matchObj.length
    })

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/30 p-8 border border-gray-200 dark:border-gray-700 mb-8"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header Section */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <motion.h2
          className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent mb-3"
          whileHover={{ scale: 1.05 }}
        >
          Try Our AI Demo
        </motion.h2>
        <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
          Experience our AI-powered math solver with these sample problems.
        </p>
        <motion.p
          className="text-green-600 dark:text-green-400 font-semibold"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          No login required for demo!
        </motion.p>
      </motion.div>

      {/* Demo Controls */}
      <motion.div
        className="flex flex-col lg:flex-row gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {/* Left Panel - Demo Button */}
        <motion.div
          className="lg:w-1/2 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center space-x-4 mb-4">
            <motion.div
              className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-white text-2xl">🚀</span>
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Try Our Demo</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Click any problem to see AI in action</p>
            </div>
          </div>

          <motion.button
            onClick={() => setShowDemo(!showDemo)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>{showDemo ? '🔼' : '🔽'}</span>
            <span>{showDemo ? 'Hide Demo' : 'Show Demo'}</span>
          </motion.button>
        </motion.div>

        {/* Right Panel - Benefits */}
        <motion.div
          className="lg:w-1/2 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-2xl">✨</span>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">What You Get With Login</h3>
          </div>

          <ul className="space-y-2">
            {[
              'Camera capture for real-time problem solving',
              'Upload images from your device',
              'Save and access your solution history',
              'Advanced OCR with higher accuracy',
              'Priority AI processing'
            ].map((feature, index) => (
              <motion.li
                key={index}
                className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
              >
                <span className="text-green-500 dark:text-green-400">●</span>
                <span>{feature}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </motion.div>

      {/* Demo Problems Grid */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                ✨ <strong>Experience Scanova's AI Power:</strong> Click any problem below to see instant step-by-step solutions!
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sampleProblems.map((sample, index) => (
                <motion.div
                  key={sample.id}
                  onClick={() => handleSampleClick(sample)}
                  className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-300 group ${
                    selectedSample === sample.id
                      ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20 scale-105'
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Display */}
      {(currentProblem || currentSolution || isProcessing) && (
        <motion.div
          className="mt-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900/50 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-700 shadow-lg backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">🤖</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-blue-800 dark:text-blue-300">AI Math Solver</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400">Powered by Gemini AI</p>
              </div>
            </div>
            {currentSolution && (
              <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Solution Ready</span>
              </div>
            )}
          </div>

          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 dark:border-blue-800"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 dark:border-blue-400 border-t-transparent absolute top-0 left-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl animate-pulse">🤖</span>
                </div>
              </div>
              <div className="mt-6 text-center">
                <div className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  AI is solving your problem...
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
                  Analyzing • Processing • Generating solution
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {currentProblem && (
                <div>
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center space-x-2">
                    <span className="text-lg">📝</span>
                    <span>Problem Statement</span>
                  </h4>
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-700 shadow-sm">
                    <div className="text-lg font-mono text-amber-800 dark:text-amber-300 whitespace-pre-wrap leading-relaxed">
                      {currentProblem}
                    </div>
                  </div>
                </div>
              )}

              {currentProblem && currentSolution && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent flex-1 w-20"></div>
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
                      <span className="text-blue-600 dark:text-blue-400">⬇️</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent flex-1 w-20"></div>
                  </div>
                </div>
              )}

              {currentSolution && showSolution && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <motion.h4
                      className="font-bold text-blue-800 dark:text-blue-300 flex items-center space-x-3"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white text-xl">🎯</span>
                      </div>
                      <div>
                        <div className="text-xl">AI Solution</div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-normal">Step-by-step breakdown</div>
                      </div>
                    </motion.h4>
                    <motion.button
                      onClick={() => {
                        navigator.clipboard.writeText(currentSolution)
                        // Create a better notification
                        const notification = document.createElement('div')
                        notification.textContent = '✅ Copied to clipboard!'
                        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
                        document.body.appendChild(notification)
                        setTimeout(() => document.body.removeChild(notification), 2000)
                      }}
                      className="group bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="group-hover:animate-bounce">📋</span>
                      <span className="font-medium">Copy Solution</span>
                    </motion.button>
                  </div>

                  <div className="bg-gradient-to-br from-white via-blue-50/50 to-indigo-50 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/20 rounded-2xl p-8 border-2 border-blue-200 dark:border-blue-600 shadow-xl backdrop-blur-sm">
                    {/* Progress indicator */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Solution Progress</span>
                        <span className="text-sm text-blue-600 dark:text-blue-400">100%</span>
                      </div>
                      <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2">
                        <motion.div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    <div className="prose prose-lg max-w-none">
                      <div className="leading-relaxed space-y-1">
                        {formatSolution(currentSolution)}
                      </div>
                    </div>

                    {/* Solution footer */}
                    <div className="mt-8 pt-6 border-t border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span>Solution verified by AI</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>⚡</span>
                          <span>Powered by Gemini AI</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

export default DemoSection