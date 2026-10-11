import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyticsViews, type AnalyticsViewId } from "@/lib/analytics-views";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!Object.hasOwn(analyticsViews, view)) {
    return NextResponse.json({ error: "Unknown analytics view." }, { status: 404 });
  }

  try {
    const viewId = view as AnalyticsViewId;
    const [rows] = await db.query(analyticsViews[viewId].query);
    return NextResponse.json({ view: analyticsViews[viewId], rows });
  } catch {
    return NextResponse.json({ error: "Analytics data could not be loaded." }, { status: 503 });
  }
}
