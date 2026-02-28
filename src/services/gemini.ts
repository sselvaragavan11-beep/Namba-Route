import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateTouristContent = async (landmark: string, lang: string = 'en') => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a "Tourist Mode" description for ${landmark} in Tamil Nadu. Include historical significance, best time to visit, and a short "did you know" fact. Provide the response in ${lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English'}.`,
    config: {
      temperature: 0.7,
    },
  });
  return response.text;
};

export const generateItinerary = async (city: string, lang: string = 'en') => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a detailed "Full Day Trip" itinerary for ${city}, Tamil Nadu. 
    For each phase of the day (Morning, Afternoon, Evening), please include:
    1. **Destination**: A must-visit landmark.
    2. **Plan Route**: Specific bus numbers (e.g., #21G, #1A) and the best route to take.
    3. **Dining Shop**: A specific, famous local restaurant or shop for the corresponding meal (Breakfast, Lunch, or Dinner) with a recommended dish.
    
    Format the output in clear Markdown with bold headings for each phase. 
    Provide the response in ${lang === 'ta' ? 'Tamil' : lang === 'hi' ? 'Hindi' : 'English'}.`,
    config: {
      temperature: 0.6,
    },
  });
  return response.text;
};

export const getSafetyProtocol = async (location: { lat: number, lng: number }, reportType: string) => {
  // This would normally call a backend, but we can simulate the "AI reasoning" for the alert
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `A safety alert of type "${reportType}" was triggered at coordinates ${location.lat}, ${location.lng}. 
    Identify the nearest police station or transport authority in Tamil Nadu for this location and describe the protocol for an anonymous report.`,
  });
  return response.text;
};
