import { GoogleGenAI, Type } from "@google/genai";
import { Task, Priority, SourceType } from "../types";

const generateId = () => Math.random().toString(36).substring(2, 9);

// UPDATE: Accept 'customInstructions' as the 3rd argument
export const analyzeContent = async (text: string, userApiKey?: string, customInstructions?: string): Promise<Task[]> => {
  let envKey = undefined;
  
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process && process.env) {
      // @ts-ignore
      envKey = process.env.API_KEY;
    }
  } catch (e) {}

  const apiKey = userApiKey || envKey;

  if (!apiKey) {
    throw new Error("API Key is missing. Please add your Gemini API Key in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // Inject custom instructions if they exist
  const additionalRules = customInstructions 
    ? `\n    USER CUSTOM RULES (IMPORTANT): ${customInstructions}` 
    : "";

  const systemInstruction = `
    You are an expert productivity assistant. 
    Your goal is to analyze raw text logs from Emails and Chat messages to identify actionable tasks.
    
    Rules:
    1. Ignore casual conversation or informational updates that don't require action.
    2. Infer priority based on urgency words (e.g., "ASAP", "tomorrow", "critical").
    3. Infer source type based on context clues (e.g., "Subject:" implies Email, names/timestamps often imply Chat).
    4. Extract the specific context sentence that triggered the task.
    5. Set a confidence score (0-100) based on how clear the task is.
    ${additionalRules}
  `;

  const prompt = `
    Analyze the following communication logs and extract a list of to-do items.
    
    LOGS:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Short actionable title" },
              description: { type: Type.STRING, description: "Detailed context or instructions" },
              priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
              sourceType: { type: Type.STRING, enum: ["Gmail", "Google Chat", "Manual Input"] },
              sourceContext: { type: Type.STRING, description: "The original text snippet" },
              dueDate: { type: Type.STRING, description: "ISO date string or descriptive time (e.g. 'Next Friday') if inferred, else null" },
              confidenceScore: { type: Type.NUMBER, description: "0 to 100" }
            },
            required: ["title", "priority", "sourceType", "sourceContext", "confidenceScore"]
          }
        }
      }
    });

    const jsonRaw = response.text;
    if (!jsonRaw) return [];

    const parsedData = JSON.parse(jsonRaw);

    return parsedData.map((item: any) => ({
      ...item,
      id: generateId(),
      isCompleted: false,
      priority: Object.values(Priority).includes(item.priority) ? item.priority : Priority.MEDIUM,
      sourceType: Object.values(SourceType).includes(item.sourceType) ? item.sourceType : SourceType.MANUAL,
    }));

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error;
  }
};
