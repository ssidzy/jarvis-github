// ── Type Definitions ───────────────────────────────────────────────────────────

export interface Email {
  name: string;
  filename: string;
  tags: string[];
  recipient?: string;
}

export interface HistoryItem {
  date: string;
  emails: Email[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  keywords: string[];
}

export interface ViewingEmail {
  date: string;
  filename: string;
  name: string;
  subject: string;
  body: string;
  content: string;
  tags: string[];
  recipient?: string;
}

export interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export interface EmailDraft {
  prompt: string;
  subject: string;
  body: string;
  recipient: string;
  tags: string[];
}
