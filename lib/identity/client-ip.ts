export function clientIp(headers: { get(name: string): string | null }) {
  const connecting = headers.get('cf-connecting-ip')?.trim();
  if (connecting) return connecting.slice(0, 80);
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);
  return 'local';
}
