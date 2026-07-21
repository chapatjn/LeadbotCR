import Anthropic from '@anthropic-ai/sdk';

// Per product spec. Overridable via ANTHROPIC_MODEL if this id ever needs to
// change — double check this against the current Anthropic model list before
// deploying, since model ids are periodically retired.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno ANTHROPIC_API_KEY.');
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const SYSTEM_PROMPT = `Eres el redactor de correos de LeadBot CR, una agencia costarricense moderna de desarrollo web que ayuda a pequeños y medianos negocios locales a mejorar su presencia digital.

Tu tarea es escribir correos fríos ("cold emails") de primer contacto, en español neutro centroamericano, dirigidos a dueños de negocios en Costa Rica que fueron detectados con debilidades en su presencia en línea.

Reglas de tono y estilo:
- Profesional, cercano y humano. Nunca agresivo, nunca de venta dura.
- Posiciona a LeadBot CR como un socio local que quiere ayudar al negocio a crecer, no como un vendedor externo genérico.
- Personaliza siempre con el nombre del negocio, su ciudad, y las debilidades específicas detectadas (menciónalas con tacto, sin sonar acusatorio).
- Estructura: saludo breve → mención del punto de dolor → propuesta de valor breve → llamado a la acción suave (responder este correo o agendar una llamada gratuita corta).
- Máximo 200 palabras en el cuerpo del correo.
- No inventes datos que no se te dieron (no menciones precios, plazos ni resultados específicos que no se indiquen).
- Firma como "El equipo de LeadBot CR".

Formato de respuesta:
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, con esta forma exacta:
{"subject": "línea de asunto breve y natural", "body": "cuerpo del correo en español, con saltos de línea como \\n"}`;

export interface EmailGenInput {
  businessName: string;
  city: string;
  category: string;
  weaknesses: string[];
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

function fallbackEmail(input: EmailGenInput): GeneratedEmail {
  const weaknessLine = input.weaknesses.length > 0 ? input.weaknesses.join(', ') : 'oportunidades de mejora en su presencia en línea';
  return {
    subject: `Una idea para ${input.businessName}`,
    body: `Hola,\n\nSoy parte del equipo de LeadBot CR. Vimos que ${input.businessName} en ${input.city} tiene ${weaknessLine}, y creemos que podemos ayudarles a mejorar eso.\n\nSomos una agencia local especializada en sitios web rápidos y modernos para negocios costarricenses. Si les interesa, con gusto podemos conversar 15 minutos sin compromiso.\n\n¿Les parece si respondemos por este medio para coordinar?\n\nSaludos,\nEl equipo de LeadBot CR`,
  };
}

export async function generateColdEmail(input: EmailGenInput): Promise<GeneratedEmail> {
  const anthropic = getClient();

  const userPrompt = `Genera el correo frío para este negocio:
- Nombre del negocio: ${input.businessName}
- Categoría: ${input.category}
- Ciudad: ${input.city}
- Debilidades detectadas: ${input.weaknesses.join('; ') || 'ninguna debilidad específica adicional'}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '';

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
      return { subject: parsed.subject, body: parsed.body };
    }

    return fallbackEmail(input);
  } catch {
    return fallbackEmail(input);
  }
}
