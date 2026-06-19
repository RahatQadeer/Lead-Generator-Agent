export function getPeopleDataLabsApiKey(): string | null {
  const key = process.env.PEOPLE_DATA_LABS_API_KEY?.trim();
  return key || null;
}

export function isPeopleDataLabsConfigured(): boolean {
  return Boolean(getPeopleDataLabsApiKey());
}
