import { NextResponse, type NextRequest } from "next/server";
import { listAmbassadors } from "@/features/ambassadors/dal/admin";
import { toErrorResponse } from "@/lib/errors";
export async function GET(request: NextRequest) { try { return NextResponse.json(await listAmbassadors(request.nextUrl.searchParams.get("cursor"))); } catch (error) { const response = toErrorResponse(error, "admin.roster_failed"); return NextResponse.json(response.body, { status: response.status }); } }
