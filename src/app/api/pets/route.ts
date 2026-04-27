import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { assertPetType, createPetForUser, listPetsForUser } from "@/lib/pets";

export const runtime = "nodejs";

const petSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string(),
  breed: z.string().min(1).max(255),
  birthDate: z.string().optional().nullable(),
  importantInfo: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const pets = await listPetsForUser(user.id);
    return NextResponse.json({ pets });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = petSchema.parse(await request.json());
    const pet = await createPetForUser(user.id, {
      name: body.name,
      type: assertPetType(body.type),
      breed: body.breed,
      birthDate: body.birthDate ?? "",
      importantInfo: body.importantInfo ?? "",
    });

    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}
