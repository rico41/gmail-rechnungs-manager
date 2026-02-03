import type { StorageData, TransferredEmail } from '../types/api';

const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  ORG_ID: 'orgId',
  TRANSFERRED_EMAILS: 'transferredEmails',
  BORING_TAX_FILES: 'boringTaxFiles',
  BORING_TAX_LAST_SYNC: 'boringTaxLastSync',
} as const;

interface ExtendedStorageData extends StorageData {
  boringTaxFiles: string[];
  boringTaxLastSync: string;
}

const DEFAULT_STORAGE: ExtendedStorageData = {
  apiKey: '',
  orgId: '',
  transferredEmails: [],
  boringTaxFiles: [],
  boringTaxLastSync: '',
};

/**
 * Storage Wrapper für Chrome Extension Storage
 * Verwendet chrome.storage.local für persistente Datenspeicherung
 */
export const storage = {
  /**
   * Ruft alle gespeicherten Daten ab
   */
  async getAll(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULT_STORAGE, (result) => {
        resolve(result as StorageData);
      });
    });
  },

  /**
   * Speichert die API-Einstellungen
   */
  async saveSettings(apiKey: string, orgId: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.API_KEY]: apiKey,
          [STORAGE_KEYS.ORG_ID]: orgId,
        },
        resolve
      );
    });
  },

  /**
   * Ruft die API-Einstellungen ab
   */
  async getSettings(): Promise<{ apiKey: string; orgId: string; isConfigured: boolean }> {
    const data = await this.getAll();
    return {
      apiKey: data.apiKey,
      orgId: data.orgId,
      isConfigured: Boolean(data.apiKey && data.orgId),
    };
  },

  /**
   * Fügt eine übertragene E-Mail zur Liste hinzu
   */
  async addTransferredEmail(email: TransferredEmail): Promise<void> {
    const data = await this.getAll();
    const existingIndex = data.transferredEmails.findIndex((e) => e.emailId === email.emailId);

    if (existingIndex >= 0) {
      // Aktualisiere bestehenden Eintrag
      data.transferredEmails[existingIndex] = email;
    } else {
      // Füge neuen Eintrag hinzu
      data.transferredEmails.push(email);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.TRANSFERRED_EMAILS]: data.transferredEmails,
        },
        resolve
      );
    });
  },

  /**
   * Entfernt eine E-Mail aus der übertragenen Liste
   */
  async removeTransferredEmail(emailId: string): Promise<void> {
    const data = await this.getAll();
    const filteredEmails = data.transferredEmails.filter((e) => e.emailId !== emailId);

    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.TRANSFERRED_EMAILS]: filteredEmails,
        },
        resolve
      );
    });
  },

  /**
   * Prüft ob eine E-Mail bereits übertragen wurde
   */
  async isEmailTransferred(emailId: string): Promise<boolean> {
    const data = await this.getAll();
    return data.transferredEmails.some((e) => e.emailId === emailId);
  },

  /**
   * Ruft die Info einer übertragenen E-Mail ab
   */
  async getTransferredEmail(emailId: string): Promise<TransferredEmail | null> {
    const data = await this.getAll();
    return data.transferredEmails.find((e) => e.emailId === emailId) || null;
  },

  /**
   * Ruft alle übertragenen E-Mails ab
   */
  async getTransferredEmails(): Promise<TransferredEmail[]> {
    const data = await this.getAll();
    // Sortiere nach Datum (neueste zuerst)
    return data.transferredEmails.sort(
      (a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime()
    );
  },

  /**
   * Löscht alle übertragenen E-Mails
   */
  async clearTransferredEmails(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.TRANSFERRED_EMAILS]: [],
        },
        resolve
      );
    });
  },

  /**
   * Löscht alle Daten
   */
  async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  },

  /**
   * Speichert die boring.tax Dateinamen
   */
  async saveBoringTaxFiles(fileNames: string[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.BORING_TAX_FILES]: fileNames,
          [STORAGE_KEYS.BORING_TAX_LAST_SYNC]: new Date().toISOString(),
        },
        resolve
      );
    });
  },

  /**
   * Ruft die boring.tax Dateinamen ab
   */
  async getBoringTaxFiles(): Promise<{ fileNames: string[]; lastSync: string }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        {
          [STORAGE_KEYS.BORING_TAX_FILES]: [],
          [STORAGE_KEYS.BORING_TAX_LAST_SYNC]: '',
        },
        (result) => {
          resolve({
            fileNames: result[STORAGE_KEYS.BORING_TAX_FILES] || [],
            lastSync: result[STORAGE_KEYS.BORING_TAX_LAST_SYNC] || '',
          });
        }
      );
    });
  },

  /**
   * Prüft ob eine Datei in boring.tax existiert (nach Dateinamen)
   */
  async isFileInBoringTax(fileName: string): Promise<boolean> {
    const { fileNames } = await this.getBoringTaxFiles();
    const normalizedFileName = fileName.toLowerCase().trim();
    return fileNames.some(f => f.toLowerCase().trim() === normalizedFileName);
  },

  /**
   * Prüft ob eine Datei bereits übertragen wurde (nach Dateinamen)
   */
  async isFileTransferredByName(fileName: string): Promise<TransferredEmail | null> {
    const data = await this.getAll();
    const normalizedFileName = fileName.toLowerCase().trim();
    return data.transferredEmails.find(
      e => e.fileName.toLowerCase().trim() === normalizedFileName
    ) || null;
  },
};

export default storage;
