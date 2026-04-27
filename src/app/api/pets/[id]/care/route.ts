import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { listCareForUser } from "@/lib/pets";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const care = await listCareForUser(user.id, id);
    return NextResponse.json({ care });
  } catch (error) {
    return handleRouteError(error);
  }
}
