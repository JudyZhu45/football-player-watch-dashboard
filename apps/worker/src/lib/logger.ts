function serialize(meta: unknown): string {
  if (meta instanceof Error) return meta.stack ?? meta.message;
  if (typeof meta === 'string') return meta;
  return JSON.stringify(meta);
}

export const logger = {
  info(msg: string, meta?: unknown) {
    const extra = meta !== undefined ? ` ${serialize(meta)}` : '';
    console.log(`[INFO]  ${new Date().toISOString()} ${msg}${extra}`);
  },
  warn(msg: string, meta?: unknown) {
    const extra = meta !== undefined ? ` ${serialize(meta)}` : '';
    console.warn(`[WARN]  ${new Date().toISOString()} ${msg}${extra}`);
  },
  error(msg: string, meta?: unknown) {
    const extra = meta !== undefined ? ` ${serialize(meta)}` : '';
    console.error(`[ERROR] ${new Date().toISOString()} ${msg}${extra}`);
  },
};
