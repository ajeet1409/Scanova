const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Allow anonymous usage
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    default: ''
  },
  extractedText: {
    type: String,
    default: ''
  },
  solution: {
    type: String,
    default: ''
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  metadata: {
    ocrConfidence: {
      type: Number,
      default: 0
    },
    textLength: {
      type: Number,
      default: 0
    },
    solutionLength: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
imageSchema.index({ createdAt: -1 });
imageSchema.index({ processingStatus: 1 });

// Virtual for file URL
imageSchema.virtual('fileUrl').get(function() {
  return `/uploads/${this.filename}`;
});

// Ensure virtual fields are serialized
imageSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Image', imageSchema);
