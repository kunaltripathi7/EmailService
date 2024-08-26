import { EmailProvider } from "./types";

export class MockEmailProvider1 implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`EmailProvider1:  Mail to ${to} with concern "${subject}"`);
    const success = Math.random() > 0.2;
    return success;
  }
}

export class MockEmailProvider2 implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`EmailProvider2:  Mail to ${to} with concern "${subject}"`);
    const success = Math.random() > 0.2;
    return success;
  }
}
