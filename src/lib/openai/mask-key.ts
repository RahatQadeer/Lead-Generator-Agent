export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  return `${apiKey.slice(0, 3)}••••${apiKey.slice(-4)}`;
}
