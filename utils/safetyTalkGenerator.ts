import { Incident } from "../types";
import { getSafetyTalkContent } from "./textAnalysis";

export interface SafetyTalk {
  title: string;
  whyToday: string;
  keyMessages: string[];
  actions: string[];
  closing: string;
  sourceInfo: string;
  isRobust: boolean;
  situations?: string[]; // Added specific situations field
  relatedProcedures?: string[]; // NEW: List of related SGI Documents/Deviations
}

export const generateSafetyTalk = (
  selectedDate: string, 
  dayIncidents: Incident[], 
  historicalIncidents: Incident[],
  comClienteFilter: 'All' | 'SI' | 'NO' = 'All' // NEW PARAMETER
): SafetyTalk => {
  // Combine all relevant incidents for semantic analysis to get the best pattern match
  // We prioritize historical, but if day incidents exist (today's logic), we include them.
  const pool = [...historicalIncidents, ...dayIncidents];
  
  // Use the new Semantic Engine with the Client Communication Rule
  const content = getSafetyTalkContent(pool, selectedDate, comClienteFilter);

  return {
    title: content.title,
    whyToday: content.whyToday,
    keyMessages: content.keyMessages,
    actions: content.actions,
    closing: content.closing,
    sourceInfo: content.sourceInfo,
    situations: content.situations,
    relatedProcedures: content.relatedProcedures, // Passed from TextAnalysis
    isRobust: true // Always true now as we force generation
  };
};