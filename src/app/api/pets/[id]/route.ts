import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { assertPetType, deletePetForUser, getPetForUser, updatePetForUser } from "@/lib/pets";

export const runtime = "nodejs";

const petPatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.string().optional(),
  breed: z.string().min(1).max(255).optional(),
  birthDate: z.string().optional().nullable(),
  importantInfo: z.string().optional().nullable(),
});

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const pet = await getPetForUser(user.id, id);
    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = petPatchSchema.parse(await request.json());
    const pet = await updatePetForUser(user.id, id, {
      ...body,
      type: body.type ? assertPetType(body.type) : undefined,
    });

    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    await deletePetForUser(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
