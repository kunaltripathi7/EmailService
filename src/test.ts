import { EmailService } from "./EmailService";
import { MockEmailProvider1 } from "./EmailProviders";
import { MockEmailProvider2 } from "./EmailProviders";
import { RateLimiter } from "./RateLimiter";
import { v4 as uuidv4 } from "uuid";
import { CircuitBreaker } from "./CircuitBreaker";

export const testF = async () => {
  const primaryProvider = new MockEmailProvider1();
  const secondaryProvider = new MockEmailProvider2();

  const rateLimiter = new RateLimiter(100, 1 / 36);

  const circuitBreaker = new CircuitBreaker();

  const emailService = new EmailService(
    primaryProvider,
    secondaryProvider,
    rateLimiter,
    circuitBreaker
  );

  const idempotencyKey = uuidv4();

  const success = await emailService.sendEmail(
    "test@example.com",
    "Hello",
    "This is a test email",
    idempotencyKey
  );

  if (success) {
    console.log("Email was sent successfully");
  } else {
    console.log("Failed to send email or rate limit exceeded");
  }
};
