import path from "node:path";

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { handleRouteError, ApiError } from "@/lib/http";
import { updatePetPhotoForUser } from "@/lib/pets";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Image file is required.");
    }

    if (!file.type.startsWith("image/")) {
      throw new ApiError(400, "Only image uploads are supported.");
    }

    const extension = path.extname(file.name) || ".jpg";
    const blob = await put(`pets/${id}/${crypto.randomUUID()}${extension}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const pet = await updatePetPhotoForUser(user.id, id, blob.url);
    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}
