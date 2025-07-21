const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAI {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

  createUniversalPrompt(text) {
    return `
You are an intelligent AI assistant capable of analyzing and solving various types of problems. I will provide you with text extracted from an image that may contain questions, problems, or content requiring analysis.

Your task is to:
1. **Identify the type of content** (mathematical problems, science questions, language exercises, general text, diagrams, etc.)
2. **Provide comprehensive solutions or explanations** based on the content type:
   - For **Math**: Step-by-step solutions with clear explanations
   - For **Science**: Detailed explanations with relevant concepts
   - For **Language**: Grammar corrections, translations, or explanations
   - For **General Questions**: Informative and helpful answers
   - For **Text Analysis**: Summaries, insights, or interpretations
   - For **Instructions**: Clear guidance or clarifications
3. **Show your reasoning** and provide educational value
4. **Handle multiple items** if present, addressing each separately
5. **Be helpful and educational** regardless of the content type

Text extracted from image:
"${text}"

Please provide a comprehensive response with:
- **Content Type**: What kind of content this appears to be
- **Analysis/Solution**: Detailed response appropriate to the content
- **Step-by-step breakdown** when applicable
- **Key insights or final answers** clearly highlighted
- **Educational explanations** of concepts involved

If the text is unclear, incomplete, or doesn't contain recognizable content, please:
- Explain what you can interpret from the available text
- Suggest how to improve image quality or content for better results
- Provide any helpful context or related information you can offer

Format your response clearly with proper headings and structure for easy reading.
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
