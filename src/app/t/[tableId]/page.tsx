import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CustomerOrderingClient from "./customer-client";

interface PageProps {
  params: {
    tableId: string;
  };
}

export default async function CustomerTablePage({ params }: PageProps) {
  const { tableId } = params;

  // Resolve table by CUID or table number
  const parsedNum = parseInt(tableId, 10);
  const table = await prisma.diningTable.findFirst({
    where: {
      OR: [
        { id: tableId },
        ...(!isNaN(parsedNum) ? [{ number: parsedNum }] : []),
      ],
    },
  });

  // If table does not exist, show friendly "Table not found" page
  if (!table) {
    const allTables = await prisma.diningTable.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    });

    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🍽️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
            Table Not Found
          </h1>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">
            We couldn&apos;t find a dining table for &ldquo;<span className="font-semibold">{tableId}</span>&rdquo;.
            Please re-scan the QR code placed on your table, or ask a member of our waitstaff for assistance.
          </p>

          {allTables.length > 0 && (
            <div className="border-t border-slate-100 pt-6 mt-2 text-left">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Quick Access to Active Tables:
              </p>
              <div className="grid grid-cols-5 gap-2">
                {allTables.map((t) => (
                  <Link
                    key={t.id}
                    href={`/t/${t.number}`}
                    className="flex flex-col items-center justify-center py-2.5 px-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="text-xs text-slate-400">T</span>
                    <span className="text-base font-bold">{t.number}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Load all available menu items
  const menuItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: [{ category: "asc" }, { price: "asc" }],
  });

  return (
    <CustomerOrderingClient
      table={{
        id: table.id,
        number: table.number,
      }}
      menuItems={menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        dietTags: item.dietTags,
        spiceLevel: item.spiceLevel,
        cuisine: item.cuisine,
        isAvailable: item.isAvailable,
      }))}
    />
  );
}

