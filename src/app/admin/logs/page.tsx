import { prisma } from "@/lib/prisma";
import LogsClient from "./logs-client";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const logs = await prisma.chatLog.findMany({
    include: {
      table: {
        select: {
          id: true,
          number: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const serializedLogs = logs.map((log) => ({
    id: log.id,
    tableId: log.tableId,
    tableNumber: log.table?.number,
    tableName: log.table ? `Table ${log.table.number}` : "Unknown",
    userQuery: log.userQuery,
    extractedJson: log.extractedJson,
    usedFallback: log.usedFallback,
    fallbackReason: log.fallbackReason,
    latencyMs: log.latencyMs,
    recommendedItemIds: log.recommendedItemIds,
    createdAt: log.createdAt.toISOString(),
  }));

  return <LogsClient initialLogs={serializedLogs} />;
}
