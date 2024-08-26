export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
}

export enum EmailStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
  FALLBACK = "FALLBACK",
}

export enum CircuitBreakerState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}
