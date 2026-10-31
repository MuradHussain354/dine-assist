# Dine-in Ordering Assistant

## Goal
Customers at a table type a request like "something spicy, vegetarian, under 1500 rupees for two".
An LLM extracts structured intent, plain code recommends a valid order within budget, the customer
checks out from their table, and the kitchen sees the order live.

## Stack
Next.js 14 (App Router, TypeScript), Tailwind, Prisma 5 + SQLite, Zod, Recharts,
Ollama (llama3.2:3b) behind an LLMProvider interface. Package manager: npm.

## Intent JSON (validated with Zod)
{ diet: "veg" | "vegan" | "non-veg" | "any",
  spice_level: 0-3 | null,
  budget_total: number | null,
  party_size: integer (default 1),
  exclusions: string[],
  cuisine: string | null }
If parsing or validation fails, use the rule-based fallback parser (keywords + regex for numbers).

## Data model
- MenuItem: id, name, description, price (Int, rupees), category (starter|main|side|dessert|drink),
  dietTags (JSON string), spiceLevel (0-3), cuisine, isAvailable
- DiningTable: id, number (unique)
- Order: id, tableId, status (string), totalAmount, createdAt, updatedAt
- OrderItem: id, orderId, menuItemId, quantity, unitPrice (snapshot at order time)
- ChatLog: id, tableId, userQuery, extractedJson, usedFallback (bool), latencyMs,
  recommendedItemIds (JSON string), createdAt

## Recommender (plain code, no LLM)
Filter by availability, diet, exclusions, and spice level (<= requested). Build a combo scaled to
party_size (roughly one main per person plus shared sides and drinks). The total must be <= budget_total.
If nothing fits, return a message explaining why.

## Order lifecycle
placed -> preparing -> ready -> served. cancelled is allowed only from placed.
Transitions are enforced in a server-side service module.

## Pages
- /t/[tableId]: customer chat, cart, checkout, order status
- /kitchen: live order board (SSE)
- /admin: menu CRUD, analytics (top dishes, orders per hour, revenue), chat-log viewer

## Phases
1. Data layer + seed
2. Menu admin
3. AI core (LLMProvider, extraction, fallback, recommender, /api/chat)
4. Customer flow
5. Order lifecycle + kitchen board
6. Analytics + chat logs
7. Evaluation script (40-50 labelled queries, per-field accuracy)
8. Polish (README, screenshots, error/loading states)

## Rules
- Stack is fixed: Next.js 14 App Router, TypeScript, Tailwind, Prisma 5 + SQLite, Zod, Recharts. Ask before adding any dependency.
- SQLite has no enums or lists in Prisma: store status as a string validated by a TypeScript union, and store tags as JSON strings.
- All LLM output is validated with Zod. If validation fails, use the rule-based fallback parser.
- The LLM only extracts intent. Prices, totals and budget fitting are done in plain code, never by the LLM.
- LLM access goes through an LLMProvider interface (Ollama first) so a hosted free-tier API can be swapped in later.
- Order status transitions are enforced on the server.
- Use free tools only.
- Never commit .env or the SQLite database file.
- Read SPEC.md before every task. Do one phase at a time and don't touch unrelated files.
- When done, run lint and build, start the app, and list exactly what you verified.
- Commit after each phase.