import { NextResponse, type NextRequest } from "next/server";
import { ambassadorCopy } from "@/features/ambassadors/copy";
import { inviteAmbassador, listAmbassadors } from "@/features/ambassadors/dal/admin";
import { inviteAmbassadorSchema } from "@/features/ambassadors/schemas/invite-ambassador";
import { requireAdmin } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { ZodError } from "zod";

export async function GET(request: NextRequest) { try { return NextResponse.json(await listAmbassadors(request.nextUrl.searchParams.get("cursor"))); } catch (error) { const response = toErrorResponse(error, "admin.roster_failed"); return NextResponse.json(response.body, { status: response.status }); } }
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: ambassadorCopy.validationFailed } }, { status: 422 }); }
    return NextResponse.json(await inviteAmbassador(inviteAmbassadorSchema.parse(body)), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) { const fields = Object.fromEntries(error.issues.flatMap((issue) => typeof issue.path[0] === "string" ? [[issue.path[0], issue.message]] : [])); return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: ambassadorCopy.validationFailed, ...(Object.keys(fields).length ? { fields } : {}) } }, { status: 422 }); }
    const response = toErrorResponse(error, "admin.invite_failed"); return NextResponse.json(response.body, { status: response.status });
  }
}
