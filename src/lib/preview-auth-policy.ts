export type PreviewAuthEnvironment = {
  vercel: string | undefined;
  vercelEnv: "production" | "preview" | "development" | undefined;
  authDisabled: string | undefined;
};

export function isTruthyFlag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function requiresPreviewAuthPassword({
  vercel,
  vercelEnv,
  authDisabled,
}: PreviewAuthEnvironment): boolean {
  return vercel === "1" && vercelEnv === "preview" && !isTruthyFlag(authDisabled);
}
