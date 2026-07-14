export type PreviewAuthEnvironment = {
  nodeEnv: string | undefined;
  vercel: string | undefined;
  vercelEnv: "production" | "preview" | "development" | undefined;
  authEnabled: string | undefined;
  authDisabled: string | undefined;
};

export function isTruthyFlag(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export function resolvePreviewAuthPolicy({
  nodeEnv,
  vercel,
  vercelEnv,
  authEnabled,
  authDisabled,
}: PreviewAuthEnvironment): { enabled: boolean; requiresPassword: boolean } {
  const localDevelopment = nodeEnv === "development" || nodeEnv === "test";
  const hostedVercelPreview = vercel === "1" && vercelEnv === "preview";
  const explicitlyEnabled = vercel !== "1" && isTruthyFlag(authEnabled);
  const enabled = localDevelopment || hostedVercelPreview || explicitlyEnabled;
  const requiresPassword = enabled && !localDevelopment && !isTruthyFlag(authDisabled);

  return { enabled, requiresPassword };
}
