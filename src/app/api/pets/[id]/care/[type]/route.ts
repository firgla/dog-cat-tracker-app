import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { assertCareType, updateCareProfileForUser } from "@/lib/pets";

export const runtime = "nodejs";

const carePatchSchema = z.object({
  date: z.string().optional().nullable(),
  medicine: z.string().optional().nullable(),
  intervalDays: z.number().int().positive().optional().nullable(),
  note: z.string().optional().nullable(),
  reminders: z.array(z.number().int().positive()).optional(),
});

type Params = Promise<{ id: string; type: string }>;

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id, type } = await context.params;
    const body = carePatchSchema.parse(await request.json());
    const pet = await updateCareProfileForUser(user.id, id, assertCareType(type), body);

    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}
