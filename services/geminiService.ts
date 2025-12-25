
import { GoogleGenAI, Type } from "@google/genai";
import { BibEntry, Gender, ResearchBlueprint, AdvancedGraphMetrics, LayoutType } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geocodeLocation = async (locationName: string): Promise<[number, number] | null> => {
  if (!locationName) return null;
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the latitude and longitude for: "${locationName}". Output as JSON [lon, lat].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          minItems: 2,
          maxItems: 2
        }
      }
    });
    return JSON.parse(response.text || "null");
  } catch (e) {
    return null;
  }
};

export const generateResearchBlueprint = async (prompt: string): Promise<ResearchBlueprint> => {
  const ai = getAI();
  const systemInstruction = `你是一位世界级的数字人文专家，专精于翻译史研究。
  你的任务是根据用户的研究课题，设计一套完整的科研工作流方案。
  你需要提供：
  1. 需要收集的数据变量及其在SNA分析中的作用。
  2. 数据存储格式与结构建议。
  3. 数据清洗与规范化策略（例如异名处理）。
  4. 分析方法论（如中介分析、社会翻译学网络）。
  5. 建议的可视化方案及其学术意义。
  请使用中文回复。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `研究课题: "${prompt}"。请提供深度科研蓝图。`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectScope: { type: Type.STRING },
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
        required: ['projectScope', 'suggestedSchema', 'dataCleaningStrategy', 'storageAdvice', 'methodology', 'visualizationStrategy', 'collectionTips']
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const parseBibliographicData = async (rawText: string, blueprint?: ResearchBlueprint): Promise<Partial<BibEntry>> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract data: "${rawText}"`,
    config: {
      systemInstruction: "Extract bibliographic metadata from messy academic notes. Output JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          publicationYear: { type: Type.INTEGER },
          author: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } },
          translator: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } },
          city: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const suggestNetworkConfig = async (metrics: AdvancedGraphMetrics, blueprint: ResearchBlueprint | null): Promise<{ layout: string, metric: string, focusNodes: string[], reasoning: string }> => {
  const ai = getAI();
  const researchContext = blueprint ? `The scholar is researching: ${blueprint.projectScope}.` : "The scholar is exploring general translation networks.";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${researchContext} Current Network Metrics: ${JSON.stringify(metrics)}. Suggest visualization settings in JSON.`,
    config: {
      systemInstruction: "Suggest the best Gephi-style layout (forceAtlas2, fruchterman, or circular) and primary metric (betweenness, pageRank, or eigenvector) to reveal hidden power dynamics in translation history. Output JSON only.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          layout: { type: Type.STRING },
          metric: { type: Type.STRING },
          focusNodes: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING }
        },
        required: ["layout", "metric", "reasoning", "focusNodes"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const interpretNetworkMetrics = async (metrics: AdvancedGraphMetrics): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Interpret results for a scholar: ${JSON.stringify(metrics)}`,
    config: {
      systemInstruction: `You are a sociologist of translation. 
      Use terms like "Betweenness (中介性)", "Closeness (紧密性)", and "Prestige (声望)". 
      Explain what density and global clustering mean for cultural flow. Output in Chinese.`
    }
  });
  return response.text || "";
};

export const generateInsights = async (entries: BibEntry[]): Promise<string> => {
    const ai = getAI();
    const dataSummary = entries.slice(0, 50).map(e => `- ${e.title}: ${e.author.name} (Author) & ${e.translator.name} (Translator)`).join('\n');
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these translation records:\n\n${dataSummary}`,
        config: {
            systemInstruction: "You are a senior translation studies scholar. Provide 3 deep observations in Chinese."
        }
    });
    return response.text || "";
}
