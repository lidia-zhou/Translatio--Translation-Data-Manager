
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, Project } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Fallback Data / 专家预设模板 ---
const FALLBACK_BLUEPRINT: ResearchBlueprint = {
  projectScope: "General Translation Studies Lab (Template Mode)",
  dimensions: [
    {
      dimension: 'Agentive (Who)',
      coreQuestion: "Who are the primary mediators (translators, publishers, patrons) in this flow?",
      dataSources: ["National Library Catalogs", "Publisher Archives", "Biographical Dictionaries"],
      dhMethods: ["Social Network Analysis (SNA)", "Prosopography"],
      relevance: 95
    },
    {
      dimension: 'Textual (What)',
      coreQuestion: "What are the linguistic shifts and stylistic features of the translated corpus?",
      dataSources: ["Parallel Corpora", "Translation Manuscripts"],
      dhMethods: ["Corpus Linguistics", "Stylometry"],
      relevance: 85
    },
    {
      dimension: 'Distributional (Where/When/How)',
      coreQuestion: "How did the text circulate geographically and temporally?",
      dataSources: ["Shipping Records", "Sales Data", "Library Holdings"],
      dhMethods: ["GIS Mapping", "Time-series Analysis"],
      relevance: 90
    },
    {
      dimension: 'Discursive (Why)',
      coreQuestion: "What institutional discourses justified or framed the translation?",
      dataSources: ["Paratexts (Prefaces/Postscripts)", "Critical Reviews"],
      dhMethods: ["Topic Modeling", "Sentiment Analysis"],
      relevance: 75
    },
    {
      dimension: 'Reception (So what)',
      coreQuestion: "What was the social impact or long-term canonization of the work?",
      dataSources: ["Citation Indexes", "Digital Book Reviews", "Later Retranslations"],
      dhMethods: ["Impact Analysis", "Diachronic Mapping"],
      relevance: 80
    }
  ],
  suggestedSchema: [
    { fieldName: "Translator_Gender", description: "Gender of the translator", analyticalUtility: "Gender-based translation patterns", importance: 'Critical' },
    { fieldName: "Paratext_Length", description: "Word count of preface/notes", analyticalUtility: "Degree of intervention", importance: 'Optional' }
  ],
  dataCleaningStrategy: "Standardize publisher names and normalize dates to ISO format.",
  storageAdvice: "Use SQLite or JSON for small-scale archival data.",
  methodology: "Triangulate sociological data with textual evidence using a mixed-methods DH approach.",
  visualizationStrategy: "Use Network Graphs for agents and Arc Maps for geographic flow.",
  collectionTips: "Prioritize incomplete records to identify hidden mediators in the archive."
};

// --- Helpers ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
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
};

// --- Exported Services ---

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  if (!ai) return { ...FALLBACK_BLUEPRINT, projectScope: `Template: ${prompt}` };

  try {
    const systemInstruction = `你是一位世界级的翻译史与数字人文（DH）专家。
    你的任务是根据用户的研究课题，严格基于 "Translation as Data" 理论框架进行蓝图规划。
    该框架包含五个维度：Agentive, Textual, Distributional, Discursive, Reception。
    请使用中文回复。`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `研究课题: "${prompt}"。请提供遵循 "Translation as Data" 五维框架的深度科研蓝图。`,
      config: {
        systemInstruction,
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
                  dimension: { type: Type.STRING, enum: ['Agentive (Who)', 'Textual (What)', 'Distributional (Where/When/How)', 'Discursive (Why)', 'Reception (So what)'] },
                  coreQuestion: { type: Type.STRING },
                  dataSources: { type: Type.ARRAY, items: { type: Type.STRING } },
                  dhMethods: { type: Type.ARRAY, items: { type: Type.STRING } },
                  relevance: { type: Type.NUMBER }
                },
                required: ['dimension', 'coreQuestion', 'dataSources', 'dhMethods', 'relevance']
              },
              minItems: 5,
              maxItems: 5
            },
            suggestedSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fieldName: { type: Type.STRING },
                  description: { type: Type.STRING },
                  analyticalUtility: { type: Type.STRING },
                  importance: { type: Type.STRING, enum: ['Critical', 'Optional'] }
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
  } catch (e) {
    console.warn("AI Architect failed, using template fallback.");
    return { ...FALLBACK_BLUEPRINT, projectScope: `Template: ${prompt}` };
  }
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    if (!ai) return "本报告基于静态数据分析：当前档案呈现出明显的译者聚集效应。建议重点关注核心枢纽节点的出版跨度。 (Template Mode)";
    
    try {
        const dataSummary = entries.slice(0, 30).map(e => `- ${e.title}`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze these translation records:\n\n${dataSummary}`,
        });
        return response.text || "";
    } catch (e) {
        return "数据分析模块目前处于本地模式，无法生成实时洞察。";
    }
}

// Geocode, Video, and TTS logic remains the same but with null checks
export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  const ai = getAI();
  if (!ai || !locationName) return null;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the latitude and longitude for: "${locationName}". Output as JSON [lon, lat].`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "null");
  } catch (e) { return null; }
};

export const speakTutorialPart = async (text: string, voice: string = 'Zephyr'): Promise<AudioBuffer | null> => {
    const ai = getAI();
    if (!ai) return null;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Read: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
    } catch (e) { return null; }
};

// --- Added missing functions for TutorialCenter ---

/**
 * Generates a structured tutorial script for a research project using Gemini 3 Flash.
 */
export const generateTutorialScript = async (project: Project): Promise<{ title: string, content: string }[]> => {
  const ai = getAI();
  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `为研究项目 "${project.name}" 生成一个 4 步的学术导览脚本。这个项目是关于翻译史研究的。
      请包含标题和内容。回复为 JSON 数组。`,
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
  } catch (e) {
    console.error("Failed to generate tutorial script", e);
    return [];
  }
};

/**
 * Generates an atmospheric background video for the tutorial using Veo 3.1.
 * Follows mandatory API key selection process for video generation.
 */
export const generateAtmosphericVideo = async (prompt: string): Promise<string | null> => {
  // Check for API key selection as per Veo requirements
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    const aistudio = (window as any).aistudio;
    if (!(await aistudio.hasSelectedApiKey())) {
      await aistudio.openSelectKey();
    }
  }

  // Always create a new instance right before the call to ensure latest key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

    // Poll for operation completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;

    // Fetch the video content with the API key appended
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e: any) {
    console.error("Video generation failed", e);
    // If key entity not found, re-prompt for key selection
    if (e.message?.includes("Requested entity was not found.")) {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
        }
    }
    return null;
  }
};
