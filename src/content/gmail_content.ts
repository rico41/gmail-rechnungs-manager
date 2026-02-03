import type {
  UploadPdfMessage,
  CheckStatusMessage,
  UploadResponse,
  CheckStatusResponse,
  CheckStatusByFilenameResponse,
} from '../types/api';

interface CheckStatusByFilenameMessage {
  type: 'CHECK_STATUS_BY_FILENAME';
  payload: {
    fileName: string;
  };
}

interface SyncBoringTaxFilesMessage {
  type: 'SYNC_BORING_TAX_FILES';
}

/**
 * Gmail Content Script
 * Erkennt PDF-Anhänge in E-Mails und fügt Upload-Buttons hinzu
 */

// Konstanten für Gmail DOM-Selektoren (mehrere Varianten für Robustheit)
const SELECTORS = {
  // Attachment Container in geöffneter E-Mail (mehrere Varianten)
  ATTACHMENT_CONTAINER: '.aQH, .aZo, [data-tooltip*="Anhang"], [data-tooltip*="attachment"], .aQw',
  // Einzelner Anhang (verschiedene Gmail-Versionen)
  ATTACHMENT_ITEM: '.aZo, .aQH .aZi, [data-tooltip*=".pdf"], .aQw .aZi, .aQH span[download], .aSG, .aQw, [role="listitem"][data-tooltip]',
  // Anhang-Name
  ATTACHMENT_NAME: '.aV3, .aQA span, [data-tooltip*=".pdf"], .aZi span, span[title*=".pdf"], .aQA, .aSG span, .aZc',
  // Download-Link Container
  ATTACHMENT_DOWNLOAD: '.aQy, .aZi, .aQA, [download], [data-tooltip], .aSG',
  // E-Mail Container
  EMAIL_CONTAINER: '.gs, .adn, .ii.gt',
  // E-Mail Subject
  EMAIL_SUBJECT: '.hP, [data-thread-perm-id] h2, .ha h2',
  // Message ID Container
  MESSAGE_CONTAINER: '[data-message-id], [data-legacy-message-id]',
  // Attachment Chips (neue Gmail-Version)
  ATTACHMENT_CHIPS: '.aQH .aZo, .aQw .aZi, [role="listitem"][data-tooltip*=".pdf"]',
} as const;

// CSS Klassen für unsere Elemente
const CLASSES = {
  UPLOAD_BUTTON: 'grm-upload-btn',
  STATUS_BADGE: 'grm-status-badge',
  PROCESSED: 'grm-processed',
  LOADING: 'grm-loading',
  INBOX_INDICATOR: 'grm-inbox-indicator',
  INBOX_PROCESSED: 'grm-inbox-processed',
} as const;

/**
 * Extrahiert die E-Mail-ID aus der URL oder DOM
 */
const extractEmailId = (): string | null => {
  // Versuche aus URL zu extrahieren
  const urlMatch = window.location.hash.match(/#[^/]+\/([^/]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Fallback: Versuche aus DOM zu extrahieren
  const messageContainer = document.querySelector(SELECTORS.MESSAGE_CONTAINER);
  if (messageContainer) {
    return messageContainer.getAttribute('data-message-id');
  }

  // Letzer Fallback: Generiere eine ID aus dem aktuellen Timestamp + URL
  return `gmail-${Date.now()}-${window.location.hash.replace(/[^a-zA-Z0-9]/g, '')}`;
};

/**
 * Extrahiert den E-Mail-Betreff
 */
const extractEmailSubject = (): string | undefined => {
  const subjectElement = document.querySelector(SELECTORS.EMAIL_SUBJECT);
  return subjectElement?.textContent || undefined;
};

/**
 * Prüft ob ein Anhang ein PDF ist
 */
const isPdfAttachment = (attachment: Element): boolean => {
  // Methode 1: Name-Element prüfen
  const nameElement = attachment.querySelector(SELECTORS.ATTACHMENT_NAME);
  const fileName = nameElement?.textContent?.toLowerCase() || '';
  if (fileName.endsWith('.pdf')) {
    return true;
  }

  // Methode 2: data-tooltip Attribut prüfen
  const tooltip = attachment.getAttribute('data-tooltip')?.toLowerCase() || '';
  if (tooltip.endsWith('.pdf') || tooltip.includes('.pdf')) {
    return true;
  }

  // Methode 3: title Attribut prüfen
  const title = attachment.getAttribute('title')?.toLowerCase() || '';
  if (title.endsWith('.pdf') || title.includes('.pdf')) {
    return true;
  }

  // Methode 4: Alle Text-Inhalte im Element prüfen
  const allText = attachment.textContent?.toLowerCase() || '';
  if (allText.includes('.pdf')) {
    return true;
  }

  // Methode 5: Aria-label prüfen
  const ariaLabel = attachment.getAttribute('aria-label')?.toLowerCase() || '';
  if (ariaLabel.endsWith('.pdf') || ariaLabel.includes('.pdf')) {
    return true;
  }

  return false;
};

/**
 * Extrahiert den Download-Link eines Anhangs
 */
const getAttachmentDownloadUrl = (attachment: Element): string | null => {
  console.log('[GRM] Searching for download URL in attachment...');
  
  // Methode 1: Direkter Download-Link
  const downloadLink = attachment.querySelector('a[href*="download"]');
  if (downloadLink?.getAttribute('href')) {
    console.log('[GRM] Found download link via a[href*="download"]');
    return downloadLink.getAttribute('href');
  }

  // Methode 2: Element mit download Attribut
  const hiddenDownload = attachment.querySelector('[download]');
  if (hiddenDownload?.getAttribute('href')) {
    console.log('[GRM] Found download link via [download]');
    return hiddenDownload.getAttribute('href');
  }

  // Methode 3: Suche in Gmail-spezifischen Containern
  const gmailDownloadSelectors = [
    'a[href*="mail.google.com"][href*="&attid="]',
    'a[href*="mail-attachment.googleusercontent.com"]',
    'a[href*="&view=att"]',
    'a[href*="attachment"]',
    'a[data-tooltip*="Herunterladen"]',
    'a[data-tooltip*="Download"]',
    'a[aria-label*="Herunterladen"]',
    'a[aria-label*="Download"]',
    'span[download] a',
    '.aQy a[href]',
    '.aZi a[href]',
  ];

  for (const selector of gmailDownloadSelectors) {
    const link = attachment.querySelector(selector);
    if (link?.getAttribute('href')) {
      console.log('[GRM] Found download link via:', selector);
      return link.getAttribute('href');
    }
  }

  // Methode 4: Suche im übergeordneten Container
  const parentContainer = attachment.closest('.aQH') || attachment.closest('.gs') || attachment.parentElement;
  if (parentContainer) {
    for (const selector of gmailDownloadSelectors) {
      const link = parentContainer.querySelector(selector);
      if (link?.getAttribute('href')) {
        console.log('[GRM] Found download link in parent via:', selector);
        return link.getAttribute('href');
      }
    }
  }

  // Methode 5: Alle Links im Anhang durchsuchen
  const allLinks = attachment.querySelectorAll('a[href]');
  for (const link of allLinks) {
    const href = link.getAttribute('href');
    if (href && (
      href.includes('mail.google.com') ||
      href.includes('googleusercontent.com') ||
      href.includes('download') ||
      href.includes('attachment') ||
      href.includes('attid=') ||
      href.includes('view=att')
    )) {
      console.log('[GRM] Found download link via href scan:', href.substring(0, 50));
      return href;
    }
  }

  // Methode 6: data-url Attribut prüfen
  const dataUrl = attachment.getAttribute('data-url') || attachment.querySelector('[data-url]')?.getAttribute('data-url');
  if (dataUrl) {
    console.log('[GRM] Found download link via data-url');
    return dataUrl;
  }

  console.log('[GRM] No download URL found, attachment HTML:', attachment.outerHTML.substring(0, 200));
  return null;
};

/**
 * Extrahiert den Dateinamen eines Anhangs
 */
const getAttachmentFileName = (attachment: Element): string => {
  // Methode 1: Name-Element
  const nameElement = attachment.querySelector(SELECTORS.ATTACHMENT_NAME);
  if (nameElement?.textContent?.includes('.pdf')) {
    return nameElement.textContent.trim();
  }

  // Methode 2: data-tooltip
  const tooltip = attachment.getAttribute('data-tooltip');
  if (tooltip?.includes('.pdf')) {
    return tooltip.trim();
  }

  // Methode 3: title Attribut
  const title = attachment.getAttribute('title');
  if (title?.includes('.pdf')) {
    return title.trim();
  }

  // Methode 4: aria-label
  const ariaLabel = attachment.getAttribute('aria-label');
  if (ariaLabel?.includes('.pdf')) {
    return ariaLabel.trim();
  }

  // Methode 5: Text-Content durchsuchen
  const allText = attachment.textContent || '';
  const pdfMatch = allText.match(/[\w\-_.]+\.pdf/i);
  if (pdfMatch) {
    return pdfMatch[0];
  }

  return 'document.pdf';
};

/**
 * Sendet eine Nachricht an den Service Worker
 */
const sendMessage = <T>(message: unknown): Promise<T> => {
  return new Promise((resolve, reject) => {
    // Prüfe ob der Extension-Kontext noch gültig ist
    if (!chrome.runtime?.id) {
      reject(new Error('Extension wurde neu geladen. Bitte die Seite aktualisieren (F5).'));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || 'Unbekannter Fehler';
          if (errorMsg.includes('Extension context invalidated') || 
              errorMsg.includes('Receiving end does not exist')) {
            reject(new Error('Extension wurde neu geladen. Bitte die Seite aktualisieren (F5).'));
          } else {
            reject(new Error(errorMsg));
          }
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(new Error('Extension wurde neu geladen. Bitte die Seite aktualisieren (F5).'));
    }
  });
};

/**
 * Lädt die PDF-Datei herunter und konvertiert sie zu Base64
 */
const downloadPdfAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Erstellt den Upload-Button
 */
const createUploadButton = (
  attachment: Element,
  emailId: string,
  subject?: string
): HTMLButtonElement => {
  const fileName = getAttachmentFileName(attachment);
  
  const button = document.createElement('button');
  button.className = CLASSES.UPLOAD_BUTTON;
  button.setAttribute('data-filename', fileName);
  button.setAttribute('data-email-id', emailId);
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <span>Senden</span>
  `;
  button.title = 'An Buchhaltung senden';
  button.setAttribute('aria-label', 'Rechnung an Buchhaltung senden');
  button.tabIndex = 0;

  const handleUpload = async () => {
    if (button.classList.contains(CLASSES.LOADING)) {
      return;
    }

    button.classList.add(CLASSES.LOADING);
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" class="grm-spinner">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
      </svg>
      <span>Wird gesendet...</span>
    `;

    try {
      const fileName = getAttachmentFileName(attachment);
      console.log('[GRM] Starting upload for:', fileName);
      
      // Finde den Download-Link
      let downloadUrl = getAttachmentDownloadUrl(attachment);
      
      // Suche auch im übergeordneten Container
      if (!downloadUrl) {
        const parentRow = attachment.closest('.aQH') || attachment.closest('[data-tooltip]')?.parentElement;
        if (parentRow) {
          downloadUrl = getAttachmentDownloadUrl(parentRow);
        }
      }

      // Suche nach dem Download-Button und extrahiere den Link daraus
      if (!downloadUrl) {
        console.log('[GRM] Searching for download button...');
        const downloadButtons = document.querySelectorAll('[data-tooltip*="Herunterladen"], [data-tooltip*="Download"], [aria-label*="Herunterladen"], [aria-label*="Download"]');
        for (const btn of downloadButtons) {
          // Prüfe ob dieser Download-Button zum selben Anhang gehört
          const parentAttachment = btn.closest('.aQH') || btn.closest('.aZo');
          if (parentAttachment === attachment || parentAttachment?.contains(attachment) || attachment.contains(btn as Element)) {
            const link = btn.closest('a') || btn.querySelector('a');
            if (link?.getAttribute('href')) {
              downloadUrl = link.getAttribute('href');
              console.log('[GRM] Found URL via download button');
              break;
            }
          }
        }
      }

      // Letzte Option: Suche nach img oder svg Download-Icons
      if (!downloadUrl) {
        const downloadIcon = attachment.querySelector('img[src*="download"], svg') as HTMLElement;
        if (downloadIcon) {
          const parentLink = downloadIcon.closest('a');
          if (parentLink?.getAttribute('href')) {
            downloadUrl = parentLink.getAttribute('href');
            console.log('[GRM] Found URL via download icon');
          }
        }
      }

      if (!downloadUrl) {
        console.error('[GRM] Could not find download URL. Attachment structure:', attachment.innerHTML.substring(0, 500));
        throw new Error('Download-Link nicht gefunden. Bitte lade die Datei manuell herunter und nutze den Upload im Popup.');
      }

      // Vollständige URL erstellen wenn nötig
      if (downloadUrl.startsWith('/')) {
        downloadUrl = `https://mail.google.com${downloadUrl}`;
      }

      console.log('[GRM] Downloading from:', downloadUrl.substring(0, 80) + '...');

      // PDF herunterladen und konvertieren
      const fileData = await downloadPdfAsBase64(downloadUrl);

      // An Service Worker senden
      const message: UploadPdfMessage = {
        type: 'UPLOAD_PDF',
        payload: {
          fileName,
          fileData,
          emailId,
          subject,
        },
      };

      const response = await sendMessage<UploadResponse>(message);

      if (response.success) {
        // Erfolg - Button durch Status-Badge ersetzen
        replaceButtonWithBadge(button, true);
        showNotification('Rechnung erfolgreich übertragen!', 'success');
      } else {
        throw new Error(response.error || 'Upload fehlgeschlagen');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Upload';
      
      // Spezielle Behandlung für Extension-Reload
      if (errorMessage.includes('neu geladen') || errorMessage.includes('aktualisieren')) {
        button.classList.remove(CLASSES.LOADING);
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>Neu laden</span>
        `;
        button.title = 'Seite neu laden (F5)';
        showNotification('Extension wurde aktualisiert. Bitte die Seite neu laden (F5).', 'error');
        return; // Nicht zurücksetzen
      }
      
      button.classList.remove(CLASSES.LOADING);
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>Fehler</span>
      `;
      button.title = errorMessage;
      showNotification(errorMessage, 'error');

      // Nach 3 Sekunden zurücksetzen
      setTimeout(() => {
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Senden</span>
        `;
        button.title = 'An Buchhaltung senden';
      }, 3000);
    }
  };

  button.addEventListener('click', handleUpload);
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleUpload();
    }
  });

  return button;
};

/**
 * Erstellt das Status-Badge für bereits übertragene Anhänge
 */
const createStatusBadge = (transferDate?: string): HTMLSpanElement => {
  const badge = document.createElement('span');
  badge.className = CLASSES.STATUS_BADGE;
  badge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>Übertragen</span>
  `;
  badge.title = transferDate
    ? `Übertragen am ${new Date(transferDate).toLocaleString('de-DE')}`
    : 'Bereits an Buchhaltung übertragen';
  return badge;
};

/**
 * Ersetzt einen Button durch ein Status-Badge
 */
const replaceButtonWithBadge = (button: HTMLButtonElement, animate: boolean = false): void => {
  const badge = createStatusBadge(new Date().toISOString());
  if (animate) {
    badge.classList.add('grm-animate-in');
  }
  button.replaceWith(badge);
};

/**
 * Zeigt eine Benachrichtigung an
 */
const showNotification = (message: string, type: 'success' | 'error'): void => {
  // Entferne bestehende Benachrichtigungen
  const existing = document.querySelector('.grm-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `grm-notification grm-notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="grm-notification-close" aria-label="Schließen">&times;</button>
  `;

  notification.querySelector('.grm-notification-close')?.addEventListener('click', () => {
    notification.remove();
  });

  document.body.appendChild(notification);

  // Auto-entfernen nach 5 Sekunden
  setTimeout(() => {
    notification.classList.add('grm-notification-fade');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
};

/**
 * Verarbeitet einen Anhang
 */
const processAttachment = async (attachment: Element): Promise<void> => {
  // Bereits verarbeitet?
  if (attachment.classList.contains(CLASSES.PROCESSED)) {
    return;
  }

  // Bereits ein Button/Badge vorhanden?
  if (attachment.querySelector(`.${CLASSES.UPLOAD_BUTTON}`) || 
      attachment.querySelector(`.${CLASSES.STATUS_BADGE}`)) {
    attachment.classList.add(CLASSES.PROCESSED);
    return;
  }

  // Ist es ein PDF?
  if (!isPdfAttachment(attachment)) {
    console.log('[GRM] Skipping non-PDF attachment:', attachment.textContent?.substring(0, 30));
    return;
  }

  const fileName = getAttachmentFileName(attachment);
  
  // Verhindere doppelte Verarbeitung derselben Datei
  const existingButtons = document.querySelectorAll(`.${CLASSES.UPLOAD_BUTTON}`);
  for (const btn of existingButtons) {
    if (btn.getAttribute('data-filename') === fileName) {
      console.log('[GRM] Button already exists for:', fileName);
      attachment.classList.add(CLASSES.PROCESSED);
      return;
    }
  }

  console.log('[GRM] Processing PDF attachment:', fileName);
  attachment.classList.add(CLASSES.PROCESSED);

  const emailId = extractEmailId();
  if (!emailId) {
    console.warn('[GRM] Konnte keine E-Mail-ID extrahieren');
    return;
  }

  const subject = extractEmailSubject();

  // Prüfe ob bereits übertragen - zuerst nach Dateinamen, dann nach Email-ID
  const checkByFilenameMessage: CheckStatusByFilenameMessage = {
    type: 'CHECK_STATUS_BY_FILENAME',
    payload: { fileName },
  };

  const checkByEmailMessage: CheckStatusMessage = {
    type: 'CHECK_STATUS',
    payload: { emailId },
  };

  // Finde den besten Container für den Button
  const findButtonContainer = (): Element => {
    // Versuche verschiedene Container-Selektoren
    const containerSelectors = [
      '.aQy',           // Standard Gmail Download-Bereich
      '.aZi',           // Alternative
      '.aQA',           // Neue Version
      '.aSG',           // Alternative
    ];

    for (const selector of containerSelectors) {
      const container = attachment.querySelector(selector);
      if (container) {
        console.log('[GRM] Button container found:', selector);
        return container;
      }
    }

    // Fallback: Direkt nach dem Anhang einfügen
    console.log('[GRM] No specific container found, using attachment itself');
    return attachment;
  };

  // Erstelle einen Wrapper für den Button, falls nötig
  const createButtonWrapper = (): HTMLDivElement => {
    const wrapper = document.createElement('div');
    wrapper.className = 'grm-button-wrapper';
    wrapper.style.cssText = 'display: inline-block !important; margin-left: 8px !important; vertical-align: middle !important;';
    return wrapper;
  };

  // Funktion zum Einfügen des Buttons/Badges
  const insertElement = (element: HTMLElement) => {
    const buttonContainer = findButtonContainer();
    
    // Versuche verschiedene Einfüge-Methoden
    try {
      // Methode 1: Am Ende des Containers anhängen
      buttonContainer.appendChild(element);
      
      // Prüfen ob Element sichtbar ist
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.log('[GRM] Element might be hidden, trying alternative placement');
        // Methode 2: Als Geschwister nach dem Anhang einfügen
        if (attachment.parentElement) {
          attachment.parentElement.insertBefore(element, attachment.nextSibling);
        }
      }
    } catch (e) {
      console.error('[GRM] Error inserting element:', e);
      // Letzte Chance: An den Anhang selbst anhängen
      attachment.appendChild(element);
    }
  };

  try {
    // Prüfe zuerst nach Dateinamen (für boring.tax Abgleich)
    const filenameStatus = await sendMessage<CheckStatusByFilenameResponse>(checkByFilenameMessage);
    
    // Dann auch nach Email-ID prüfen (für lokal gespeicherte)
    const emailStatus = await sendMessage<CheckStatusResponse>(checkByEmailMessage);

    const isAlreadyInBoringTax = filenameStatus.isInBoringTax || emailStatus.isTransferred;
    const transferDate = filenameStatus.transferInfo?.transferDate || emailStatus.transferInfo?.transferDate;

    if (isAlreadyInBoringTax) {
      // Zeige grünes Status-Badge mit Haken
      const badge = createStatusBadge(transferDate);
      insertElement(badge);
      console.log('[GRM] Status badge added (already in boring.tax) for:', fileName);
    } else {
      // Zeige Upload-Button
      const button = createUploadButton(attachment, emailId, subject);
      insertElement(button);
      console.log('[GRM] Upload button added for:', fileName);
    }
  } catch (error) {
    console.error('[GRM] Fehler beim Prüfen des Status:', error);
    // Im Fehlerfall trotzdem Button anzeigen
    const button = createUploadButton(attachment, emailId, subject);
    insertElement(button);
    console.log('[GRM] Upload button added (fallback) for:', fileName);
  }
};

/**
 * Prüft ob wir uns in einer geöffneten E-Mail befinden (nicht in der Inbox-Übersicht)
 */
const isInOpenedEmail = (): boolean => {
  // Prüfe ob die URL auf eine geöffnete E-Mail hinweist
  const hash = window.location.hash;
  // Gmail URLs für geöffnete E-Mails enthalten meist einen langen ID-String
  const isEmailView = hash.includes('/') && (
    hash.match(/#[^/]+\/[A-Za-z0-9]+/) !== null ||
    hash.includes('#inbox/') ||
    hash.includes('#sent/') ||
    hash.includes('#all/') ||
    hash.includes('#starred/') ||
    hash.includes('#label/')
  );
  
  // Zusätzlich prüfen ob ein E-Mail-Container sichtbar ist
  const emailContainer = document.querySelector('.adn.ads, .nH.if, .h7');
  
  return isEmailView && emailContainer !== null;
};

/**
 * Scannt die Seite nach PDF-Anhängen
 */
const scanForAttachments = (): void => {
  console.log('[GRM] Scanning for attachments...');
  
  // Nur in geöffneten E-Mails scannen, nicht in der Inbox-Übersicht
  if (!isInOpenedEmail()) {
    console.log('[GRM] Not in opened email view, skipping scan');
    return;
  }
  
  // Suche nur in den Attachment-Bereichen von geöffneten E-Mails
  // Diese haben typischerweise die Klasse .aQH (Attachment-Container)
  const emailAttachmentContainers = document.querySelectorAll('.aQH');
  
  if (emailAttachmentContainers.length === 0) {
    console.log('[GRM] No attachment containers found in email');
    return;
  }
  
  console.log(`[GRM] Found ${emailAttachmentContainers.length} attachment containers`);
  
  // Innerhalb der Container nach einzelnen Anhängen suchen
  emailAttachmentContainers.forEach((container) => {
    const attachments = container.querySelectorAll('.aZo, .aQw .aZi, [role="listitem"]');
    console.log(`[GRM] Found ${attachments.length} attachments in container`);
    
    attachments.forEach((attachment) => {
      processAttachment(attachment);
    });
    
    // Fallback: Wenn keine Anhänge gefunden, den Container selbst prüfen
    if (attachments.length === 0) {
      // Suche nach Download-Links im Container
      const downloadableItems = container.querySelectorAll('[data-tooltip*=".pdf"], [title*=".pdf"], a[href*="download"], a[href*="attachment"]');
      downloadableItems.forEach((item) => {
        const parent = item.closest('.aZo') || item.closest('[role="listitem"]') || item.parentElement;
        if (parent && !parent.classList.contains(CLASSES.PROCESSED)) {
          processAttachment(parent);
        }
      });
    }
  });
};

/**
 * Initialisiert den MutationObserver
 */
const initObserver = (): void => {
  let scanTimeout: ReturnType<typeof setTimeout> | null = null;
  let inboxScanTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const observer = new MutationObserver((mutations) => {
    let shouldScanEmail = false;
    let shouldScanInbox = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            // Prüfe ob neue Anhänge in einer E-Mail hinzugefügt wurden
            const isEmailAttachmentArea = 
              node.classList?.contains('aQH') ||
              node.querySelector?.('.aQH') ||
              node.classList?.contains('aZo') ||
              node.querySelector?.('.aZo') ||
              node.classList?.contains('adn') ||
              node.querySelector?.('.adn');

            // Prüfe ob neue Inbox-Zeilen hinzugefügt wurden
            const isInboxRow = 
              node.classList?.contains('brc') ||
              node.querySelector?.('.brc') ||
              node.classList?.contains('zA') ||
              node.querySelector?.('.zA') ||
              (node.querySelector?.('[title*=".pdf"]') && !isInOpenedEmail());

            if (isEmailAttachmentArea && isInOpenedEmail()) {
              shouldScanEmail = true;
            }
            
            if (isInboxRow && !isInOpenedEmail()) {
              shouldScanInbox = true;
            }
          }
        }
      }
    }

    if (shouldScanEmail) {
      if (scanTimeout) {
        clearTimeout(scanTimeout);
      }
      scanTimeout = setTimeout(() => {
        console.log('[GRM] MutationObserver triggered email scan');
        scanForAttachments();
      }, 300);
    }

    if (shouldScanInbox) {
      if (inboxScanTimeout) {
        clearTimeout(inboxScanTimeout);
      }
      inboxScanTimeout = setTimeout(() => {
        console.log('[GRM] MutationObserver triggered inbox scan');
        scanInboxForTransferredEmails();
      }, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('[GRM] MutationObserver initialized');
};

/**
 * Erstellt den grünen Haken-Indikator für die Inbox
 */
const createInboxIndicator = (fileName: string, transferDate?: string): HTMLSpanElement => {
  const indicator = document.createElement('span');
  indicator.className = CLASSES.INBOX_INDICATOR;
  indicator.setAttribute('data-tooltip', transferDate 
    ? `${fileName} - Übertragen am ${new Date(transferDate).toLocaleDateString('de-DE')}`
    : `${fileName} - Bereits übertragen`
  );
  indicator.innerHTML = `
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  `;
  return indicator;
};

/**
 * Scannt die Inbox-Übersicht nach E-Mails mit bereits übertragenen PDFs
 */
const scanInboxForTransferredEmails = async (): Promise<void> => {
  // Nur in der Inbox/Übersicht ausführen, nicht in geöffneten E-Mails
  if (isInOpenedEmail()) {
    return;
  }

  console.log('[GRM] Scanning inbox for transferred PDFs...');

  // Finde alle Anhang-Chips in der Inbox-Übersicht
  // Diese haben typischerweise die Klasse .brc oder .brg (Attachment Chips)
  const attachmentChips = document.querySelectorAll('.brc[title*=".pdf"], .brg[title*=".pdf"], [data-tooltip*=".pdf"]:not(.grm-inbox-processed)');
  
  console.log(`[GRM] Found ${attachmentChips.length} PDF attachment chips in inbox`);

  for (const chip of attachmentChips) {
    // Markiere als verarbeitet um Duplikate zu vermeiden
    if (chip.classList.contains(CLASSES.INBOX_PROCESSED)) {
      continue;
    }
    chip.classList.add(CLASSES.INBOX_PROCESSED);

    // Extrahiere den Dateinamen
    const fileName = chip.getAttribute('title') || chip.getAttribute('data-tooltip') || '';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      continue;
    }

    try {
      // Prüfe ob die Datei bereits übertragen wurde
      const checkMessage: CheckStatusByFilenameMessage = {
        type: 'CHECK_STATUS_BY_FILENAME',
        payload: { fileName },
      };

      const status = await sendMessage<CheckStatusByFilenameResponse>(checkMessage);

      if (status.isInBoringTax) {
        console.log('[GRM] Found transferred PDF in inbox:', fileName);
        
        // Füge den grünen Haken neben dem Chip ein
        const indicator = createInboxIndicator(fileName, status.transferInfo?.transferDate);
        
        // Versuche den Indikator nach dem Chip einzufügen
        if (chip.parentElement) {
          chip.parentElement.insertBefore(indicator, chip.nextSibling);
        }
      }
    } catch (error) {
      // Ignoriere Fehler (z.B. wenn Extension neu geladen wurde)
      console.log('[GRM] Error checking inbox item:', error);
    }
  }
};

/**
 * Synchronisiert die boring.tax Dateien im Hintergrund
 */
const syncBoringTaxFiles = async (): Promise<void> => {
  try {
    console.log('[GRM] Syncing boring.tax files...');
    const syncMessage: SyncBoringTaxFilesMessage = {
      type: 'SYNC_BORING_TAX_FILES',
    };
    const result = await sendMessage<{ success: boolean; error?: string }>(syncMessage);
    if (result.success) {
      console.log('[GRM] boring.tax files synced successfully');
    } else {
      console.log('[GRM] boring.tax sync skipped:', result.error);
    }
  } catch (error) {
    console.log('[GRM] boring.tax sync failed (API may not be configured):', error);
  }
};

/**
 * Initialisierung
 */
const init = (): void => {
  console.log('[GRM] Gmail Rechnungs-Manager Content Script geladen');
  console.log('[GRM] Version 1.0.0 - Running on:', window.location.href);

  // Synchronisiere boring.tax Dateien beim Start
  syncBoringTaxFiles();

  // Initialen Scan durchführen (mit Verzögerung für Gmail-Ladezeit)
  setTimeout(() => {
    console.log('[GRM] Initial scan starting...');
    scanForAttachments();
    scanInboxForTransferredEmails();
  }, 1000);

  // Zweiter Scan nach 3 Sekunden (Gmail lädt dynamisch)
  setTimeout(() => {
    console.log('[GRM] Secondary scan...');
    scanForAttachments();
    scanInboxForTransferredEmails();
  }, 3000);

  // Observer für dynamische Inhalte starten
  initObserver();

  // Auch bei URL-Änderungen scannen (Gmail ist eine SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[GRM] URL changed, scheduling scan...');
      setTimeout(() => {
        scanForAttachments();
        scanInboxForTransferredEmails();
      }, 500);
      setTimeout(() => {
        scanForAttachments();
        scanInboxForTransferredEmails();
      }, 1500);
    }
  }, 1000);

  // Regelmäßiger Scan alle 5 Sekunden für verpasste Anhänge
  setInterval(() => {
    if (isInOpenedEmail()) {
      scanForAttachments();
    } else {
      // In der Inbox nach übertragenen E-Mails scannen
      scanInboxForTransferredEmails();
    }
  }, 5000);

  // Synchronisiere boring.tax Dateien alle 5 Minuten
  setInterval(() => {
    syncBoringTaxFiles();
  }, 5 * 60 * 1000);
};

// Starte wenn DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
