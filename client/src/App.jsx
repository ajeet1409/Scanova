import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ImageUpload from "./components/ImageUpload";
import DemoSection from "./components/DemoSection";
import Instructions from "./components/Instructions";
import AuthPrompt from "./components/AuthPrompt";
import Chatbot from "./components/Chatbot";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import PostLoginVerification from "./components/PostLoginVerification";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import axios from "axios";
import { ThemeProvider } from "./context/ThemeContext";

// Main App Content Component
function AppContent() {
  const [extractedText, setExtractedText] = useState("");
  const [aiSolution, setAiSolution] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { isAuthenticated, needsTurnstileVerification, user, completeVerification } = useAuth();
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("themeMode") || "light"
  );

  // Modal handlers
  const handleLoginClick = () => {
    setShowLogin(true);
    setShowRegister(false);
  };

  const handleRegisterClick = () => {
    setShowRegister(true);
    setShowLogin(false);
  };

  const handleCloseModals = () => {
    setShowLogin(false);
    setShowRegister(false);
  };

  const handleVerificationComplete = () => {
    completeVerification();
  };

  const handleSampleSelect = useCallback(async (sampleText) => {
    setExtractedText(sampleText);

    try {
      console.log("Processing sample text:", sampleText);
      const apiUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/process-text`;
      console.log("API URL:", apiUrl);

      const response = await axios.post(
        apiUrl,
        {
          text: sampleText,
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log("API Response:", response.data);
      setAiSolution(response.data.solution);
      return { solution: response.data.solution };
    } catch (error) {
      console.error("Error processing sample:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      let errorMessage = "Error processing the sample. Please try again.";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setAiSolution(errorMessage);
      return { solution: errorMessage };
    }
  }, []);

  const lightMode = () => {
    setThemeMode("light");
  };
  const darkMode = () => {
    setThemeMode("dark");
  };

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", themeMode);

    // Apply dark class to html element for Tailwind dark mode
    if (themeMode === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [themeMode]);

  return (
    <ThemeProvider value={{themeMode, lightMode, darkMode }}>
      {/* Turnstile Verification Modal */}
      <AnimatePresence>
        {needsTurnstileVerification && (
          <PostLoginVerification
            isOpen={needsTurnstileVerification}
            onVerificationComplete={handleVerificationComplete}
            user={user}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Navbar
          onLoginClick={handleLoginClick}
          onRegisterClick={handleRegisterClick}
        />

        {/* Add top padding to account for fixed navbar */}
        <div className="container mx-auto px-4 py-8 pt-24">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.h1
              className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Scanova - AI-Powered Content Analysis
            </motion.h1>
            <motion.p
              className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              Analyze any text content instantly with Scanova's AI intelligence.
              Upload an image to extract text, questions, or problems
              and get AI-powered analysis with detailed explanations and insights.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Instructions />
          </motion.div>

          <AnimatePresence mode="wait">
            {isAuthenticated ? (
              <motion.div
                key="authenticated"
                className="max-w-6xl mx-auto space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {/* Image Upload Section */}
                <motion.div
                  key="upload-method"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <ImageUpload
                      onTextExtracted={setExtractedText}
                      onSolutionGenerated={setAiSolution}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="unauthenticated"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="max-w-6xl mx-auto"
              >
                <DemoSection onSampleSelect={handleSampleSelect} />
                <AuthPrompt />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <Footer />

        {/* Scroll to Top Button */}
        <ScrollToTop />

        {/* Login Modal */}
        <AnimatePresence>
          {showLogin && (
            <Login
              onClose={handleCloseModals}
              onSwitchToRegister={handleRegisterClick}
            />
          )}
        </AnimatePresence>

        {/* Register Modal */}
        <AnimatePresence>
          {showRegister && (
            <Register
              onClose={handleCloseModals}
              onSwitchToLogin={handleLoginClick}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </ThemeProvider>
  );
}

// Main App Component with AuthProvider
function App() {
  return (
    <AuthProvider>

        <AppContent />

        {/* Chatbot - Available on all pages */}
        <Chatbot />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 1300,
            style: {
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              borderRadius: "12px",
              padding: "16px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
            },
            success: {
              style: {
                background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
              },
              iconTheme: {
                primary: "#fff",
                secondary: "#22c55e",
              },
            },
            error: {
              style: {
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              },
              iconTheme: {
                primary: "#fff",
                secondary: "#dc2626",
              },
            },
            loading: {
              style: {
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              },
            },
          }}
        />
 
    </AuthProvider>
  );
}

export default App;
