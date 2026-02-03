import type {
  GetSettingsMessage,
  GetTransferredListMessage,
  SettingsResponse,
  TransferredListResponse,
  TransferredEmail,
} from '../types/api';

/**
 * Popup Script für Gmail Rechnungs-Manager
 */

// DOM Elements
const elements = {
  statusIndicator: document.getElementById('statusIndicator') as HTMLElement,
  totalCount: document.getElementById('totalCount') as HTMLElement,
  todayCount: document.getElementById('todayCount') as HTMLElement,
  recentList: document.getElementById('recentList') as HTMLElement,
  notConfigured: document.getElementById('notConfigured') as HTMLElement,
  settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
  configureBtn: document.getElementById('configureBtn') as HTMLButtonElement,
};

/**
 * Sendet eine Nachricht an den Service Worker
 */
const sendMessage = <T>(message: unknown): Promise<T> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
};

/**
 * Aktualisiert die Status-Anzeige
 */
const updateStatus = (isConnected: boolean, isConfigured: boolean): void => {
  const statusDot = elements.statusIndicator.querySelector('.status-dot') as HTMLElement;
  const statusText = elements.statusIndicator.querySelector('.status-text') as HTMLElement;

  statusDot.classList.remove('status-loading', 'status-connected', 'status-disconnected');

  if (!isConfigured) {
    statusDot.classList.add('status-disconnected');
    statusText.textContent = 'Nicht konfiguriert';
    elements.notConfigured.classList.remove('hidden');
  } else if (isConnected) {
    statusDot.classList.add('status-connected');
    statusText.textContent = 'Verbunden mit boring.tax';
    elements.notConfigured.classList.add('hidden');
  } else {
    statusDot.classList.add('status-disconnected');
    statusText.textContent = 'Verbindung fehlgeschlagen';
    elements.notConfigured.classList.add('hidden');
  }
};

/**
 * Formatiert ein Datum relativ
 */
const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Gerade eben';
  } else if (diffMins < 60) {
    return `Vor ${diffMins} Min.`;
  } else if (diffHours < 24) {
    return `Vor ${diffHours} Std.`;
  } else if (diffDays < 7) {
    return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
  } else {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
};

/**
 * Zählt die heutigen Übertragungen
 */
const countTodayTransfers = (emails: TransferredEmail[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return emails.filter((email) => {
    const emailDate = new Date(email.transferDate);
    emailDate.setHours(0, 0, 0, 0);
    return emailDate.getTime() === today.getTime();
  }).length;
};

/**
 * Rendert die Liste der letzten Übertragungen
 */
const renderRecentList = (emails: TransferredEmail[]): void => {
  if (emails.length === 0) {
    elements.recentList.innerHTML = `
      <div class="empty-placeholder">
        Noch keine Rechnungen übertragen
      </div>
    `;
    return;
  }

  // Zeige nur die letzten 5
  const recentEmails = emails.slice(0, 5);

  elements.recentList.innerHTML = recentEmails
    .map(
      (email) => `
      <div class="recent-item">
        <div class="recent-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="recent-info">
          <div class="recent-name" title="${escapeHtml(email.fileName)}">${escapeHtml(email.fileName)}</div>
          <div class="recent-date">${formatRelativeDate(email.transferDate)}</div>
        </div>
      </div>
    `
    )
    .join('');
};

/**
 * Escaped HTML-Sonderzeichen
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Lädt und zeigt die Daten an
 */
const loadData = async (): Promise<void> => {
  try {
    // Einstellungen abrufen
    const settingsMessage: GetSettingsMessage = { type: 'GET_SETTINGS' };
    const settings = await sendMessage<SettingsResponse>(settingsMessage);

    // Übertragene E-Mails abrufen
    const listMessage: GetTransferredListMessage = { type: 'GET_TRANSFERRED_LIST' };
    const { emails } = await sendMessage<TransferredListResponse>(listMessage);

    // Status aktualisieren
    updateStatus(settings.isConfigured, settings.isConfigured);

    // Statistiken aktualisieren
    elements.totalCount.textContent = emails.length.toString();
    elements.todayCount.textContent = countTodayTransfers(emails).toString();

    // Liste rendern
    renderRecentList(emails);
  } catch (error) {
    console.error('Fehler beim Laden der Daten:', error);
    updateStatus(false, false);
    elements.totalCount.textContent = '-';
    elements.todayCount.textContent = '-';
    elements.recentList.innerHTML = `
      <div class="empty-placeholder">
        Fehler beim Laden
      </div>
    `;
  }
};

/**
 * Öffnet die Einstellungsseite
 */
const openSettings = (): void => {
  chrome.runtime.openOptionsPage();
};

/**
 * Event Listeners
 */
const initEventListeners = (): void => {
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.configureBtn.addEventListener('click', openSettings);

  // Keyboard support
  elements.settingsBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSettings();
    }
  });
};

/**
 * Initialisierung
 */
const init = (): void => {
  initEventListeners();
  loadData();
};

// Start
document.addEventListener('DOMContentLoaded', init);
