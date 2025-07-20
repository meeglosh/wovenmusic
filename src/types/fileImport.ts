export interface FileImportStatus {
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  progress?: number;
}

export interface ImportProgress {
  [filePath: string]: FileImportStatus;
}