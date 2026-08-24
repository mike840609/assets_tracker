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
  return getMobileHubUrl(currentSearch || fallbackSearch, hash);
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
  return hash ? getMobileHubUrl(search, hash) : null;
}

function getMobileHubUrl(search: string, hash: `#${string}`): string {
  const params = new URLSearchParams(search);
  const tab = hash.slice(1);
  if (tab === "watchlist") params.delete("tab");
  else params.set("tab", tab);
  const query = params.toString();
  return `/goals${query ? `?${query}` : ""}`;
}
