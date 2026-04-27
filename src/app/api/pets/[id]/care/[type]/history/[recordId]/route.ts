import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { assertCareType, deleteCareHistoryForUser } from "@/lib/pets";

export const runtime = "nodejs";

type Params = Promise<{ id: string; type: string; recordId: string }>;

export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id, type, recordId } = await context.params;
    const pet = await deleteCareHistoryForUser(user.id, id, assertCareType(type), recordId);
    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}
