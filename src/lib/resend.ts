import { Resend } from 'resend';

let cachedClient: Resend | null = null;

function getClient(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno RESEND_API_KEY.');
  }
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
  const from = process.env.FROM_EMAIL;
  if (!from) {
    throw new Error('Falta la variable de entorno FROM_EMAIL.');
  }

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
