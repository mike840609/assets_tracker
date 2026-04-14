import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/lib/validators";
import { auth } from "@/auth";
import { ok, failure, validationError } from "@/lib/api-responses";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return failure("Unauthorized", 401);

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    include: { holdings: { where: { quantity: { gt: 0 } } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(accounts);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("Unauthorized", 401);

  const body = await request.json();
  const ids: string[] = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return failure("ids array required");
  }

  await prisma.account.deleteMany({
    where: {
      id: { in: ids },
      userId: session.user.id,
    },
  });
  return ok({ ok: true });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return failure("Unauthorized", 401);

  const body = await request.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const account = await prisma.account.create({
    data: { ...parsed.data, userId: session.user.id },
  });
  return ok(account, { status: 201 });
}
