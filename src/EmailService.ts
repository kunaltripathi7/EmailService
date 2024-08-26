import { CircuitBreaker } from "./CircuitBreaker";
import { RateLimiter } from "./RateLimiter";
import { EmailProvider, EmailStatus } from "./types";
import { Logger } from "./Logger";
import { Queue } from "./Queue";

interface EmailTask {
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}

export class EmailService {
  private primaryProvider: EmailProvider;
  private secondaryProvider: EmailProvider;
  private retryAttempts: number;
  private initialDelay: number;
  private idempotencyStore: Map<string, boolean>;
  private rateLimiter: RateLimiter;
  private statusTracker: Map<string, EmailStatus>;
  private circuitBreaker: CircuitBreaker;
  private queue: Queue<EmailTask>;
  private processing: boolean;

  constructor(
    primaryProvider: EmailProvider,
    secondaryProvider: EmailProvider,
    rateLimiter: RateLimiter,
    circuitBreaker: CircuitBreaker,
    retryAttempts: number = 5,
    initialDelay: number = 1000
  ) {
    this.primaryProvider = primaryProvider;
    this.secondaryProvider = secondaryProvider;
    this.retryAttempts = retryAttempts;
    this.initialDelay = initialDelay;
    this.idempotencyStore = new Map<string, boolean>();
    this.rateLimiter = rateLimiter;
    this.statusTracker = new Map<string, EmailStatus>();
    this.circuitBreaker = circuitBreaker;
    this.queue = new Queue<EmailTask>();
    this.processing = false;
  }

  public enqueueEmail(
    to: string,
    subject: string,
    body: string,
    idempotencyKey: string
  ): void {
    this.queue.enqueue({ to, subject, body, idempotencyKey });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (!this.queue.isEmpty()) {
      const task = this.queue.dequeue();
      if (task) {
        await this.sendEmail(
          task.to,
          task.subject,
          task.body,
          task.idempotencyKey
        );
      }
    }

    this.processing = false;
  }

  public async sendEmail(
    to: string,
    subject: string,
    body: string,
    idempotencyKey: string
  ): Promise<boolean> {
    if (!this.rateLimiter.tryRemoveToken()) {
      Logger.warn("Rate limit exceeded. Please try again later.");
      this.statusTracker.set(idempotencyKey, EmailStatus.FAILED);
      return false;
    }

    if (this.idempotencyStore.has(idempotencyKey)) {
      Logger.info("Email has been already sent. Skipping due to idempotency.");
      this.statusTracker.set(idempotencyKey, EmailStatus.SENT);
      return true;
    }

    this.statusTracker.set(idempotencyKey, EmailStatus.PENDING);

    try {
      // Use the circuit breaker to manage failures for primary provider
      const success = await this.circuitBreaker.execute(
        () => this.trySending(this.primaryProvider, to, subject, body),
        () => this.trySending(this.secondaryProvider, to, subject, body)
      );

      if (success) {
        this.idempotencyStore.set(idempotencyKey, true);
        this.statusTracker.set(idempotencyKey, EmailStatus.SENT);
        Logger.info("Email sent successfully.");
        return true;
      } else {
        this.statusTracker.set(idempotencyKey, EmailStatus.FAILED);
        Logger.error(
          "Failed to send email after both primary and secondary attempts."
        );
      }
    } catch (error) {
      Logger.error("Both providers failed.");
      this.statusTracker.set(idempotencyKey, EmailStatus.FAILED);
    }

    return false;
  }

  private async trySending(
    provider: EmailProvider,
    to: string,
    subject: string,
    body: string
  ): Promise<boolean> {
    let attempt = 0;
    while (attempt < this.retryAttempts) {
      try {
        attempt++;
        const sent = await provider.sendEmail(to, subject, body);
        if (sent) {
          Logger.info(
            `Email successfully sent on attempt ${attempt} using provider.`
          );
          return true;
        } else {
          throw new Error("Failed to send email.");
        }
      } catch (error) {
        if (attempt < this.retryAttempts) {
          const waitTime = this.initialDelay * 2 ** (attempt - 1);
          Logger.warn(`Attempt ${attempt} failed. Retrying in ${waitTime} ms.`);
          await this.delay(waitTime);
        } else {
          Logger.error("All retry attempts exhausted.");
          throw error;
        }
      }
    }
    return false;
  }

  private delay(duration: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

  public getStatus(idempotencyKey: string): EmailStatus | undefined {
    return this.statusTracker.get(idempotencyKey);
  }
}
