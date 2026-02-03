import type {
  GetSettingsMessage,
  SaveSettingsMessage,
  GetTransferredListMessage,
  RemoveTransferredMessage,
  TestConnectionMessage,
  SettingsResponse,
  TransferredListResponse,
  GenericResponse,
  TransferredEmail,
} from '../types/api';

/**
 * Options Page Script für Gmail Rechnungs-Manager
 */

// DOM Elements
const elements = {
  settingsForm: document.getElementById('settingsForm') as HTMLFormElement,
  apiKeyInput: document.getElementById('apiKey') as HTMLInputElement,
  orgIdInput: document.getElementById('orgId') as HTMLInputElement,
  saveBtn: document.getElementById('saveBtn') as HTMLButtonElement,
  testBtn: document.getElementById('testBtn') as HTMLButtonElement,
  statusMessage: document.getElementById('statusMessage') as HTMLElement,
  transfersList: document.getElementById('transfersList') as HTMLElement,
  transferCount: document.getElementById('transferCount') as HTMLElement,
  clearAllBtn: document.getElementById('clearAllBtn') as HTMLButtonElement,
  versionInfo: document.getElementById('versionInfo') as HTMLElement,
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
 * Zeigt eine Status-Nachricht an
 */
const showStatus = (message: string, type: 'success' | 'error' | 'info'): void => {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove('hidden');

  // Auto-hide nach 5 Sekunden für Erfolg
  if (type === 'success') {
    setTimeout(() => {
      elements.statusMessage.classList.add('hidden');
    }, 5000);
  }
};

/**
 * Versteckt die Status-Nachricht
 */
const hideStatus = (): void => {
  elements.statusMessage.classList.add('hidden');
};

/**
 * Formatiert ein Datum
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
 * Lädt die aktuellen Einstellungen
 */
const loadSettings = async (): Promise<void> => {
  try {
    const message: GetSettingsMessage = { type: 'GET_SETTINGS' };
    const settings = await sendMessage<SettingsResponse>(message);

    elements.apiKeyInput.value = settings.apiKey;
    elements.orgIdInput.value = settings.orgId;
  } catch (error) {
    console.error('Fehler beim Laden der Einstellungen:', error);
    showStatus('Fehler beim Laden der Einstellungen', 'error');
  }
};

/**
 * Speichert die Einstellungen
 */
const saveSettings = async (): Promise<void> => {
  const apiKey = elements.apiKeyInput.value.trim();
  const orgId = elements.orgIdInput.value.trim();

  if (!apiKey || !orgId) {
    showStatus('Bitte fülle alle Felder aus', 'error');
    return;
  }

  elements.saveBtn.disabled = true;
  elements.saveBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" class="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
    </svg>
    Speichern...
  `;

  try {
    const message: SaveSettingsMessage = {
      type: 'SAVE_SETTINGS',
      payload: { apiKey, orgId },
    };
    const response = await sendMessage<GenericResponse>(message);

    if (response.success) {
      if (response.error) {
        // Gespeichert aber mit Warnung
        showStatus(response.error, 'info');
      } else {
        showStatus('Einstellungen erfolgreich gespeichert', 'success');
      }
    } else {
      showStatus(response.error || 'Fehler beim Speichern', 'error');
    }
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    showStatus('Fehler beim Speichern der Einstellungen', 'error');
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Speichern
    `;
  }
};

/**
 * Testet die API-Verbindung über den Service Worker
 */
const testConnection = async (): Promise<void> => {
  const apiKey = elements.apiKeyInput.value.trim();
  const orgId = elements.orgIdInput.value.trim();

  if (!apiKey || !orgId) {
    showStatus('Bitte fülle zuerst alle Felder aus', 'error');
    return;
  }

  elements.testBtn.disabled = true;
  elements.testBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" class="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
    </svg>
    Teste...
  `;

  try {
    const message: TestConnectionMessage = {
      type: 'TEST_CONNECTION',
      payload: { apiKey, orgId },
    };
    const response = await sendMessage<GenericResponse>(message);

    if (response.success) {
      showStatus('Verbindung erfolgreich! Die API ist erreichbar.', 'success');
    } else {
      showStatus(response.error || 'Verbindung fehlgeschlagen. Bitte prüfe deine Eingaben.', 'error');
    }
  } catch (error) {
    console.error('Verbindungstest fehlgeschlagen:', error);
    showStatus(
      `Verbindungsfehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      'error'
    );
  } finally {
    elements.testBtn.disabled = false;
    elements.testBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Verbindung testen
    `;
  }
};

/**
 * Lädt und rendert die Liste der übertragenen E-Mails
 */
const loadTransferredEmails = async (): Promise<void> => {
  try {
    const message: GetTransferredListMessage = { type: 'GET_TRANSFERRED_LIST' };
    const { emails } = await sendMessage<TransferredListResponse>(message);

    renderTransferredList(emails);
    elements.transferCount.textContent = `${emails.length} Rechnung${emails.length !== 1 ? 'en' : ''}`;
  } catch (error) {
    console.error('Fehler beim Laden der übertragenen E-Mails:', error);
    elements.transfersList.innerHTML = `
      <div class="empty-placeholder">Fehler beim Laden</div>
    `;
  }
};

/**
 * Rendert die Liste der übertragenen E-Mails
 */
const renderTransferredList = (emails: TransferredEmail[]): void => {
  if (emails.length === 0) {
    elements.transfersList.innerHTML = `
      <div class="empty-placeholder">
        Noch keine Rechnungen übertragen
      </div>
    `;
    return;
  }

  elements.transfersList.innerHTML = emails
    .map(
      (email) => `
      <div class="transfer-item" data-email-id="${escapeHtml(email.emailId)}">
        <div class="transfer-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name" title="${escapeHtml(email.fileName)}">${escapeHtml(email.fileName)}</div>
          <div class="transfer-meta">
            ${formatDate(email.transferDate)}
            ${email.subject ? ` · ${escapeHtml(email.subject.substring(0, 30))}${email.subject.length > 30 ? '...' : ''}` : ''}
          </div>
        </div>
        <div class="transfer-actions">
          <button 
            type="button" 
            class="btn-icon delete-btn" 
            title="Eintrag löschen"
            aria-label="Eintrag löschen"
            data-email-id="${escapeHtml(email.emailId)}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `
    )
    .join('');

  // Event Listeners für Delete-Buttons
  elements.transfersList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const emailId = (e.currentTarget as HTMLElement).dataset.emailId;
      if (emailId) {
        await removeTransferred(emailId);
      }
    });
  });
};

/**
 * Entfernt einen übertragenen Eintrag
 */
const removeTransferred = async (emailId: string): Promise<void> => {
  if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) {
    return;
  }

  try {
    const message: RemoveTransferredMessage = {
      type: 'REMOVE_TRANSFERRED',
      payload: { emailId },
    };
    const response = await sendMessage<GenericResponse>(message);

    if (response.success) {
      await loadTransferredEmails();
    } else {
      showStatus(response.error || 'Fehler beim Löschen', 'error');
    }
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    showStatus('Fehler beim Löschen des Eintrags', 'error');
  }
};

/**
 * Löscht alle übertragenen Einträge
 */
const clearAllTransferred = async (): Promise<void> => {
  if (!confirm('Möchtest du wirklich ALLE Einträge löschen? Dies kann nicht rückgängig gemacht werden.')) {
    return;
  }

  try {
    // Wir müssen alle einzeln löschen, da wir keinen "clear all" Endpoint haben
    const message: GetTransferredListMessage = { type: 'GET_TRANSFERRED_LIST' };
    const { emails } = await sendMessage<TransferredListResponse>(message);

    for (const email of emails) {
      const deleteMessage: RemoveTransferredMessage = {
        type: 'REMOVE_TRANSFERRED',
        payload: { emailId: email.emailId },
      };
      await sendMessage<GenericResponse>(deleteMessage);
    }

    await loadTransferredEmails();
    showStatus('Alle Einträge wurden gelöscht', 'success');
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    showStatus('Fehler beim Löschen der Einträge', 'error');
  }
};

/**
 * Event Listeners
 */
const initEventListeners = (): void => {
  // Form Submit
  elements.settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  // Test Button
  elements.testBtn.addEventListener('click', testConnection);

  // Clear All Button
  elements.clearAllBtn.addEventListener('click', clearAllTransferred);
};

/**
 * Initialisierung
 */
const init = async (): Promise<void> => {
  // Version anzeigen
  const manifest = chrome.runtime.getManifest();
  elements.versionInfo.textContent = manifest.version;

  // Event Listeners
  initEventListeners();

  // Daten laden
  await Promise.all([loadSettings(), loadTransferredEmails()]);
};

// CSS für Spinner Animation hinzufügen
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);

// Start
document.addEventListener('DOMContentLoaded', init);
