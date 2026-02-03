// ============================================
// boring.tax API Types
// ============================================

// Enums für API Filter
export type AccountType = 'CHECKING' | 'CARD' | 'BANK_OTHER' | 'CASH_REGISTER' | 'DEBTORS' | 'CREDITORS';
export type BooleanFilter = 'TRUE' | 'FALSE' | 'NONE';
export type TransactionTypeFilter = 'NONE' | 'CREDIT' | 'DEBIT';

// Request Types
export interface AllTransactionsFilters {
  accountTypes?: AccountType[];
  settled: BooleanFilter;
  userInput: BooleanFilter;
  booked: BooleanFilter;
  type: TransactionTypeFilter;
  from?: string;
  to?: string;
  text?: string | null;
  settlementGroup?: BooleanFilter;
}

export interface AllTransactionsRequest {
  filters: AllTransactionsFilters;
}

export interface ConnectTransactionRequest {
  transactionId: number;
  thingId: string;
  add: boolean;
}

// Response Types
export interface AccountDTO {
  id: number;
  idExternal: string;
  iban: string;
  description: string;
  currency: string;
  type: AccountType;
  side: string;
}

export interface TransactionDTO {
  id: number;
  idExternal: string;
  account: AccountDTO;
  ibanCounterParty: string | null;
  orgId: number;
  transactionDate: string;
  bookingDate: string;
  valueDate: string;
  status: string;
  reference: string;
  description: string;
  transactionType: string;
  currency: string;
  amount: number;
  bookedAmount: number;
  bookedCurrency: string;
  counterParty: string;
  isApproved: boolean;
  referenceAvailable: boolean;
  referenceAvailableReason: string | null;
  claimSettled: boolean;
  claimDiff: number;
  claimSettledLastPayment: string | null;
  claimGroupId: string | null;
  claimGroupNumCash: number | null;
  claimGroupNumClaims: number | null;
  bookings: unknown[];
  connectedTasks: unknown[];
  connectedFiles: unknown[];
  structured: unknown | null;
}

export interface FileDTO {
  orgFileName: string;
  sourceIdentifier: string;
  fileType: string | null;
  uploadDate: string;
  fileSize: number;
  converted: boolean;
  maxPageIdx: number | null;
}

export interface FileSystemEntityDTO {
  id: string | null;
  orgId: number;
  name: string;
  file: FileDTO | null;
  vform: unknown | null;
  directory: unknown | null;
  parentFolderId: string | null;
  referencesEntity: string | null;
  hidden: boolean;
  contentAvailable: boolean;
  processing: boolean;
  tags: string[];
  structured: Record<string, string> | null;
  structuredCases: string[];
  creationDate: string;
}

export interface ConnectTransactionResponse {
  success: boolean;
}

// ============================================
// Chrome Extension Storage Types
// ============================================

export interface TransferredEmail {
  emailId: string;
  fileName: string;
  uploadedFileId: string;
  transferDate: string;
  subject?: string;
}

export interface StorageData {
  apiKey: string;
  orgId: string;
  transferredEmails: TransferredEmail[];
}

// ============================================
// Message Types für Chrome Runtime
// ============================================

export type MessageType = 
  | 'UPLOAD_PDF'
  | 'CHECK_STATUS'
  | 'CHECK_STATUS_BY_FILENAME'
  | 'MARK_TRANSFERRED'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_TRANSFERRED_LIST'
  | 'REMOVE_TRANSFERRED'
  | 'TEST_CONNECTION'
  | 'SYNC_BORING_TAX_FILES'
  | 'GET_BORING_TAX_FILES';

export interface BaseMessage {
  type: MessageType;
}

export interface UploadPdfMessage extends BaseMessage {
  type: 'UPLOAD_PDF';
  payload: {
    fileName: string;
    fileData: string; // Base64 encoded
    emailId: string;
    subject?: string;
  };
}

export interface CheckStatusMessage extends BaseMessage {
  type: 'CHECK_STATUS';
  payload: {
    emailId: string;
  };
}

export interface MarkTransferredMessage extends BaseMessage {
  type: 'MARK_TRANSFERRED';
  payload: TransferredEmail;
}

export interface GetSettingsMessage extends BaseMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage extends BaseMessage {
  type: 'SAVE_SETTINGS';
  payload: {
    apiKey: string;
    orgId: string;
  };
}

export interface GetTransferredListMessage extends BaseMessage {
  type: 'GET_TRANSFERRED_LIST';
}

export interface RemoveTransferredMessage extends BaseMessage {
  type: 'REMOVE_TRANSFERRED';
  payload: {
    emailId: string;
  };
}

export interface TestConnectionMessage extends BaseMessage {
  type: 'TEST_CONNECTION';
  payload: {
    apiKey: string;
    orgId: string;
  };
}

export interface CheckStatusByFilenameMessage extends BaseMessage {
  type: 'CHECK_STATUS_BY_FILENAME';
  payload: {
    fileName: string;
  };
}

export interface SyncBoringTaxFilesMessage extends BaseMessage {
  type: 'SYNC_BORING_TAX_FILES';
}

export interface GetBoringTaxFilesMessage extends BaseMessage {
  type: 'GET_BORING_TAX_FILES';
}

export type ExtensionMessage =
  | UploadPdfMessage
  | CheckStatusMessage
  | CheckStatusByFilenameMessage
  | MarkTransferredMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetTransferredListMessage
  | RemoveTransferredMessage
  | TestConnectionMessage
  | SyncBoringTaxFilesMessage
  | GetBoringTaxFilesMessage;

// Response Types
export interface UploadResponse {
  success: boolean;
  fileId?: string;
  error?: string;
}

export interface CheckStatusResponse {
  isTransferred: boolean;
  transferInfo?: TransferredEmail;
}

export interface SettingsResponse {
  apiKey: string;
  orgId: string;
  isConfigured: boolean;
}

export interface TransferredListResponse {
  emails: TransferredEmail[];
}

export interface GenericResponse {
  success: boolean;
  error?: string;
}

export interface CheckStatusByFilenameResponse {
  isInBoringTax: boolean;
  isTransferredByExtension: boolean;
  transferInfo?: TransferredEmail;
}

export interface BoringTaxFilesResponse {
  fileNames: string[];
  lastSync?: string;
}
