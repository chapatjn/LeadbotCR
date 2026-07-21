/**
 * Reads a required environment variable, throwing a descriptive error if
 * it's missing or blank.
 *
 * The most common cause in local dev isn't actually a missing value in
 * .env.local — it's that Next.js only reads .env.local once, when the dev
 * server process starts. Editing .env.local while `npm run dev` is already
 * running does NOT take effect until the server is restarted. That's why
 * the message below spells out the restart step explicitly instead of just
 * saying "add it to .env.local".
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa tres cosas: ` +
        `(1) que exista en tu archivo .env.local, en la raíz del proyecto; ` +
        `(2) que tenga un valor y no esté vacía o comentada con "#"; ` +
        `(3) si la acabas de agregar o modificar, reinicia el servidor por completo ` +
        `(detén "npm run dev" con Ctrl+C y vuelve a ejecutarlo) — Next.js solo carga ` +
        `.env.local al arrancar el proceso, no mientras ya está corriendo. ` +
        `En producción (Vercel u otro host), agrega ${name} en la configuración de ` +
        `variables de entorno del proyecto y vuelve a desplegar.`
    );
  }

  return value;
}
