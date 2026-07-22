export type Tier = 'high' | 'medium' | 'low';

export type LeadStatus =
  | 'pending_review' // qualified (medium/high tier), email generated, awaiting manual send
  | 'sent' // manually approved and sent via Resend
  | 'dismissed' // manually reviewed and rejected — no send
  | 'not_qualified'; // low tier, skipped entirely, no email generated

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
  requested: number;
  total: number;
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
