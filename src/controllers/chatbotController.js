const ChatConversation = require('../models/ChatConversation');
const geminiAI = require('../utils/geminiAI');
const { v4: uuidv4 } = require('uuid');

// Generate intelligent bot response function
async function generateBotResponse(userMessage, userId, conversation) {
  const message = userMessage.toLowerCase();
  const isAuthenticated = !!userId;

  // Get user info if authenticated
  let userName = '';
  if (isAuthenticated && userId) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      userName = user ? user.name : '';
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  // Enhanced responses with database context
  const websiteInfo = {
    features: [
      "🔍 **Advanced OCR Technology** - Extract text from any image using Tesseract.js with preprocessing for better accuracy",
      "🤖 **Universal AI Analysis** - Powered by Google Gemini AI to handle math, science, language, and general content",
      "📸 **Camera Integration** - Capture images directly using your device camera with real-time preview",
      "🎯 **Multi-Content Support** - Mathematics, science questions, language exercises, instructions, and general text",
      "💾 **Secure Authentication** - JWT-based login system with encrypted password storage",
      "🌙 **Dark/Light Mode** - Beautiful interface that automatically adapts to your system preference",
      "📱 **Fully Responsive** - Optimized for desktop, tablet, and mobile devices with touch support",
      "⚡ **Real-time Processing** - Live progress indicators and instant results",
      "📋 **Copy & Export** - Easy copying of extracted text and AI analysis results",
      "🎨 **Modern UI** - Beautiful animations and gradients with professional design"
    ],
    howToUse: [
      "1. 📸 Upload an image or use camera to capture content",
      "2. 🔍 Our OCR technology extracts text automatically",
      "3. 🤖 Gemini AI analyzes and provides detailed explanations",
      "4. 📋 Copy results or view detailed breakdowns"
    ],
    techStack: [
      "Frontend: React 18 + Vite + TailwindCSS",
      "Backend: Node.js + Express + MongoDB",
      "AI: Google Gemini AI API",
      "OCR: Tesseract.js",
      "Authentication: JWT + bcrypt",
      "Database: MongoDB with Mongoose"
    ]
  };

  // Context-aware responses
  if (message.includes('feature') || message.includes('what can') || message.includes('capabilities')) {
    return {
      content: "🚀 **Scanova Features:**\n\n" + websiteInfo.features.join('\n\n'),
      type: 'features'
    };
  }

  if (message.includes('how to') || message.includes('use') || message.includes('work')) {
    return {
      content: "📚 **How to Use Scanova:**\n\n" + websiteInfo.howToUse.join('\n'),
      type: 'howto'
    };
  }

  if (message.includes('tech') || message.includes('technology') || message.includes('built')) {
    return {
      content: "⚙️ **Technology Stack:**\n\n" + websiteInfo.techStack.join('\n'),
      type: 'tech'
    };
  }

  if (message.includes('account') || message.includes('register') || message.includes('login')) {
    return {
      content: isAuthenticated
        ? `👋 Hi ${userName || 'there'}! You're logged in and can use all features. Your conversations are saved and you have access to:\n• Unlimited image processing\n• Full AI analysis\n• Conversation history\n• All advanced features`
        : "🔐 **Account Information:**\n\nTo use Scanova's full features, please create a free account. Registration gives you:\n• Unlimited image processing\n• Full AI analysis\n• Conversation history\n• All advanced features\n\nYour chat conversations will be saved once you log in!",
      type: 'account'
    };
  }

  if (message.includes('history') || message.includes('previous') || message.includes('past')) {
    const messageCount = conversation.messages.length;
    return {
      content: isAuthenticated
        ? `📚 **Your Conversation History:**\n\nThis conversation has ${messageCount} messages. As a logged-in user, your conversations are automatically saved and you can access them anytime.\n\n**Benefits:**\n• All conversations preserved\n• Search through past chats\n• Continue where you left off\n• Export conversation history`
        : `📚 **Conversation History:**\n\nThis session has ${messageCount} messages. To save your conversations permanently, please log in to your account.\n\n**With an account you get:**\n• Persistent conversation history\n• Access across devices\n• Search functionality\n• Export options`,
      type: 'history'
    };
  }

  // Use Gemini AI for complex questions
  if (message.includes('explain') || message.includes('what is') || message.includes('how does')) {
    try {
      const aiResponse = await geminiAI.analyzeAndSolve(`User question about Scanova: ${userMessage}\n\nPlease provide a helpful response about our image analysis platform.`);
      if (aiResponse.success) {
        return {
          content: `🤖 **AI Response:**\n\n${aiResponse.solution}`,
          type: 'ai_generated'
        };
      }
    } catch (error) {
      console.error('AI response error:', error);
    }
  }

  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return {
      content: `👋 Hello${isAuthenticated ? ` ${userName}` : ''}! Welcome back to Scanova. I'm here to help you with our AI-powered content analysis platform. What would you like to know about?`,
      type: 'greeting'
    };
  }

  // Default response with conversation context
  return {
    content: `🤔 I'd be happy to help! Here are some things you can ask me about:\n\n• **Features** - What can Scanova do?\n• **How to Use** - Step-by-step guide\n• **Technology** - What powers Scanova?\n• **Account** - ${isAuthenticated ? 'Your account status' : 'Registration info'}\n• **History** - Your conversation history\n• **AI Analysis** - How our AI works\n\n${isAuthenticated ? `As a logged-in user, your conversations are automatically saved!` : 'Log in to save your conversations!'}\n\nJust ask me about Scanova!`,
    type: 'default'
  };
}

class ChatbotController {
  // Get or create conversation
  async getConversation(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user ? req.user._id : null;

      let conversation = await ChatConversation.findOne({ sessionId });

      if (!conversation) {
        // Create new conversation
        conversation = new ChatConversation({
          user: userId,
          sessionId,
          messages: [{
            id: uuidv4(),
            type: 'bot',
            content: "👋 **Welcome to Scanova!**\n\nI'm your AI assistant, here to help you understand and use our powerful content analysis platform.\n\n**What I can help with:**\n• 🔍 How to use OCR text extraction\n• 🤖 Understanding AI analysis features\n• 📸 Camera integration guide\n• 🛠️ Troubleshooting issues\n• 🔒 Privacy and security info\n• 📱 Mobile usage tips\n\n**Quick start:** Upload an image → Extract text → Get AI analysis!\n\nWhat would you like to know about Scanova?",
            category: 'welcome',
            timestamp: new Date()
          }],
          metadata: {
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip
          }
        });

        await conversation.save();
      }

      res.json({
        success: true,
        conversation: {
          sessionId: conversation.sessionId,
          messages: conversation.messages,
          lastActivity: conversation.lastActivity
        }
      });

    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation'
      });
    }
  }

  // Send message and get response
  async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;
      const userId = req.user ? req.user._id : null;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      let conversation = await ChatConversation.findOne({ sessionId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Add user message
      const userMessage = {
        id: uuidv4(),
        type: 'user',
        content: message,
        timestamp: new Date()
      };

      conversation.messages.push(userMessage);

      // Generate bot response
      let botResponse;
      try {
        botResponse = await generateBotResponse(message, userId, conversation);
      } catch (error) {
        console.error('Error generating bot response:', error);
        botResponse = {
          content: "❌ **Sorry!** I'm having trouble processing your message right now. Please try again in a moment.",
          type: 'error'
        };
      }
      
      const botMessage = {
        id: uuidv4(),
        type: 'bot',
        content: botResponse.content,
        category: botResponse.type,
        timestamp: new Date()
      };

      conversation.messages.push(botMessage);
      await conversation.save();

      res.json({
        success: true,
        userMessage,
        botMessage,
        conversation: {
          sessionId: conversation.sessionId,
          totalMessages: conversation.messages.length
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  }

  // Get conversation history for authenticated users
  async getConversationHistory(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const conversations = await ChatConversation.find({ 
        user: req.user._id 
      })
      .sort({ lastActivity: -1 })
      .limit(10)
      .select('sessionId lastActivity metadata.totalMessages createdAt');

      res.json({
        success: true,
        conversations
      });

    } catch (error) {
      console.error('Get conversation history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversation history'
      });
    }
  }

  // Delete conversation
  async deleteConversation(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user ? req.user._id : null;

      const conversation = await ChatConversation.findOne({ sessionId });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      // Only allow deletion if user owns the conversation or it's anonymous
      if (conversation.user && userId && !conversation.user.equals(userId)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this conversation'
        });
      }

      await ChatConversation.deleteOne({ sessionId });

      res.json({
        success: true,
        message: 'Conversation deleted successfully'
      });

    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation'
      });
    }
  }
}

module.exports = new ChatbotController();
