import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/events/store";
import { computeReadiness } from "@/lib/goals/readiness";

export async function GET() {
  const goals = await prisma.goal.findMany({
    include: {
      prerequisites: { include: { evidence: true } },
      actions: true,
      value: { select: { id: true, label: true, rank: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const withReadiness = goals.map((goal) => ({
    ...goal,
    readiness: computeReadiness(goal.prerequisites),
  }));
  return NextResponse.json(withReadiness);
}

export async function POST(request: Request) {
  const body = await request.json();
  const goal = await prisma.goal.create({
    data: {
      title: body.title,
      description: body.description,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      successCriteria: body.successCriteria,
      status: body.status || "ACTIVE",
      valueId: body.valueId || null,
    },
  });

  await recordEvent("GOAL", goal.id, "CREATED", {
    title: goal.title,
    status: goal.status,
  });

  return NextResponse.json(goal, { status: 201 });
}
