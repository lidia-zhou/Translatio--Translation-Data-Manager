import { GoogleGenAI, Type } from "@google/genai";
import { BibEntry, Gender } from "../types";

// Helper to ensure we don't re-initialize unnecessarily
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    if (!process.env.API_KEY) {
      console.warn("API Key not found in environment variables");
      // In a real app we might throw, but here we handle gracefully in UI
      throw new Error("API Key missing");
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

/**
 * Parses raw bibliographic text (citation) into a structured BibEntry object using Gemini.
 */
export const parseBibliographicData = async (rawText: string): Promise<Partial<BibEntry>> => {
  const ai = getAiClient();
  
  const systemInstruction = `
    You are an expert bibliographer specializing in Translation Studies. 
    Extract detailed bibliographic information from the provided text.
    Infer gender based on names if not explicitly stated, but mark as UNKNOWN if unsure.
    If exact years are missing, leave them null.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Extract data from this citation/text: "${rawText}"`,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          originalTitle: { type: Type.STRING },
          publicationYear: { type: Type.INTEGER },
          originalPublicationYear: { type: Type.INTEGER },
          publisher: { type: Type.STRING },
          city: { type: Type.STRING },
          sourceLanguage: { type: Type.STRING },
          targetLanguage: { type: Type.STRING },
          author: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              gender: { type: Type.STRING, enum: [Gender.MALE, Gender.FEMALE, Gender.NON_BINARY, Gender.UNKNOWN] },
              birthYear: { type: Type.INTEGER },
              deathYear: { type: Type.INTEGER },
              nationality: { type: Type.STRING }
            }
          },
          translator: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              gender: { type: Type.STRING, enum: [Gender.MALE, Gender.FEMALE, Gender.NON_BINARY, Gender.UNKNOWN] },
              birthYear: { type: Type.INTEGER },
              deathYear: { type: Type.INTEGER },
              nationality: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  throw new Error("Failed to parse data");
};

/**
 * Generates an insight summary based on the dataset.
 */
export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAiClient();
    
    // Summarize data for the prompt (avoid sending huge JSON if not needed)
    const summary = entries.map(e => 
        `${e.author.name} (${e.sourceLanguage}) -> ${e.translator.name} (${e.targetLanguage}) by ${e.publisher} in ${e.publicationYear}`
    ).join('\n');

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analyze this translation bibliographic dataset and provide 3 key scholarly insights regarding circulation patterns, gender representation, or publisher influence.\n\nDataset:\n${summary}`,
    });

    return response.text || "No insights generated.";
}
