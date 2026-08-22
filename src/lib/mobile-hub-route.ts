const MOBILE_HUB_HASHES: Record<string, `#${string}`> = {
  "/stocks": "#watchlist",
  "/projections": "#projections",
  "/calendar": "#calendar",
};

const MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  return MOBILE_USER_AGENT.test(userAgent ?? "");
}

export function getMobileHubClientRedirectUrl({
  currentSearch,
  fallbackSearch = "",
  hash,
}: {
  currentSearch: string;
  fallbackSearch?: string;
  hash: `#${string}`;
}): string {
  return `/goals${currentSearch || fallbackSearch}${hash}`;
}

export function getMobileHubRedirectUrl({
  pathname,
  search,
  userAgent,
}: {
  pathname: string;
  search: string;
  userAgent: string | null | undefined;
}): string | null {
  if (!isMobileUserAgent(userAgent)) return null;

  const hash = MOBILE_HUB_HASHES[pathname];
  return hash ? `/goals${search}${hash}` : null;
}
