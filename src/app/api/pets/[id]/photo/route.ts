import path from "node:path";

import { get, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { handleRouteError, ApiError } from "@/lib/http";
import { getPetPhotoReferenceForUser, updatePetPhotoForUser } from "@/lib/pets";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const photoReference = await getPetPhotoReferenceForUser(user.id, id);

    if (!photoReference) {
      throw new ApiError(404, "Pet photo not found.");
    }

    if (photoReference.startsWith("http://") || photoReference.startsWith("https://")) {
      return NextResponse.redirect(photoReference);
    }

    const blob = await get(photoReference, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      useCache: false,
    });

    if (!blob?.stream) {
      throw new ApiError(404, "Pet photo not found.");
    }

    const headers = new Headers();
    const contentType = blob.blob.contentType || blob.headers.get("content-type") || "application/octet-stream";
    const contentLength = blob.headers.get("content-length");
    const etag = blob.headers.get("etag");
    const lastModified = blob.headers.get("last-modified");

    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Content-Disposition", "inline");

    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    if (etag) {
      headers.set("ETag", etag);
    }

    if (lastModified) {
      headers.set("Last-Modified", lastModified);
    }

    return new NextResponse(blob.stream, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
}

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
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const pet = await updatePetPhotoForUser(user.id, id, blob.pathname);
    return NextResponse.json({ pet });
  } catch (error) {
    return handleRouteError(error);
  }
}
