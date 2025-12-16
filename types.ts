export enum Priority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum SourceType {
  GMAIL = 'Gmail',
  CHAT = 'Google Chat',
  MANUAL = 'Manual Input'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  sourceType: SourceType;
  sourceContext: string;
  dueDate?: string;
  isCompleted: boolean;
  confidenceScore: number;
}

export interface ProcessingStats {
  emailsScanned: number;
  chatsScanned: number;
  tasksFound: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  avatarColor?: string;
  type: 'Personal' | 'Work';
}

export interface AppSettings {
  geminiApiKey: string;
  googleDriveConnected: boolean;
  googleDriveEmail?: string;
  autoSave: boolean;
  // NEW FIELD:
  customInstructions?: string; 
}
