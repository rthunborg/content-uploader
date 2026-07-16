import { NextResponse, type NextRequest } from "next/server";
import { getProfileForAdmin } from "@/features/ambassadors/dal/admin";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_request: NextRequest, context: { params: Promise<{ profileId: string }> }) {
  try { const { profileId } = await context.params; return NextResponse.json(await getProfileForAdmin(profileId)); }
  catch (error) { const response = toErrorResponse(error, "admin.profile_failed"); return NextResponse.json(response.body, { status: response.status }); }
}
