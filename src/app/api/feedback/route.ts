import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFeedbackSchema } from "@/lib/validators";
import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createFeedbackSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const feedback = await prisma.feedback.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return NextResponse.json(feedback, { status: 201 });
}
