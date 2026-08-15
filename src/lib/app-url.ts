const DEFAULT_APP_URL = "https://astt.app";

export function getAppUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  return new URL(value || DEFAULT_APP_URL);
}
