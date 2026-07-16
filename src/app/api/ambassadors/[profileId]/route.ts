import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { ambassadorCopy } from "@/features/ambassadors/copy";
import { getProfileForAdmin, updateAmbassadorContact } from "@/features/ambassadors/dal/admin";
import { updateAmbassadorSchema } from "@/features/ambassadors/schemas/update-ambassador";
import { requireAdmin } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_request: NextRequest, context: { params: Promise<{ profileId: string }> }) {
  try { const { profileId } = await context.params; return NextResponse.json(await getProfileForAdmin(profileId)); }
  catch (error) { const response = toErrorResponse(error, "admin.profile_failed"); return NextResponse.json(response.body, { status: response.status }); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ profileId: string }> }) {
  try {
    await requireAdmin();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        error: {
          code: "VALIDATION_FAILED",
          message: ambassadorCopy.validationFailed,
        },
      }, { status: 422 });
    }
    const { profileId } = await context.params;
    return NextResponse.json(await updateAmbassadorContact(
      profileId,
      updateAmbassadorSchema.parse(body),
    ));
  } catch (error) {
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") fields[field] ??= issue.message;
      }
      return NextResponse.json({
        error: {
          code: "VALIDATION_FAILED",
          message: ambassadorCopy.validationFailed,
          ...(Object.keys(fields).length ? { fields } : {}),
        },
      }, { status: 422 });
    }
    const response = toErrorResponse(error, "admin.contact_update_failed");
    return NextResponse.json(response.body, { status: response.status });
  }
}
