import { Resend } from 'resend';
import { requireEnv } from './env';

let cachedClient: Resend | null = null;

function getClient(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = requireEnv('RESEND_API_KEY');
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendColdEmail(input: SendEmailInput) {
  const resend = getClient();
  const from = requireEnv('FROM_EMAIL');

  const html = input.body
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br />' : `<p>${line}</p>`))
    .join('');

  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html,
    text: input.body,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result;
}
