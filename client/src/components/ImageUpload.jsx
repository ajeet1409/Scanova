import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import "../styles/markdown.css";
import MobileCamera from "./MobileCamera";
import SimpleMobileCamera from "./SimpleMobileCamera";

const ImageUpload = ({ onTextExtracted, onSolutionGenerated }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [editedText, setEditedText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [aiSolution, setAiSolution] = useState("");
  const [displayedSolution, setDisplayedSolution] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const solutionContainerRef = useRef(null);

  // Typing effect states
  const [fullResponse, setFullResponse] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const typingIntervalRef = useRef(null);

  // Tab system for mobile camera
  const [activeTab, setActiveTab] = useState("upload");
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Typing effect function
  const startTypingEffect = (text) => {
    setFullResponse(text);
    setTypingIndex(0);
    setDisplayedSolution("");
    setIsTyping(true);

    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    let currentIndex = 0;
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < text.length) {
        let nextIndex;

        // Adaptive typing speed based on content length
        if (text.length > 1000) {
          // For very long responses, type whole words at once
          const remainingText = text.substring(currentIndex);
          const nextSpaceIndex = remainingText.indexOf(' ');
          const nextWordEnd = nextSpaceIndex === -1 ? remainingText.length : nextSpaceIndex + 1;
          nextIndex = Math.min(currentIndex + Math.max(nextWordEnd, 5), text.length);
        } else if (text.length > 500) {
          // For long responses, type 4-5 characters at once
          nextIndex = Math.min(currentIndex + 4, text.length);
        } else if (text.length > 200) {
          // For medium responses, type 2-3 characters at once
          nextIndex = Math.min(currentIndex + 2, text.length);
        } else {
          // For short responses, type 1 character at a time
          nextIndex = currentIndex + 1;
        }

        setDisplayedSolution(text.substring(0, nextIndex));
        setTypingIndex(nextIndex);
        currentIndex = nextIndex;

        // Auto-scroll during typing
        if (solutionContainerRef.current) {
          solutionContainerRef.current.scrollTop = solutionContainerRef.current.scrollHeight;
        }
      } else {
        // Typing complete
        clearInterval(typingIntervalRef.current);
        setIsTyping(false);
        setAiSolution(text);
        onSolutionGenerated?.(text);
      }
    }, 3); // 3ms interval for ultra-fast typing effect
  };

  // Auto-scroll to bottom when new content is added during streaming
  useEffect(() => {
    if (isTyping && solutionContainerRef.current) {
      solutionContainerRef.current.scrollTop = solutionContainerRef.current.scrollHeight;
    }
  }, [displayedSolution, isTyping]);

  // Cleanup typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExtractedText("");
      setEditedText("");
      setIsEditing(false);
      setAiSolution("");
      setDisplayedSolution("");
      setIsTyping(false);
      setError("");

      // Clear typing effect states
      setFullResponse("");
      setTypingIndex(0);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      // Automatically start processing
      await processImage(file);
    }
  };

  const processImage = async (file) => {
    setIsProcessing(true);
    setError("");

    try {
      // Extract text using OCR
      const { data: { text } } = await Tesseract.recognize(file, "eng");

      if (text.trim()) {
        const cleanText = text.trim();
        setExtractedText(cleanText);
        setEditedText(cleanText);
        onTextExtracted?.(cleanText);

        // Generate solution
        await generateAISolution(cleanText);
      } else {
        setError("No text found in image");
      }
    } catch (err) {
      setError("Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAISolution = async (text) => {
    // Clear previous content and prepare for typing effect
    setDisplayedSolution("");
    setAiSolution("");
    setError("");

    // Clear any existing typing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/stream-solution`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // No skeleton - start showing stream content immediately

      try {
        let accumulatedText = '';

        // Collect full response from stream, then start typing effect
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Streaming complete - now start typing effect
            startTypingEffect(accumulatedText);
            break;
          }

          // Decode chunk and accumulate (don't display yet)
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            accumulatedText += chunk;
          }
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        setError("Streaming interrupted");
        setIsTyping(false);
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Streaming error:', error);

      // Fallback to regular API if streaming fails
      try {
        console.log('Falling back to regular API...');
        const fallbackUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/process-text`;

        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ text })
        });

        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          if (data.success && data.solution) {
            // Use typing effect for fallback API response too
            startTypingEffect(data.solution);
            return;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback API also failed:', fallbackError);
      }

      setError("Failed to generate solution");
      setIsTyping(false);
    }
  };



  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleEditText = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsEditing(false);
    setExtractedText(editedText);
    onTextExtracted?.(editedText);

    // Reset typing states
    setDisplayedSolution("");
    setIsTyping(false);

    // Regenerate solution with edited text
    if (editedText.trim()) {
      await generateAISolution(editedText);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText(extractedText);
  };



  const enhanceMarkdownSolution = (solution) => {
    if (!solution) return solution;

    // Return clean solution without HTML injection
    return solution;
  };

  // Custom markdown components with enhanced styling
  const markdownComponents = {
    h1: ({ children }) => (
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 border-b-2 border-blue-500 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }) => {
      const text = children?.toString() || '';

      // Check if this is a solution section
      if (text.includes('Solution') || text.includes('Answer') || text.includes('Summary')) {
        return (
          <h2 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-3 bg-green-100 dark:bg-green-900/30 p-3 rounded-lg border-l-4 border-green-500">
            {children}
          </h2>
        );
      }

      return (
        <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-3">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => (
      <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
        {children}
      </h3>
    ),
    p: ({ children }) => {
      const text = children?.toString() || '';

      // Check if this paragraph contains a question
      if (text.includes('?')) {
        return (
          <div className="question-text">
            {children}
          </div>
        );
      }

      // Check if this paragraph contains a final answer or solution with enhanced green highlighting
      if (text.includes('Final Answer') || text.includes('Answer:') || text.includes('Solution:') ||
          text.includes('Therefore') || text.includes('Result:') || text.includes('Conclusion:')) {
        return (
          <div className="main-solution-highlight">
            {children}
          </div>
        );
      }

      // Regular paragraph
      return (
        <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
          {children}
        </p>
      );
    },
    strong: ({ children }) => {
      const text = children?.toString() || '';

      // Check if this is a final answer or solution with enhanced highlighting
      if (text.includes('Final Answer') || text.includes('Answer') || text.includes('Solution') ||
          text.includes('Therefore') || text.includes('Result') || text.includes('Conclusion')) {
        return (
          <strong className="font-bold text-white bg-green-600 dark:bg-green-700 px-2 py-1 rounded-md shadow-sm">
            {children}
          </strong>
        );
      }

      // Regular bold text
      return (
        <strong className="font-bold text-blue-800 dark:text-blue-200">
          {children}
        </strong>
      );
    },
    em: ({ children }) => (
      <em className="italic text-purple-700 dark:text-purple-300">
        {children}
      </em>
    ),
    code: ({ children, inline }) => (
      inline ? (
        <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono text-red-600 dark:text-red-400">
          {children}
        </code>
      ) : (
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4">
          <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
            {children}
          </code>
        </pre>
      )
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="mb-1">
        {children}
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300">
        {children}
      </blockquote>
    )
  };

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Camera Full-Screen Mode */}
      {isMobile && activeTab === "camera" ? (
        <motion.div
          className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-black to-gray-900"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Camera Header */}
          <div className="absolute top-0 left-0 right-0 z-60 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 pt-8">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("upload")}
                className="camera-overlay camera-button-hover bg-white/20 text-white px-6 py-3 rounded-full border border-white/30 hover:bg-white/30 transition-all duration-200 shadow-lg"
              >
                <span className="flex items-center gap-2">
                  ← Back to Upload
                </span>
              </button>
              <h2 className="text-white font-bold text-xl bg-black/30 px-4 py-2 rounded-full">
                📱 Live Scanner
              </h2>
              <div className="w-32"></div> {/* Spacer for centering */}
            </div>
            <div className="text-center mt-2">
              <p className="text-white/80 text-sm">
                Point your camera at any document for instant text extraction
              </p>
            </div>
          </div>

          {/* Full-Screen Camera */}
          <div className="h-full pt-24 pb-4 px-4">
            <div className="h-full max-w-4xl mx-auto">
              <MobileCamera
                onTextExtracted={(text) => {
                  setExtractedText(text);
                  setEditedText(text);
                  onTextExtracted?.(text);
                }}
                onSolutionGenerated={(solution) => {
                  startTypingEffect(solution);
                }}
              />
            </div>
          </div>
        </motion.div>
      ) : (
        /* Regular Layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <motion.div
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Tab Navigation - Show only on mobile */}
            {isMobile && (
              <div className="flex mb-6 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-1 shadow-inner">
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === "upload"
                      ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-lg transform scale-105"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    📁 Upload File
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("camera")}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === "camera"
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    📱 Live Camera
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </span>
                </button>
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              Upload Image
            </h2>

            {/* File Upload Interface */}
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300">
              <div className="text-center">
                <div className="text-3xl mb-2">📁</div>
                <span className="text-gray-600 dark:text-gray-400">
                  Click to Upload
                </span>
                {isMobile && (
                  <div className="text-xs text-gray-500 mt-1">
                    Or use Camera tab for live capture
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

          {/* Image Preview */}
          {previewUrl && (
            <motion.div
              className="mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-48 object-contain rounded-lg border"
              />
            </motion.div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <motion.div
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400">Processing Image...</p>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                Extracting text and generating AI solution
              </div>
            </motion.div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
            </motion.div>
          )}
          </motion.div>

          {/* Results Section - Show when processing or text is extracted */}
          {(extractedText || isProcessing) ? (
          <motion.div
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              Results
            </h2>

          {/* Extracted Text Skeleton Loading */}
          {isProcessing && !extractedText && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Extracted Text
                </h3>
                <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-8 rounded"></div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Extracted Text */}
          {extractedText && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Extracted Text
                </h3>
                <div className="flex space-x-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={handleEditText}
                        className="text-sm text-green-600 hover:text-green-700 dark:text-green-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => copyToClipboard(extractedText)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="text-sm text-green-600 hover:text-green-700 dark:text-green-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!isEditing ? (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border max-h-32 overflow-y-auto">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {extractedText}
                  </pre>
                </div>
              ) : (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-32 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Edit the extracted text..."
                />
              )}
            </motion.div>
          )}



          {/* AI Solution - Direct Stream Response */}
          {(displayedSolution || isTyping) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                  <span className="mr-2">🤖</span>
                  AI Solution
                  {isTyping && (
                    <span className="ml-2 flex items-center text-blue-500">
                      <span className="inline-block w-2 h-4 bg-blue-500 animate-blink mr-1"></span>
                      <span className="text-xs animate-pulse">Typing response...</span>
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => copyToClipboard(aiSolution || displayedSolution)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  disabled={isTyping}
                >
                  Copy
                </button>
              </div>
              <div
                ref={solutionContainerRef}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700 max-h-96 overflow-y-auto shadow-inner"
              >
                <div className="markdown-solution prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={markdownComponents}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {enhanceMarkdownSolution(displayedSolution)}
                  </ReactMarkdown>
                  {isTyping && (
                    <span className="inline-block w-2 h-5 bg-blue-500 dark:bg-blue-400 animate-blink ml-1 align-text-bottom"></span>
                  )}
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  🔴 Questions in Red • 🟢 Solutions in Green • ✨ Markdown Formatted
                  {isTyping && " • ⌨️ Typing Effect"}
                </span>
              </div>
            </motion.div>
          )}
          </motion.div>
        ) : (
          <motion.div
            className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-500 dark:text-gray-400">
                Upload an image to see extracted text and Solution
              </p>
            </div>
          </motion.div>
        )}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
