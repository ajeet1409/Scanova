import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ChatbotService {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  // Generate or retrieve session ID
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('chatbot_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chatbot_session_id', sessionId);
    }
    return sessionId;
  }

  // Get auth token if available
  getAuthToken() {
    return localStorage.getItem('token');
  }

  // Create axios instance with optional auth
  createAxiosInstance() {
    const token = this.getAuthToken();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return axios.create({
      baseURL: `${API_URL}/chatbot`,
      headers
    });
  }

  // Get or create conversation
  async getConversation() {
    try {
      const api = this.createAxiosInstance();
      const response = await api.get(`/conversation/${this.sessionId}`);
      
      if (response.data.success) {
        // Ensure timestamps are properly formatted
        const conversation = response.data.conversation;
        if (conversation.messages) {
          conversation.messages = conversation.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        }

        return {
          success: true,
          conversation: conversation
        };
      } else {
        throw new Error(response.data.error || 'Failed to get conversation');
      }
    } catch (error) {
      console.error('Get conversation error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get conversation'
      };
    }
  }

  // Send message and get response
  async sendMessage(message) {
    try {
      const api = this.createAxiosInstance();
      const response = await api.post(`/conversation/${this.sessionId}/message`, {
        message: message.trim()
      });
      
      if (response.data.success) {
        // Ensure timestamps are properly formatted
        const userMessage = {
          ...response.data.userMessage,
          timestamp: new Date(response.data.userMessage.timestamp)
        };

        const botMessage = {
          ...response.data.botMessage,
          timestamp: new Date(response.data.botMessage.timestamp)
        };

        return {
          success: true,
          userMessage: userMessage,
          botMessage: botMessage,
          conversation: response.data.conversation
        };
      } else {
        throw new Error(response.data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to send message'
      };
    }
  }

  // Get conversation history (requires authentication)
  async getConversationHistory() {
    try {
      const token = this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'Authentication required'
        };
      }

      const api = this.createAxiosInstance();
      const response = await api.get('/conversations');
      
      if (response.data.success) {
        return {
          success: true,
          conversations: response.data.conversations
        };
      } else {
        throw new Error(response.data.error || 'Failed to get conversation history');
      }
    } catch (error) {
      console.error('Get conversation history error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to get conversation history'
      };
    }
  }

  // Delete conversation
  async deleteConversation(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.sessionId;
      const api = this.createAxiosInstance();
      const response = await api.delete(`/conversation/${targetSessionId}`);
      
      if (response.data.success) {
        // If deleting current session, create new one
        if (targetSessionId === this.sessionId) {
          localStorage.removeItem('chatbot_session_id');
          this.sessionId = this.getOrCreateSessionId();
        }
        
        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.error || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Delete conversation error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to delete conversation'
      };
    }
  }

  // Clear current session (start fresh)
  clearSession() {
    localStorage.removeItem('chatbot_session_id');
    this.sessionId = this.getOrCreateSessionId();
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getAuthToken();
  }

  // Health check
  async healthCheck() {
    try {
      const api = this.createAxiosInstance();
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      return {
        success: false,
        error: 'Chatbot service unavailable'
      };
    }
  }
}

// Create singleton instance
const chatbotService = new ChatbotService();

export default chatbotService;
