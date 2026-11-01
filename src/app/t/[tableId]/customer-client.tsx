"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

export interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietTags: string;
  spiceLevel: number;
  cuisine: string;
  isAvailable: boolean;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface RecommendedItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface RecommendationData {
  items: RecommendedItem[];
  total: number;
  message: string;
}

interface Props {
  table: {
    id: string;
    number: number;
  };
  menuItems: MenuItemData[];
}

const CATEGORIES = [
  { key: "all", label: "All Items" },
  { key: "starter", label: "Starters" },
  { key: "main", label: "Mains" },
  { key: "side", label: "Sides" },
  { key: "dessert", label: "Desserts" },
  { key: "drink", label: "Drinks" },
] as const;

export default function CustomerOrderingClient({ table, menuItems }: Props) {
  const router = useRouter();

  // Navigation tab for mobile
  const [activeTab, setActiveTab] = useState<"assistant" | "menu">("assistant");

  // Menu Category Filter
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Chat State
  const [query, setQuery] = useState("");
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recommendation, setRecommendation] =
    useState<RecommendationData | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Timer reference for elapsedSeconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSearching) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSearching]);

  // Cart calculations
  const totalCartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totalCartAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  // Cart actions
  const addToCart = (
    item: { id: string; name: string; price: number; category?: string },
    qtyToAdd = 1
  ) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.menuItemId === item.id);
      if (existing) {
        const newQty = Math.min(20, existing.quantity + qtyToAdd);
        return prevCart.map((ci) =>
          ci.menuItemId === item.id ? { ...ci, quantity: newQty } : ci
        );
      } else {
        const initialQty = Math.min(20, Math.max(1, qtyToAdd));
        return [
          ...prevCart,
          {
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: initialQty,
            category: item.category,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (menuItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    const clampedQty = Math.min(20, newQty);
    setCart((prev) =>
      prev.map((item) =>
        item.menuItemId === menuItemId
          ? { ...item, quantity: clampedQty }
          : item
      )
    );
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((item) => item.menuItemId !== menuItemId));
  };

  const acceptWholeRecommendation = (rec: RecommendationData) => {
    if (!rec.items || rec.items.length === 0) return;

    setCart((prevCart) => {
      const updated = [...prevCart];
      for (const recItem of rec.items) {
        const found = updated.find(
          (item) => item.menuItemId === recItem.menuItemId
        );
        if (found) {
          found.quantity = Math.min(20, found.quantity + recItem.quantity);
        } else {
          updated.push({
            menuItemId: recItem.menuItemId,
            name: recItem.name,
            price: recItem.price,
            quantity: Math.min(20, recItem.quantity),
          });
        }
      }
      return updated;
    });

    setIsCartOpen(true);
  };

  // Chat Submission
  const handleChatSubmit = async (queryText?: string) => {
    const textToSend = (queryText ?? query).trim();
    if (!textToSend || isSearching) return;

    if (textToSend.length > 300) {
      setSearchError("Message cannot exceed 300 characters.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setLastSubmittedQuery(textToSend);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          tableId: table.id,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.error || `Failed to fetch recommendation (HTTP ${res.status})`
        );
      }

      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while finding recommendations.";
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  // Order Placement
  const handlePlaceOrder = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;

    if (totalCartCount > 30) {
      setCheckoutError("Maximum order capacity is 30 items in total.");
      return;
    }

    setIsSubmittingOrder(true);
    setCheckoutError(null);

    try {
      const payload = {
        tableId: table.id,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
        note: orderNote.trim() ? orderNote.trim() : undefined,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to place order.");
      }

      // Success: clear cart and navigate to order confirmation
      setCart([]);
      setIsCartOpen(false);
      router.push(`/t/${table.number}/order/${data.orderId}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not place order. Please try again.";
      setCheckoutError(message);
      setIsSubmittingOrder(false);
    }
  };

  // Helper for Diet Badge
  const renderDietBadge = (dietTagsStr: string) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse(dietTagsStr);
    } catch {
      tags = [];
    }

    if (tags.includes("vegan")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
          🌿 Vegan
        </span>
      );
    }
    if (tags.includes("veg")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800">
          🌱 Veg
        </span>
      );
    }
    if (tags.includes("non-veg")) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
          🍗 Non-Veg
        </span>
      );
    }
    return null;
  };

  // Helper for Spice Badge
  const renderSpiceBadge = (level: number) => {
    if (level === 0) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
          Mild
        </span>
      );
    }
    const flames = "🌶️".repeat(level);
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
        {flames} Level {level}
      </span>
    );
  };

  // Filtered menu items for browsing
  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === "all") return menuItems;
    return menuItems.filter((item) => item.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-28 md:pb-12">
      {/* Top Mobile-First Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              DA
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  DineAssist
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Table #{table.number}
              </p>
            </div>
          </div>

          {/* Quick Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
            aria-label="View Cart"
          >
            <span>🛒 Cart</span>
            {totalCartCount > 0 && (
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="max-w-xl mx-auto w-full px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("assistant")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "assistant"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>✨ AI Assistant</span>
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "menu"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📖 Browse Menu</span>
          </button>
        </div>
      </div>

      <main className="max-w-xl mx-auto w-full px-4 py-2 flex-1">
        {/* ============================================================== */}
        {/* TAB 1: AI ASSISTANT & RECOMMENDATIONS                          */}
        {/* ============================================================== */}
        {activeTab === "assistant" && (
          <div className="space-y-4">
            {/* Prompt Box */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <label
                htmlFor="chat-query"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
              >
                Tell us what you&apos;re craving
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Include spice preference, diet, party size, or budget. We&apos;ll build the perfect combo!
              </p>

              <div className="relative">
                <textarea
                  id="chat-query"
                  rows={3}
                  value={query}
                  onChange={(e) => setQuery(e.target.value.slice(0, 300))}
                  placeholder="e.g., spicy vegetarian dinner for two under 1200 rupees, no onions"
                  disabled={isSearching}
                  className="w-full text-sm rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed resize-none transition"
                />
                <div className="absolute right-3 bottom-3 text-[11px] font-medium text-slate-400">
                  {query.length}/300
                </div>
              </div>

              {/* Sample Suggestions */}
              {!recommendation && !isSearching && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-slate-400 self-center">Try:</span>
                  {[
                    "Vegetarian feast for two under 1000",
                    "Spicy chicken mains and drinks for 3",
                    "Vegan dinner, mild spice",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuery(example);
                        handleChatSubmit(example);
                      }}
                      className="text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2 py-1 rounded-md border border-slate-200 transition-colors text-left"
                    >
                      &ldquo;{example}&rdquo;
                    </button>
                  ))}
                </div>
              )}

              {/* Action Button & Loading Status */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex-1">
                  {isSearching && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                      <svg
                        className="animate-spin h-4 w-4 text-emerald-600 shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>
                        Finding dishes for you...{" "}
                        <span className="tabular-nums font-bold">
                          {elapsedSeconds}s
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleChatSubmit()}
                  disabled={isSearching || !query.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>Find Dishes</span>
                  <span>✨</span>
                </button>
              </div>

              {/* Error & Retry */}
              {searchError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-2">
                  <div className="text-xs text-rose-700">
                    <p className="font-bold">Recommendation Error</p>
                    <p>{searchError}</p>
                  </div>
                  <button
                    onClick={() => handleChatSubmit(lastSubmittedQuery)}
                    className="text-xs font-bold px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shrink-0 transition"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* Recommendation Display */}
            {recommendation && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
                {/* Assistant Message */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs text-emerald-950 font-medium leading-relaxed">
                  <span className="font-bold block text-emerald-800 text-[11px] uppercase tracking-wider mb-0.5">
                    💡 Chef&apos;s Recommendation
                  </span>
                  {recommendation.message}
                </div>

                {/* Recommended Cards */}
                {recommendation.items.length > 0 ? (
                  <>
                    <div className="space-y-2.5 pt-1">
                      {recommendation.items.map((item) => {
                        const originalDish = menuItems.find(
                          (m) => m.id === item.menuItemId
                        );

                        return (
                          <div
                            key={item.menuItemId}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:border-slate-300 transition"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                  {item.name}
                                </h4>
                                {originalDish &&
                                  renderDietBadge(originalDish.dietTags)}
                                {originalDish &&
                                  renderSpiceBadge(originalDish.spiceLevel)}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                ₹{item.price} × {item.quantity} ={" "}
                                <span className="font-bold text-slate-900">
                                  ₹{item.price * item.quantity}
                                </span>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                addToCart(
                                  {
                                    id: item.menuItemId,
                                    name: item.name,
                                    price: item.price,
                                  },
                                  item.quantity
                                )
                              }
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 transition"
                            >
                              + Add
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Accept Whole Combo Button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] text-slate-500 block">
                          Combo Total
                        </span>
                        <span className="text-base font-extrabold text-slate-900">
                          ₹{recommendation.total}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => acceptWholeRecommendation(recommendation)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                      >
                        <span>Accept Recommendation</span>
                        <span>🛒</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500">
                    No items could be selected for this query. Try adjusting your preferences or browse the full menu.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: BROWSE FULL MENU                                        */}
        {/* ============================================================== */}
        {activeTab === "menu" && (
          <div className="space-y-3">
            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-medium">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat.key
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Menu Items List */}
            <div className="space-y-2.5">
              {filteredMenuItems.map((dish) => {
                const inCart = cart.find((ci) => ci.menuItemId === dish.id);

                return (
                  <div
                    key={dish.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {renderDietBadge(dish.dietTags)}
                        {renderSpiceBadge(dish.spiceLevel)}
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                          {dish.category}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {dish.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {dish.description}
                      </p>

                      <div className="text-sm font-extrabold text-slate-900 mt-2">
                        ₹{dish.price}
                      </div>
                    </div>

                    <div className="shrink-0 self-center">
                      {inCart ? (
                        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(dish.id, inCart.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-slate-900 tabular-nums">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(dish.id, inCart.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(dish, 1)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1"
                        >
                          <span>Add</span>
                          <span>+</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* STICKY BOTTOM CHECKOUT BAR                                     */}
      {/* ============================================================== */}
      {totalCartCount > 0 && !isCartOpen && (
        <aside
          aria-label="Cart summary"
          className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg"
        >
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {totalCartCount}
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {totalCartCount === 1 ? "1 item" : `${totalCartCount} items`}
                </span>
              </div>
              <p className="text-base font-extrabold text-slate-900 leading-tight">
                ₹{totalCartAmount}
              </p>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5"
            >
              <span>View Cart</span>
              <span>→</span>
            </button>
          </div>
        </aside>
      )}

      {/* ============================================================== */}
      {/* FULL CART / CHECKOUT MODAL DRAWER                             */}
      {/* ============================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl max-w-xl mx-auto w-full overflow-hidden">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Your Order • Table #{table.number}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {totalCartCount} {totalCartCount === 1 ? "dish" : "dishes"}{" "}
                  selected
                </p>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition"
                aria-label="Close cart"
              >
                ✕
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Your cart is currently empty.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        ₹{item.price} each •{" "}
                        <span className="font-bold text-slate-800">
                          ₹{item.price * item.quantity}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(
                              item.menuItemId,
                              item.quantity - 1
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-900 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(
                              item.menuItemId,
                              item.quantity + 1
                            )
                          }
                          className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.menuItemId)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Remove item"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Special Note Box */}
              {cart.length > 0 && (
                <div className="pt-2">
                  <label
                    htmlFor="order-note"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Special Instructions (Optional)
                  </label>
                  <input
                    id="order-note"
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value.slice(0, 200))}
                    placeholder="e.g., extra spicy, serve drinks first..."
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Checkout Error */}
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  <span className="font-bold block">Checkout Error</span>
                  {checkoutError}
                </div>
              )}
            </div>

            {/* Footer Summary & Place Order Button */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total Items</span>
                  <span className="font-bold text-slate-800">
                    {totalCartCount} / 30
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
                  <span>Grand Total</span>
                  <span className="text-lg text-emerald-700">
                    ₹{totalCartAmount}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder || cart.length === 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmittingOrder ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span>Placing your order...</span>
                    </>
                  ) : (
                    <>
                      <span>Place Order</span>
                      <span>•</span>
                      <span>₹{totalCartAmount}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

