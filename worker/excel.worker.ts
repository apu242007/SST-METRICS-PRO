import { parseIncidentsExcel } from '../utils/importHelpers';

self.onmessage = (e: MessageEvent) => {
  const { arrayBuffer, existingRules } = e.data;
  
  try {
    const result = parseIncidentsExcel(arrayBuffer, existingRules);
    self.postMessage({ success: true, data: result });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || "Unknown error in worker" });
  }
};