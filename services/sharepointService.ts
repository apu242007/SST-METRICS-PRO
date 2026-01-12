
import { SharePointConfig, Incident } from "../types";

/**
 * Service to interact with Microsoft Graph API for SharePoint integration.
 */

const DELAY_MS = 2000;

export const connectToSharePoint = async (config: SharePointConfig): Promise<SharePointConfig> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulated OAuth2 logic
            if (config.clientId && config.tenantId) {
                resolve({
                    ...config,
                    authStatus: 'CONNECTED',
                    lastSyncDate: new Date().toISOString()
                });
            } else {
                reject(new Error("Credenciales inválidas o incompletas."));
            }
        }, DELAY_MS);
    });
};

export const fetchFileFromSharePoint = async (config: SharePointConfig): Promise<{ arrayBuffer: ArrayBuffer, hash: string }> => {
    console.log(`[SharePoint] Accediendo a: ${config.siteUrl}/sites/QHSE/${config.libraryName}`);
    
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // In a real implementation:
            // 1. Get access token via MSAL
            // 2. GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive/root:/{path-to-file}:/content
            // 3. Return arrayBuffer
            
            // For now, we simulate a successful fetch if connected
            if (config.authStatus === 'CONNECTED') {
                // This would be the actual XLSX binary data
                const dummyBuffer = new ArrayBuffer(8); 
                resolve({
                    arrayBuffer: dummyBuffer,
                    hash: `sh-hash-${Date.now()}`
                });
            } else {
                reject(new Error("No autenticado en SharePoint."));
            }
        }, DELAY_MS);
    });
};

export const disconnectSharePoint = (config: SharePointConfig): SharePointConfig => {
    return {
        ...config,
        authStatus: 'DISCONNECTED',
        lastSyncDate: null,
        lastFileHash: null
    };
};
