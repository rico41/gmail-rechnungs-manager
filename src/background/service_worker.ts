import type {
  ExtensionMessage,
  UploadResponse,
  CheckStatusResponse,
  CheckStatusByFilenameResponse,
  SettingsResponse,
  TransferredListResponse,
  GenericResponse,
  TransferredEmail,
  BoringTaxFilesResponse,
} from '../types/api';
import { createApiClient } from '../utils/api_client';
import storage from '../utils/storage';

/**
 * Service Worker für die Gmail Rechnungs-Manager Extension
 * Handhabt alle API-Kommunikation und Storage-Operationen
 */

// Message Handler
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Async Handler
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        console.error('Message handling error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true um async sendResponse zu ermöglichen
    return true;
  }
);

/**
 * Haupthandler für alle Nachrichten
 */
async function handleMessage(
  message: ExtensionMessage
): Promise<
  | UploadResponse
  | CheckStatusResponse
  | CheckStatusByFilenameResponse
  | SettingsResponse
  | TransferredListResponse
  | GenericResponse
  | BoringTaxFilesResponse
> {
  switch (message.type) {
    case 'UPLOAD_PDF':
      return handleUploadPdf(message.payload);

    case 'CHECK_STATUS':
      return handleCheckStatus(message.payload.emailId);

    case 'CHECK_STATUS_BY_FILENAME':
      return handleCheckStatusByFilename(message.payload.fileName);

    case 'MARK_TRANSFERRED':
      return handleMarkTransferred(message.payload);

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'SAVE_SETTINGS':
      return handleSaveSettings(message.payload.apiKey, message.payload.orgId);

    case 'GET_TRANSFERRED_LIST':
      return handleGetTransferredList();

    case 'REMOVE_TRANSFERRED':
      return handleRemoveTransferred(message.payload.emailId);

    case 'TEST_CONNECTION':
      return handleTestConnection(message.payload.apiKey, message.payload.orgId);

    case 'SYNC_BORING_TAX_FILES':
      return handleSyncBoringTaxFiles();

    case 'GET_BORING_TAX_FILES':
      return handleGetBoringTaxFiles();

    default:
      return { success: false, error: 'Unbekannter Nachrichtentyp' };
  }
}

/**
 * Handhabt den PDF-Upload zur boring.tax API
 */
async function handleUploadPdf(payload: {
  fileName: string;
  fileData: string;
  emailId: string;
  subject?: string;
}): Promise<UploadResponse> {
  try {
    const settings = await storage.getSettings();

    if (!settings.isConfigured) {
      return {
        success: false,
        error: 'API nicht konfiguriert. Bitte Einstellungen prüfen.',
      };
    }

    const apiClient = createApiClient(settings.apiKey, settings.orgId);

    // Upload durchführen
    const result = await apiClient.uploadFileFromBase64(
      payload.fileData,
      payload.fileName,
      'application/pdf'
    );

    if (result.length === 0) {
      return {
        success: false,
        error: 'Upload fehlgeschlagen - keine Antwort vom Server',
      };
    }

    const uploadedFile = result[0];
    const fileId = uploadedFile.id || '';

    // Als übertragen markieren
    const transferredEmail: TransferredEmail = {
      emailId: payload.emailId,
      fileName: payload.fileName,
      uploadedFileId: fileId,
      transferDate: new Date().toISOString(),
      subject: payload.subject,
    };

    await storage.addTransferredEmail(transferredEmail);

    return {
      success: true,
      fileId: fileId,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Prüft ob eine E-Mail bereits übertragen wurde
 */
async function handleCheckStatus(emailId: string): Promise<CheckStatusResponse> {
  const transferInfo = await storage.getTransferredEmail(emailId);

  return {
    isTransferred: transferInfo !== null,
    transferInfo: transferInfo || undefined,
  };
}

/**
 * Markiert eine E-Mail als übertragen
 */
async function handleMarkTransferred(payload: TransferredEmail): Promise<GenericResponse> {
  try {
    await storage.addTransferredEmail(payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Ruft die aktuellen Einstellungen ab
 */
async function handleGetSettings(): Promise<SettingsResponse> {
  return storage.getSettings();
}

/**
 * Speichert die Einstellungen
 */
async function handleSaveSettings(apiKey: string, orgId: string): Promise<GenericResponse> {
  try {
    await storage.saveSettings(apiKey, orgId);

    // Optional: Teste die Verbindung
    if (apiKey && orgId) {
      const apiClient = createApiClient(apiKey, orgId);
      const isConnected = await apiClient.testConnection();

      if (!isConnected) {
        return {
          success: true,
          error: 'Einstellungen gespeichert, aber API-Verbindung konnte nicht verifiziert werden.',
        };
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Ruft die Liste aller übertragenen E-Mails ab
 */
async function handleGetTransferredList(): Promise<TransferredListResponse> {
  const emails = await storage.getTransferredEmails();
  return { emails };
}

/**
 * Entfernt eine E-Mail aus der übertragenen Liste
 */
async function handleRemoveTransferred(emailId: string): Promise<GenericResponse> {
  try {
    await storage.removeTransferredEmail(emailId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Testet die API-Verbindung
 */
async function handleTestConnection(apiKey: string, orgId: string): Promise<GenericResponse> {
  try {
    const apiClient = createApiClient(apiKey, orgId);
    const isConnected = await apiClient.testConnection();

    if (isConnected) {
      return { success: true };
    } else {
      return { success: false, error: 'API-Verbindung fehlgeschlagen' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Prüft den Status einer Datei anhand des Dateinamens
 */
async function handleCheckStatusByFilename(fileName: string): Promise<CheckStatusByFilenameResponse> {
  // Prüfe ob die Datei über die Extension übertragen wurde
  const transferInfo = await storage.isFileTransferredByName(fileName);
  
  // Prüfe ob die Datei in boring.tax existiert
  const isInBoringTax = await storage.isFileInBoringTax(fileName);

  return {
    isInBoringTax: isInBoringTax || transferInfo !== null,
    isTransferredByExtension: transferInfo !== null,
    transferInfo: transferInfo || undefined,
  };
}

/**
 * Synchronisiert die Dateiliste von boring.tax
 */
async function handleSyncBoringTaxFiles(): Promise<GenericResponse> {
  try {
    const settings = await storage.getSettings();

    if (!settings.isConfigured) {
      return {
        success: false,
        error: 'API nicht konfiguriert',
      };
    }

    const apiClient = createApiClient(settings.apiKey, settings.orgId);
    const fileNames = await apiClient.getFileNames();
    
    // Füge auch die lokal übertragenen Dateien hinzu
    const transferredEmails = await storage.getTransferredEmails();
    const allFileNames = [
      ...new Set([
        ...fileNames,
        ...transferredEmails.map(e => e.fileName),
      ]),
    ];

    await storage.saveBoringTaxFiles(allFileNames);

    console.log(`[GRM] Synced ${allFileNames.length} files from boring.tax`);

    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Ruft die gecachten boring.tax Dateien ab
 */
async function handleGetBoringTaxFiles(): Promise<BoringTaxFilesResponse> {
  const { fileNames, lastSync } = await storage.getBoringTaxFiles();
  return { fileNames, lastSync };
}

// Installation Handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Gmail Rechnungs-Manager installiert');
    // Optional: Öffne Einstellungen bei Erstinstallation
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Gmail Rechnungs-Manager aktualisiert auf Version', chrome.runtime.getManifest().version);
  }
});

console.log('Gmail Rechnungs-Manager Service Worker gestartet');
