import { useEffect, useState } from 'react'

const Instructions = () => {
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("themeMode") || "light"
  )

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
        <span className="text-2xl mr-2">📚</span>
        How to Use This App
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📸</div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">1. Upload Image</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag & drop or click to upload an image containing any text content, questions, or problems.
          </p>
        </div>

        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">2. Extract Text</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Our OCR technology will automatically extract text from your image.
          </p>
        </div>

        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">3. Get AI Analysis</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gemini AI will analyze the extracted text and provide detailed explanations, solutions, or insights.
          </p>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">💡 Tips for Best Results:</h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Use clear, high-resolution images</li>
          <li>• Ensure good lighting and contrast</li>
          <li>• Keep text horizontal and readable</li>
          <li>• Works with math, science, language, and general text content</li>
        </ul>
      </div>
    </div>
  )
}

export default Instructions
