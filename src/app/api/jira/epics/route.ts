import { NextResponse } from "next/server";
import { getActiveEpics } from "@/lib/jiraClient";
import { MOCK_EPICS, isMockMode } from "@/lib/mockData";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({ epics: MOCK_EPICS, mock: true });
  }

  try {
    const epics = await getActiveEpics();
    return NextResponse.json({ epics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
