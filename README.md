# Gmail Rechnungs-Manager Chrome Extension

Eine Chrome-Erweiterung zur Verwaltung von Rechnungs-PDFs in Gmail mit direkter Integration zu boring.tax.

## Features

- **PDF-Erkennung**: Erkennt automatisch PDF-Anhänge in Gmail-E-Mails
- **Ein-Klick-Upload**: Sende Rechnungen direkt an deine boring.tax Buchhaltung
- **Status-Tracking**: Markiert bereits übertragene E-Mails
- **Übersichtliche Verwaltung**: Popup mit Statistiken und letzten Übertragungen

## Installation

### Entwicklungsmodus

1. **Dependencies installieren**:
   ```bash
   npm install
   ```

2. **Extension bauen**:
   ```bash
   npm run build
   ```

3. **In Chrome laden**:
   - Öffne `chrome://extensions/`
   - Aktiviere "Entwicklermodus" (oben rechts)
   - Klicke "Entpackte Erweiterung laden"
   - Wähle den `dist`-Ordner aus

### Entwicklung mit Watch-Mode

```bash
npm run dev
```

## Konfiguration

Nach der Installation:

1. Klicke auf das Extension-Icon in Chrome
2. Öffne die Einstellungen (Zahnrad-Icon)
3. Gib deinen **API-Schlüssel** ein (aus boring.tax Einstellungen)
4. Gib deine **Organisations-ID** ein (z.B. `140` aus der API-URL)
5. Klicke "Verbindung testen" zur Überprüfung
6. Speichern

## Nutzung

1. Öffne Gmail in Chrome
2. Öffne eine E-Mail mit PDF-Anhang (Rechnung)
3. Neben dem PDF erscheint ein **"Senden"** Button
4. Klicke auf den Button um die Rechnung zu übertragen
5. Nach erfolgreicher Übertragung erscheint ein grünes Häkchen

## API-Endpunkte

Die Extension nutzt folgende boring.tax API-Endpunkte:

- `POST /api/{orgId}/file/upload` - Datei hochladen
- `POST /api/{orgId}/tax/transactions-all` - Transaktionen abrufen
- `POST /api/{orgId}/tax/connect-transaction` - Datei mit Transaktion verbinden

## Projektstruktur

```
mht_chrome_ex/
├── dist/                    # Build-Output (lade diesen Ordner in Chrome)
├── src/
│   ├── background/
│   │   └── service_worker.ts   # API-Kommunikation
│   ├── content/
│   │   ├── gmail_content.ts    # Gmail-Integration
│   │   └── gmail_content.css
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   ├── types/
│   │   └── api.ts              # TypeScript Interfaces
│   └── utils/
│       ├── storage.ts          # Chrome Storage Wrapper
│       └── api_client.ts       # boring.tax API Client
├── assets/
│   └── icons/                  # Extension Icons
├── manifest.json
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Technologien

- TypeScript
- Webpack
- Chrome Extension Manifest V3
- boring.tax API

## Berechtigungen

- `storage` - Speichern von API-Key und übertragenen E-Mails
- `activeTab` - Zugriff auf aktiven Tab
- Host-Permissions für `mail.google.com` und `backend.boring.tax`

## Lizenz

© 2026 Forgea UG - Alle Rechte vorbehalten
