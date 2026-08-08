import "server-only";
import { revalidateTag } from "next/cache";
import type { AuthPrincipal } from "@/lib/auth-principal";

export function invalidateScopedTag(input: {
  globalTag: string;
  userTag: string;
  principal: AuthPrincipal;
  profile?: "max" | { expire: 0 };
}) {
  const profile = input.profile ?? { expire: 0 };
  if (input.principal.kind === "formal") revalidateTag(input.globalTag, profile);
  revalidateTag(input.userTag, profile);
}
