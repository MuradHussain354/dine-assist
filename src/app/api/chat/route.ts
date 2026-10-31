import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractIntent } from "@/lib/intent/extract";
import { recommend } from "@/lib/recommend";

const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message must be between 1 and 300 characters")
    .max(300, "Message must be between 1 and 300 characters"),
  tableId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { message, tableId } = parseResult.data;

    // 1. Load all available menu items
    const availableMenuItems = await prisma.menuItem.findMany({
      where: { isAvailable: true },
    });

    // 2. Extract intent (LLM with rule-based fallback)
    const { intent, usedFallback, latencyMs } = await extractIntent(message);

    // 3. Generate recommendation (pure function)
    const recommendation = recommend(availableMenuItems, intent);

    // 4. Resolve dining table ID for ChatLog
    let resolvedTableId = tableId;
    if (resolvedTableId) {
      const parsedNum = parseInt(resolvedTableId, 10);
      const existingTable = await prisma.diningTable.findFirst({
        where: {
          OR: [
            { id: resolvedTableId },
            ...(!isNaN(parsedNum) ? [{ number: parsedNum }] : []),
          ],
        },
      });
      if (existingTable) {
        resolvedTableId = existingTable.id;
      } else {
        const firstTable = await prisma.diningTable.findFirst({
          orderBy: { number: "asc" },
        });
        resolvedTableId = firstTable?.id;
      }
    } else {
      const firstTable = await prisma.diningTable.findFirst({
        orderBy: { number: "asc" },
      });
      resolvedTableId = firstTable?.id;
    }

    // 5. Save ChatLog record
    if (resolvedTableId) {
      await prisma.chatLog.create({
        data: {
          tableId: resolvedTableId,
          userQuery: message,
          extractedJson: JSON.stringify(intent),
          usedFallback,
          latencyMs,
          recommendedItemIds: JSON.stringify(
            recommendation.items.map((i) => i.menuItemId)
          ),
        },
      });
    }

    // 6. Return response
    return NextResponse.json({
      intent,
      recommendation,
      usedFallback,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
