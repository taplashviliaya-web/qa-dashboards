import { NextResponse } from "next/server";
import { getEpicDetails } from "@/lib/jiraClient";
import { getMockEpicDetails, isMockMode } from "@/lib/mockData";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { key: string } }
) {
  const key = params.key?.trim();
  if (!key) {
    return NextResponse.json({ error: "Missing epic key" }, { status: 400 });
  }

  if (isMockMode()) {
    const details = getMockEpicDetails(key);
    if (!details) {
      return NextResponse.json(
        { error: `Mock Epic '${key}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(details);
  }

  try {
    const details = await getEpicDetails(key);
    return NextResponse.json(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
