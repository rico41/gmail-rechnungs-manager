import type {
  AllTransactionsRequest,
  ConnectTransactionRequest,
  ConnectTransactionResponse,
  FileSystemEntityDTO,
  TransactionDTO,
} from '../types/api';

const BASE_URL = 'https://backend.boring.tax/api';

/**
 * API Client für boring.tax Buchhaltungs-API
 */
export class BoringTaxApiClient {
  private apiKey: string;
  private orgId: string;

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  /**
   * Erstellt die Standard-Headers für API-Anfragen
   */
  private getHeaders(): HeadersInit {
    return {
      Authorization: this.apiKey,
    };
  }

  /**
   * Erstellt die vollständige API-URL mit Organisations-ID
   */
  private getUrl(endpoint: string): string {
    return `${BASE_URL}/${this.orgId}${endpoint}`;
  }

  /**
   * Lädt eine Datei (PDF) zur Buchhaltung hoch
   */
  async uploadFile(file: File): Promise<FileSystemEntityDTO[]> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.getUrl('/file/upload'), {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
      },
      body: formData,
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload fehlgeschlagen: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Lädt eine Datei aus Base64-Daten hoch
   */
  async uploadFileFromBase64(
    base64Data: string,
    fileName: string,
    mimeType: string = 'application/pdf'
  ): Promise<FileSystemEntityDTO[]> {
    // Base64 zu Blob konvertieren
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    return this.uploadFile(file);
  }

  /**
   * Ruft alle Transaktionen ab
   */
  async getTransactions(request: AllTransactionsRequest): Promise<TransactionDTO[]> {
    const response = await fetch(this.getUrl('/tax/transactions-all'), {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transaktionen abrufen fehlgeschlagen: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Verbindet eine Datei mit einer Transaktion
   */
  async connectTransaction(
    request: ConnectTransactionRequest
  ): Promise<ConnectTransactionResponse> {
    const response = await fetch(this.getUrl('/tax/connect-transaction'), {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'omit',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Verbindung fehlgeschlagen: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Testet die API-Verbindung
   */
  async testConnection(): Promise<boolean> {
    try {
      // Einfache Abfrage um zu testen ob die Verbindung funktioniert
      await this.getTransactions({
        filters: {
          settled: 'NONE',
          userInput: 'NONE',
          booked: 'NONE',
          type: 'NONE',
        },
      });
      return true;
    } catch (error) {
      console.error('API-Verbindungstest fehlgeschlagen:', error);
      return false;
    }
  }

  /**
   * Ruft alle Dateien/Dokumente aus boring.tax ab
   */
  async getFiles(): Promise<FileSystemEntityDTO[]> {
    try {
      const response = await fetch(this.getUrl('/file/list'), {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'omit',
        mode: 'cors',
      });

      if (!response.ok) {
        // Versuche alternativen Endpunkt
        const altResponse = await fetch(this.getUrl('/files'), {
          method: 'GET',
          headers: this.getHeaders(),
          credentials: 'omit',
          mode: 'cors',
        });

        if (!altResponse.ok) {
          console.warn('Dateien abrufen fehlgeschlagen:', response.status);
          return [];
        }

        return altResponse.json();
      }

      return response.json();
    } catch (error) {
      console.error('Fehler beim Abrufen der Dateien:', error);
      return [];
    }
  }

  /**
   * Ruft alle Dateinamen aus boring.tax ab
   */
  async getFileNames(): Promise<string[]> {
    const files = await this.getFiles();
    return files
      .filter(f => f.file !== null)
      .map(f => f.file?.orgFileName || f.name)
      .filter(Boolean) as string[];
  }
}

/**
 * Factory-Funktion zum Erstellen eines API-Clients
 */
export const createApiClient = (apiKey: string, orgId: string): BoringTaxApiClient => {
  return new BoringTaxApiClient(apiKey, orgId);
};
