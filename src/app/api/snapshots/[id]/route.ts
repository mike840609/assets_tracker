import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateSnapshotAnnotationSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

type IdCtx = { params: Promise<{ id: string }> };

function normalizeText(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSnapshotAnnotationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await prisma.netWorthSnapshot.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== userId) return failure("Not found", 404);

  const data: { label?: string | null; note?: string | null } = {};
  if (Object.hasOwn(parsed.data, "label")) data.label = normalizeText(parsed.data.label);
  if (Object.hasOwn(parsed.data, "note")) data.note = normalizeText(parsed.data.note);

  await prisma.netWorthSnapshot.update({
    where: { id },
    data,
  });

  revalidateTag("snapshots", { expire: 0 });
  revalidateTag(`history:${userId}`, { expire: 0 });

  return ok({ ok: true });
});
