export function featureFlagEnabled(value: unknown, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

