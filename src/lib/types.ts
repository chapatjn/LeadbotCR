export type Tier = 'high' | 'medium' | 'low';

export type LeadStatus =
  | 'sent' // high tier, email sent automatically
  | 'send_failed' // high tier, had an email but Resend send failed
  | 'no_email' // high/medium tier but no email address was found, logged only
  | 'pending_review' // medium tier, email generated, waiting for manual approval
  | 'not_qualified'; // low tier, skipped

export interface Weakness {
  code: 'no_website' | 'slow_mobile' | 'outdated_design';
  label: string; // Spanish, human readable, used verbatim in email generation
}

export interface DesignSignals {
  missingViewport: boolean;
  noHttps: boolean;
  oldCopyright: boolean;
  copyrightYear: number | null;
}

export interface Lead {
  placeId: string;
  name: string;
  address: string;
  city: string;
  category: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  hasWebsite: boolean;
  pagespeedMobileScore: number | null;
  designSignals: DesignSignals | null;
  score: number;
  tier: Tier;
  weaknesses: Weakness[];
  emailSubject: string | null;
  emailBody: string | null;
  status: LeadStatus;
  scannedAt: string;
  sentAt: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LeadWithId extends Lead {
  id: string;
}

export interface ScanSummary {
  total: number;
  sent: number;
  pendingReview: number;
  notQualified: number;
  errors: number;
}

export type ScanEvent =
  | { type: 'status'; message: string }
  | { type: 'progress'; index: number; total: number; message: string }
  | { type: 'lead'; data: LeadWithId }
  | { type: 'error'; message: string }
  | { type: 'fatal'; message: string }
  | { type: 'done'; summary: ScanSummary };
