import { GoogleGenAI, Type } from "@google/genai";
import { Incident } from "../types";

export const analyzeIncident = async (incident: Incident): Promise<{
  isRecordable: boolean;
  isLTI: boolean;
  daysAwayEstimate: number;
  reasoning: string;
}> => {
  // Fix: Obtained API key exclusively from process.env.API_KEY and initialized inside the function as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze the following workplace safety incident based on OSHA recordability criteria.
    
    Incident Description: "${incident.description}"
    Type reported: "${incident.type}"
    Injury details: "${incident.name}"
    
    Determine:
    1. Is this likely OSHA Recordable?
    2. Is this likely a Lost Time Injury (LTI)?
    3. Estimate potential days away based on severity (0 if none).
    4. Provide brief reasoning.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isRecordable: { type: Type.BOOLEAN },
            isLTI: { type: Type.BOOLEAN },
            daysAwayEstimate: { type: Type.INTEGER },
            reasoning: { type: Type.STRING },
          },
        },
      },
    });

    // Fix: Access the generated text directly from the .text property (not as a method)
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return {
      isRecordable: false,
      isLTI: false,
      daysAwayEstimate: 0,
      reasoning: "Analysis failed due to error.",
    };
  }
};