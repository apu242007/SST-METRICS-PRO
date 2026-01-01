
import { SharePointConfig, ScheduledReport, SyncLog, Incident } from "../types";

/**
 * MOCK SERVICE: Simulates Microsoft Graph API behavior for SharePoint.
 * In a real app, this would use msal-browser and @microsoft/microsoft-graph-client.
 */

const DELAY_MS = 1500;

export const mockCheckForUpdates = async (config: SharePointConfig): Promise<{ hasUpdates: boolean, newFileBlob?: ArrayBuffer, newHash?: string }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // SIMULATION LOGIC:
            // Randomly decide if there's an update (or always true for demo purposes if config enabled)
            const simulatedServerDate = new Date();
            const lastSync = config.lastSyncDate ? new Date(config.lastSyncDate) : new Date(0);
            
            // Assume server file is "newer" if last sync was more than 1 minute ago for demo
            const hasUpdates = (simulatedServerDate.getTime() - lastSync.getTime()) > 60000; 

            if (hasUpdates) {
                // In real life, we would fetch: GET /sites/{id}/drive/root:/{filename}:/content
                // Here we return null to simulate that we *would* get a file, 
                // but since we can't generate a valid Excel blob from thin air, 
                // the UI will handle the "Demo Update" by just re-processing existing data with a timestamp.
                resolve({ 
                    hasUpdates: true, 
                    newHash: `hash-${simulatedServerDate.getTime()}`
                });
            } else {
                resolve({ hasUpdates: false });
            }
        }, DELAY_MS);
    });
};

export const mockUploadReport = async (config: SharePointConfig, reportName: string, dataBlob: any): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`[SHAREPOINT MOCK] Uploading ${reportName} to folder: ${config.siteUrl}/${config.reportFolderPath}`);
            // Simulate successful upload 90% of the time
            const success = Math.random() > 0.1;
            resolve(success);
        }, DELAY_MS);
    });
};

export const processScheduledReports = async (
    reports: ScheduledReport[], 
    config: SharePointConfig, 
    generateReportBlob: (filterSite: string, type: string) => any
): Promise<ScheduledReport[]> => {
    const now = new Date();
    const updatedReports = [...reports];
    
    for (const report of updatedReports) {
        if (!report.active) continue;

        const nextRun = new Date(report.nextRun);
        // If "Now" is after "Next Run", execute
        if (now >= nextRun) {
            try {
                console.log(`[SCHEDULER] Running report: ${report.name}`);
                
                // 1. Generate Logic
                const blob = generateReportBlob(report.siteFilter, report.templateType);
                
                // 2. Upload Logic
                const fileName = `${report.name}_${now.toISOString().split('T')[0]}.xlsx`;
                await mockUploadReport(config, fileName, blob);
                
                // 3. Update Schedule
                report.lastRun = now.toISOString();
                
                // Set next run based on frequency
                const nextDate = new Date(now);
                if (report.frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
                if (report.frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
                report.nextRun = nextDate.toISOString();

            } catch (error) {
                console.error(`[SCHEDULER] Error running report ${report.name}`, error);
            }
        }
    }
    return updatedReports;
};
