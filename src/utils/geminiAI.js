const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAI {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use the faster gemini-2.0-flash model like in your code reviewer
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async analyzeAndSolve(extractedText) {
    try {
      const prompt = this.createUniversalPrompt(extractedText);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const solution = response.text();

      return {
        success: true,
        solution: solution,
        originalText: extractedText
      };
    } catch (error) {
      console.error('Gemini AI Error:', error);
      return {
        success: false,
        error: error.message,
        solution: 'Sorry, I could not process this text. Please ensure the image contains clear, readable content.'
      };
    }
  }

  async analyzeAndSolveStream(extractedText, onChunk) {
    try {
      const prompt = this.createUniversalPrompt(extractedText);

      const result = await this.model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText && onChunk) {
          onChunk(chunkText);
        }
      }

      return {
        success: true,
        originalText: extractedText
      };
    } catch (error) {
      console.error('Gemini AI Stream Error:', error);
      throw error;
    }
  }

  // SIMULTANEOUS streaming - generate and send data at the same time
  async analyzeAndSolveStreamDirect(extractedText, onChunk) {
    try {
      const prompt = this.createUniversalPrompt(extractedText);

      // Start streaming immediately - no waiting
      const result = await this.model.generateContentStream(prompt);

      // Process each chunk IMMEDIATELY as it's generated
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text && onChunk) {
          // Send chunk IMMEDIATELY to frontend - no buffering, no delays
          onChunk(text);
        }
      }

      return {
        success: true,
        originalText: extractedText
      };
    } catch (error) {
      console.error('Gemini AI Simultaneous Stream Error:', error);
      throw error;
    }
  }

  createUniversalPrompt(text) {
    return `
You are an intelligent AI assistant that analyzes and solves problems from extracted text.

**Your task:**
1. Analyze the following text carefully.
2. Identify the type of content (math, science, language, general questions, etc.).
3. Provide step-by-step solutions with clear explanations.
4. Format your response using **Markdown** for better readability.
5. Be concise but comprehensive.

**Text extracted from image:**
"${text}"

**Instructions:**
- Use **bold** for important terms and final answers
- Use \`code blocks\` for mathematical expressions
- Use numbered lists for step-by-step solutions
- Provide clear, educational explanations
- If it's a math problem, show all work
- If it's a question, provide a complete answer
- If the text is unclear, explain what you can interpret

Analyze and solve:
`;
  }

  async analyzeText(text) {
    try {
      const prompt = `
Analyze the following text extracted from an image and provide insights:

Text: "${text}"

Please provide:
1. Type of content (mathematical, textual, mixed, etc.)
2. Quality assessment of the text extraction
3. Suggestions for improvement if needed
4. Brief summary of what was found

Keep the response concise and helpful.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        success: true,
        analysis: response.text()
      };
    } catch (error) {
      console.error('Text Analysis Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateHints(problemText) {
    try {
      const prompt = `
For the following mathematical problem, provide helpful hints without giving away the complete solution:

Problem: "${problemText}"

Provide 3-5 progressive hints that guide the student toward the solution without solving it completely.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        success: true,
        hints: response.text()
      };
    } catch (error) {
      console.error('Hints Generation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GeminiAI();
