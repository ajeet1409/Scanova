const Image = require('../models/Image');
const geminiAI = require('../utils/geminiAI');

class ImageController {
  // Stream AI solution in real-time using direct streaming
  async streamSolution(req, res) {
    try {
      const { text } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No text provided for processing'
        });
      }

      const startTime = Date.now();

      // Set headers for SIMULTANEOUS streaming - optimized for speed
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering for immediate streaming

      let fullSolution = '';

      try {
        // Stream AI solution directly to response - SIMULTANEOUS generation and sending
        await geminiAI.analyzeAndSolveStreamDirect(text, (chunk) => {
          fullSolution += chunk;
          // Write chunk IMMEDIATELY to response as soon as it's generated
          if (chunk && !res.destroyed) {
            res.write(chunk);
            // Force flush the response to send data immediately
            if (res.flush) res.flush();
          }
        });

        const processingTime = Date.now() - startTime;

        // Save to database (optional - for analytics)
        try {
          const imageRecord = new Image({
            user: req.user ? req.user._id : null,
            filename: `text_${Date.now()}.txt`,
            originalName: 'extracted_text.txt',
            mimetype: 'text/plain',
            size: text.length,
            path: '',
            extractedText: text,
            solution: fullSolution,
            processingStatus: 'completed',
            processingTime,
            metadata: {
              textLength: text.length,
              solutionLength: fullSolution.length
            }
          });

          await imageRecord.save();
        } catch (dbError) {
          console.error('Database save error:', dbError);
        }

      } catch (aiError) {
        console.error('AI processing error:', aiError);
        res.write('\n\n❌ Error: Failed to generate solution');
      }

      res.end();

    } catch (error) {
      console.error('Stream solution error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stream solution',
        message: error.message
      });
    }
  }

  // Process text extracted from frontend OCR
  async processText(req, res) {
    try {
      const { text } = req.body;
      
      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No text provided for processing'
        });
      }

      const startTime = Date.now();
      
      // Get AI solution
      const aiResult = await geminiAI.analyzeAndSolve(text);
      
      const processingTime = Date.now() - startTime;

      // Save to database (optional - for analytics)
      try {
        const imageRecord = new Image({
          user: req.user ? req.user._id : null, // Associate with user if authenticated
          filename: `text_${Date.now()}.txt`,
          originalName: 'extracted_text.txt',
          mimetype: 'text/plain',
          size: text.length,
          path: '',
          extractedText: text,
          solution: aiResult.solution,
          processingStatus: aiResult.success ? 'completed' : 'failed',
          processingTime,
          metadata: {
            textLength: text.length,
            solutionLength: aiResult.solution ? aiResult.solution.length : 0
          }
        });
        
        await imageRecord.save();
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // Continue even if DB save fails
      }

      res.json({
        success: aiResult.success,
        solution: aiResult.solution,
        processingTime,
        textLength: text.length,
        error: aiResult.error || null
      });

    } catch (error) {
      console.error('Process text error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process text',
        message: error.message
      });
    }
  }

  // Get processing history
  async getHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const images = await Image.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-path'); // Exclude file path for security

      const total = await Image.countDocuments();

      res.json({
        success: true,
        data: images,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch history'
      });
    }
  }

  // Get specific record by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const image = await Image.findById(id).select('-path');
      
      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      res.json({
        success: true,
        data: image
      });

    } catch (error) {
      console.error('Get by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch record'
      });
    }
  }

  // Delete record
  async deleteRecord(req, res) {
    try {
      const { id } = req.params;
      
      const image = await Image.findByIdAndDelete(id);
      
      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      res.json({
        success: true,
        message: 'Record deleted successfully'
      });

    } catch (error) {
      console.error('Delete record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete record'
      });
    }
  }

  // Get analytics/stats
  async getStats(req, res) {
    try {
      const totalProcessed = await Image.countDocuments();
      const successfulProcessing = await Image.countDocuments({ processingStatus: 'completed' });
      const averageProcessingTime = await Image.aggregate([
        { $match: { processingStatus: 'completed' } },
        { $group: { _id: null, avgTime: { $avg: '$processingTime' } } }
      ]);

      const recentActivity = await Image.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('extractedText solution createdAt processingStatus');

      res.json({
        success: true,
        stats: {
          totalProcessed,
          successfulProcessing,
          successRate: totalProcessed > 0 ? (successfulProcessing / totalProcessed * 100).toFixed(2) : 0,
          averageProcessingTime: averageProcessingTime[0]?.avgTime || 0,
          recentActivity
        }
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  }
}

module.exports = new ImageController();
