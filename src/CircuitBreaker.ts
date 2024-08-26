import { CircuitBreakerState } from "./types";

export class CircuitBreaker {
  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;
  private failureCount: number;
  private successCount: number;
  private state: CircuitBreakerState;
  private lastFailureTime: number;

  constructor(
    failureThreshold: number = 3,
    successThreshold: number = 2,
    timeout: number = 5000
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.successCount = 0;
    this.state = CircuitBreakerState.CLOSED;
    this.lastFailureTime = 0;
  }

  public async execute<T>(
    action: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen(this.state)) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        console.warn("Circuit breaker is open. Returning fallback.");
        return fallback();
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (this.isOpen(this.state)) {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log("Circuit breaker transitioning to CLOSED state.");
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      console.warn("Circuit breaker transitioning to OPEN state.");
      this.state = CircuitBreakerState.OPEN;
      this.lastFailureTime = Date.now();
    }
  }

  private reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  private isOpen(
    state: CircuitBreakerState
  ): state is CircuitBreakerState.OPEN {
    return state === CircuitBreakerState.OPEN;
  }
}
