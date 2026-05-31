import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/insights/engine";

export async function GET() {
  const insights = await generateInsights();
  return NextResponse.json(insights);
}
