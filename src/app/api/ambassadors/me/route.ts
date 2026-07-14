import { NextResponse } from "next/server";
import { getOwnProfile } from "@/features/ambassadors/dal/ambassador";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try { return NextResponse.json(await getOwnProfile()); }
  catch (error) { const response = toErrorResponse(error, "ambassador.own_profile_failed"); return NextResponse.json(response.body, { status: response.status }); }
}
