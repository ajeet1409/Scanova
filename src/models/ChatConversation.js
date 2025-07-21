const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['user', 'bot'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'general'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Allow anonymous users
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    totalMessages: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Update lastActivity on save
chatConversationSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  this.metadata.totalMessages = this.messages.length;
  next();
});

// Index for better query performance
chatConversationSchema.index({ sessionId: 1 });
chatConversationSchema.index({ user: 1, createdAt: -1 });
chatConversationSchema.index({ lastActivity: -1 });

// Clean up old anonymous conversations (older than 7 days)
chatConversationSchema.statics.cleanupOldConversations = async function() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    user: null,
    lastActivity: { $lt: sevenDaysAgo }
  });
};

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
