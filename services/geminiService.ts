import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  // NOTE: In a real extension, you might ask the user for a key or use a proxy.
  // We use process.env.API_KEY as strictly requested by the guidelines.
  const apiKey = process.env.API_KEY; 
  if (!apiKey) {
    throw new Error("API Key not found. Please configure your environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateIcon = async (prompt: string): Promise<string> => {
  const ai = getClient();
  
  // Using gemini-2.5-flash-image for speed and image capabilities
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Generate a simple, high-contrast, minimalist icon or logo for a website favicon based on this description: "${prompt}". The background should be transparent if possible or solid color. Style: Vector art, flat design.`,
        },
      ],
    },
    config: {
        // Image generation doesn't use standard responseMimeType
    }
  });

  // Extract image
  let base64Image = '';
  
  // Iterate to find the inline data
  if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
              base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
          }
      }
  }

  if (!base64Image) {
    throw new Error("Failed to generate image. Please try a different prompt.");
  }

  return base64Image;
};
