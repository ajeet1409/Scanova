const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Import routes
const imageRoutes = require('./routes/imageRoutes');
const authRoutes = require('./routes/authRoutes');
const turnstileRoutes = require('./routes/turnstileRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:5173','https://4tbjw783-5000.inc1.devtunnels.ms/' ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', imageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', turnstileRoutes);
app.use('/api/chatbot', require('./routes/chatbot'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Image Processing Server is running',
    timestamp: new Date().toISOString()
  });
});

// Production static client (serve React build)
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDistPath));

  // Fallback to index.html for client-side routing, but only for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler for any unmatched API routes or other requests
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/image-processing');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

//Production Deployment Code
if (process.env.NODE_ENV === "production") {
  const dirPath = path.resolve()
  app.use(express.static("./client/dist"))
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(dirPath, "./client/dist", "index.html"))
  })
}


// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();




// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await mongoose.connection.close();
  process.exit(0);
});


module.exports = app;
