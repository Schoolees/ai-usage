const SECRET_FIELD = /("?(?:access_?token|refresh_?token|id_?token|api_?key|authorization)"?\s*[:=]\s*"?)[^"&,\s}]+/gi;
const PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g,
  /\bsk-[A-Za-z0-9_-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
];
const SECRET_KEYS = /^(access_?token|refresh_?token|id_?token|api_?key|authorization)$/i;

export function redact(text: string): string {
  let out = text;
  for (const pattern of PATTERNS) out = out.replace(pattern, '[redacted]');
  return out.replace(SECRET_FIELD, (match, prefix: string) => (match.endsWith('[redacted]') ? match : `${prefix}[redacted]`));
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (value instanceof Error) {
    const copy = new Error(redact(value.message));
    copy.stack = value.stack ? redact(value.stack) : undefined;
    return copy;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_KEYS.test(key) ? '[redacted]' : redactValue(inner)]),
    );
  }
  return value;
}
