
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, Project } from "../types";

// Helper function to decode base64 strings
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to decode raw PCM audio data into an AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'category';
  description: string;
  scholarlyPurpose: string;
  isGisRelated: boolean;
  sampleValue: string;
}

export interface ArchitectOutput {
  projectName: string;
  schema: SchemaField[];
  dataEntryProtocol: string;
  cleaningRules: string[];
}

// --- Exported Services ---

export const architectDatabaseSchema = async (description: string): Promise<ArchitectOutput> => {
  const ai = getAI();
  if (!ai) throw new Error("API Key required");

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Acting as a Digital Humanities Database Architect, design a precise bibliographic data schema for this research project: "${description}". Focus on Translation Studies specificities.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectName: { type: Type.STRING },
          schema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                description: { type: Type.STRING },
                scholarlyPurpose: { type: Type.STRING },
                isGisRelated: { type: Type.BOOLEAN },
                sampleValue: { type: Type.STRING }
              },
              required: ['name', 'type', 'description', 'scholarlyPurpose', 'isGisRelated', 'sampleValue']
            }
          },
          dataEntryProtocol: { type: Type.STRING },
          cleaningRules: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['projectName', 'schema', 'dataEntryProtocol', 'cleaningRules']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  const ai = getAI();
  if (!ai || !locationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the precise WGS84 Geographic Coordinates (Longitude and Latitude) for the following location: "${locationName}". 
      Return only a JSON array of two numbers: [longitude, latitude]. 
      Example for Beijing: [116.40, 39.90]. 
      If the location is a province, return the coordinates of its capital city.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER }
        }
      }
    });
    const result = JSON.parse(response.text || "null");
    return Array.isArray(result) && result.length === 2 ? [result[0], result[1]] : null;
  } catch (e) { return null; }
};

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  if (!ai) return { projectScope: prompt } as any; 
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `As a Professor of Translation Studies, develop a structured TAD (Translation as Data) research blueprint for: "${prompt}". 
    You MUST categorize your analytical dimensions into EXACTLY these five keys: 
    1. "Agentive (Who)" 
    2. "Textual (What)" 
    3. "Distributional (Where/When/How)" 
    4. "Discursive (Why)" 
    5. "Reception (So what)"`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectScope: { type: Type.STRING },
          dimensions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dimension: { 
                    type: Type.STRING, 
                    description: "Must be exactly one of: Agentive (Who), Textual (What), Distributional (Where/When/How), Discursive (Why), Reception (So what)" 
                },
                coreQuestion: { type: Type.STRING },
                dataSources: { type: Type.ARRAY, items: { type: Type.STRING } },
                dhMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
                relevance: { type: Type.NUMBER }
              },
              required: ['dimension', 'coreQuestion', 'dataSources', 'dhMethods', 'relevance']
            }
          },
          suggestedSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fieldName: { type: Type.STRING },
                description: { type: Type.STRING },
                analyticalUtility: { type: Type.STRING },
                importance: { type: Type.STRING }
              },
              required: ['fieldName', 'description', 'analyticalUtility', 'importance']
            }
          },
          dataCleaningStrategy: { type: Type.STRING },
          storageAdvice: { type: Type.STRING },
          methodology: { type: Type.STRING },
          visualizationStrategy: { type: Type.STRING },
          collectionTips: { type: Type.STRING }
        },
        required: ['projectScope', 'dimensions', 'suggestedSchema', 'dataCleaningStrategy', 'storageAdvice', 'methodology', 'visualizationStrategy', 'collectionTips']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    if (!ai) return "Static synthesis.";
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Insight for: ${JSON.stringify(entries.slice(0, 10))}`,
    });
    return response.text || "";
}

export const extractMetadataFromEntries = async (entries: {id: string, text: string}[]): Promise<Record<string, {city?: string, originalCity?: string}>> => {
  const ai = getAI();
  if (!ai) return {};
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract cities for IDs: ${JSON.stringify(entries)}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
}

export const generateTutorialScript = async (project: Project): Promise<{ title: string, content: string }[]> => {
  const ai = getAI();
  if (!ai) return [];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a 3-part tutorial script for a digital humanities project named "${project.name}". Return as JSON array of objects with title and content.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ['title', 'content']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) { return []; }
};

export const speakTutorialPart = async (text: string): Promise<AudioBuffer | null> => {
  const ai = getAI();
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    return await decodeAudioData(decodeBase64(base64Audio), audioContext, 24000, 1);
  } catch (e) { return null; }
};

export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
  const ai = getAI();
  if (!ai) return null;
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (e) { return null; }
};
