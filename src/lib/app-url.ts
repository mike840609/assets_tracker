const DEFAULT_APP_URL = "https://astt.app";

type AppAssetUrlOptions = {
  vercelEnv?: string;
  vercelUrl?: string;
  appUrl?: string;
};

export function getAppUrl(value = process.env.NEXT_PUBLIC_APP_URL): URL {
  return new URL(value || DEFAULT_APP_URL);
}

export function getAppAssetUrl(
  path: string,
  {
    vercelEnv = process.env.VERCEL_ENV,
    vercelUrl = process.env.VERCEL_URL,
    appUrl = process.env.NEXT_PUBLIC_APP_URL,
  }: AppAssetUrlOptions = {},
): URL {
  if (vercelEnv === "preview" && vercelUrl) {
    return new URL(path, `https://${vercelUrl}`);
  }

  return new URL(path, getAppUrl(appUrl));
}
