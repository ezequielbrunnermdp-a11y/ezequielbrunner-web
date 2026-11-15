import { handle, requireCaseAccess, requireUser } from "@/lib/auth";
import { newThread } from "@/lib/chat";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  await requireCaseAccess(user, id);
  return Response.json({ threadId: await newThread(id, user.id) }, { status: 201 });
});
