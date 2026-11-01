import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const tables = await prisma.diningTable.findMany({
    orderBy: { number: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm">
            DA
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              DineAssist
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              AI-Powered Dine-in Ordering Assistant
            </p>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Customer Ordering — Select a Table
          </h2>
          <div className="grid grid-cols-5 gap-2.5">
            {tables.map((t) => (
              <Link
                key={t.id}
                href={`/t/${t.number}`}
                className="flex flex-col items-center justify-center py-3 px-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-xl transition text-center group"
              >
                <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 font-bold uppercase">
                  Table
                </span>
                <span className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700">
                  {t.number}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Restaurant Staff</span>
          <Link
            href="/admin/login"
            className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Admin Portal →
          </Link>
        </section>
      </div>
    </main>
  );
}
