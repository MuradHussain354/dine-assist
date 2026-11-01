"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/admin/admin-nav";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "starter" | "main" | "side" | "dessert" | "drink";
  dietTags: string; // JSON string e.g. '["veg"]'
  spiceLevel: number; // 0-3
  cuisine: string;
  isAvailable: boolean;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: "starter" | "main" | "side" | "dessert" | "drink";
  spiceLevel: number;
  dietTags: ("veg" | "vegan" | "non-veg")[];
  cuisine: string;
  isAvailable: boolean;
}

const initialFormState: FormState = {
  name: "",
  description: "",
  price: "",
  category: "main",
  spiceLevel: 1,
  dietTags: ["veg"],
  cuisine: "North Indian",
  isAvailable: true,
};

export default function AdminMenuPage() {
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle availability state tracker
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/menu");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Error fetching menu items:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Open modal for Create
  const handleOpenAdd = () => {
    setFormState(initialFormState);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item: MenuItem) => {
    let parsedTags: ("veg" | "vegan" | "non-veg")[] = ["veg"];
    try {
      parsedTags = JSON.parse(item.dietTags);
    } catch {
      parsedTags = ["veg"];
    }

    setFormState({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      spiceLevel: item.spiceLevel,
      dietTags: parsedTags,
      cuisine: item.cuisine,
      isAvailable: item.isAvailable,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Toggle Diet Tag Checkbox with vegan -> veg rule
  const handleDietTagToggle = (tag: "veg" | "vegan" | "non-veg") => {
    setFormState((prev) => {
      let currentTags = [...prev.dietTags];

      if (tag === "non-veg") {
        // If selecting non-veg, replace veg and vegan
        return { ...prev, dietTags: ["non-veg"] };
      }

      // If user clicks veg or vegan, clear non-veg
      currentTags = currentTags.filter((t) => t !== "non-veg");

      if (tag === "vegan") {
        if (currentTags.includes("vegan")) {
          currentTags = currentTags.filter((t) => t !== "vegan");
        } else {
          currentTags.push("vegan");
          // Vegan items MUST also include "veg"
          if (!currentTags.includes("veg")) {
            currentTags.push("veg");
          }
        }
      } else if (tag === "veg") {
        if (currentTags.includes("veg")) {
          // If unchecking veg, also uncheck vegan because vegan must include veg
          currentTags = currentTags.filter((t) => t !== "veg" && t !== "vegan");
        } else {
          currentTags.push("veg");
        }
      }

      if (currentTags.length === 0) {
        currentTags = ["veg"];
      }

      return { ...prev, dietTags: currentTags };
    });
  };

  // Save Dish (Add or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const priceNum = parseInt(formState.price, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("Price must be a positive integer.");
      return;
    }

    if (!formState.name.trim()) {
      setFormError("Dish name is required.");
      return;
    }

    if (formState.dietTags.includes("vegan") && !formState.dietTags.includes("veg")) {
      setFormError('Vegan items must also include "veg".');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        price: priceNum,
        category: formState.category,
        spiceLevel: Number(formState.spiceLevel),
        dietTags: formState.dietTags,
        cuisine: formState.cuisine.trim(),
        isAvailable: formState.isAvailable,
      };

      const isEdit = Boolean(formState.id);
      const url = isEdit ? `/api/admin/menu/${formState.id}` : "/api/admin/menu";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { ...payload, id: formState.id } : payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) {
          const firstErr = Object.values(data.details.fieldErrors).flat()[0];
          setFormError(String(firstErr || data.error || "Failed to save dish"));
        } else {
          setFormError(data.error || "Failed to save dish");
        }
        setSaving(false);
        return;
      }

      setIsModalOpen(false);
      await fetchItems();
    } catch {
      setFormError("An unexpected network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Availability
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      setTogglingId(item.id);
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });

      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, isAvailable: !item.isAvailable } : i
          )
        );
      }
    } catch (err) {
      console.error("Error toggling availability:", err);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete Dish
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await fetch(`/api/admin/menu/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete dish");
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting dish:", err);
      setDeleteError("An unexpected network error occurred.");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        filterCategory === "all" || item.category === filterCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, filterCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: items.length,
      available: items.filter((i) => i.isAvailable).length,
      disabled: items.filter((i) => !i.isAvailable).length,
    };
  }, [items]);

  const categories = [
    { id: "all", label: "All Items" },
    { id: "starter", label: "Starters" },
    { id: "main", label: "Mains" },
    { id: "side", label: "Sides" },
    { id: "dessert", label: "Desserts" },
    { id: "drink", label: "Drinks" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <AdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Menu Management</h2>
            <p className="text-sm text-slate-400">
              Manage dishes, toggle availability, edit pricing, and configure diet tags
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-lg shadow-amber-500/10 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Add New Dish</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-400">
                Total Dishes
              </p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <span className="p-3 bg-slate-800 rounded-lg text-slate-400 text-lg">
              📋
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-400">
                Active & Available
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.available}
              </p>
            </div>
            <span className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg text-lg">
              ✓
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-400">
                Disabled / Out of Stock
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-1">
                {stats.disabled}
              </p>
            </div>
            <span className="p-3 bg-rose-500/10 text-rose-400 rounded-lg text-lg">
              ✕
            </span>
          </div>
        </div>

        {/* Controls: Category Tabs & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {categories.map((cat) => {
              const active = filterCategory === cat.id;
              const count =
                cat.id === "all"
                  ? items.length
                  : items.filter((i) => i.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      active
                        ? "bg-slate-950/20 text-slate-950 font-bold"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              placeholder="Search dishes or cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 pl-9 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Menu Items Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <svg
                className="animate-spin h-8 w-8 text-amber-500 mx-auto"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p>Loading dishes...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="text-base font-semibold text-white">
                No dishes found
              </p>
              <p className="text-xs">
                Try selecting another category or clear your search query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">Dish</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Cuisine</th>
                    <th className="py-3.5 px-4">Diet</th>
                    <th className="py-3.5 px-4">Spice</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredItems.map((item) => {
                    let tags: string[] = [];
                    try {
                      tags = JSON.parse(item.dietTags);
                    } catch {
                      tags = [];
                    }

                    const categoryColors: Record<string, string> = {
                      starter:
                        "bg-blue-500/10 text-blue-400 border-blue-500/20",
                      main: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                      side: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      dessert:
                        "bg-pink-500/10 text-pink-400 border-pink-500/20",
                      drink: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                    };

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          !item.isAvailable ? "opacity-60 bg-slate-950/30" : ""
                        }`}
                      >
                        {/* Name & Description */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="font-semibold text-white">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {item.description}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                              categoryColors[item.category] ||
                              "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {item.category}
                          </span>
                        </td>

                        {/* Cuisine */}
                        <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                          {item.cuisine}
                        </td>

                        {/* Diet Tags */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded border capitalize ${
                                  t === "veg"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : t === "vegan"
                                    ? "bg-teal-500/10 text-teal-300 border-teal-500/30"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Spice Level */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-300">
                            {item.spiceLevel === 0 && "0 (Mild)"}
                            {item.spiceLevel === 1 && "🌶️ 1"}
                            {item.spiceLevel === 2 && "🌶️🌶️ 2"}
                            {item.spiceLevel === 3 && "🌶️🌶️🌶️ 3 (Hot)"}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-4 px-4 whitespace-nowrap font-bold text-amber-400">
                          ₹{item.price}
                        </td>

                        {/* Status (Toggle Switch) */}
                        <td className="py-4 px-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(item)}
                            disabled={togglingId === item.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              item.isAvailable
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                            }`}
                            title="Click to toggle availability"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isAvailable
                                  ? "bg-emerald-400"
                                  : "bg-slate-500"
                              }`}
                            />
                            <span>{item.isAvailable ? "Available" : "Disabled"}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget(item);
                                setDeleteError(null);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Dish Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white">
                {formState.id ? "Edit Dish" : "Add New Dish"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                <span>⚠️ {formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) =>
                    setFormState({ ...formState, name: e.target.value })
                  }
                  placeholder="e.g. Paneer Butter Masala"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formState.description}
                  onChange={(e) =>
                    setFormState({ ...formState, description: e.target.value })
                  }
                  placeholder="Tender cottage cheese cooked in creamy tomato butter sauce..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        category: e.target.value as FormState["category"],
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="starter">Starter</option>
                    <option value="main">Main</option>
                    <option value="side">Side</option>
                    <option value="dessert">Dessert</option>
                    <option value="drink">Drink</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Price (₹ Rupees) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formState.price}
                    onChange={(e) =>
                      setFormState({ ...formState, price: e.target.value })
                    }
                    placeholder="e.g. 450"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cuisine *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.cuisine}
                    onChange={(e) =>
                      setFormState({ ...formState, cuisine: e.target.value })
                    }
                    placeholder="e.g. North Indian"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Spice Level (0 to 3) *
                  </label>
                  <select
                    value={formState.spiceLevel}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        spiceLevel: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value={0}>0 - Mild / Sweet</option>
                    <option value={1}>1 - Mild</option>
                    <option value={2}>2 - Medium</option>
                    <option value={3}>3 - Hot</option>
                  </select>
                </div>
              </div>

              {/* Diet Tags Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Diet Tags * (Note: Vegan dishes must include Veg)
                </label>
                <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.dietTags.includes("veg")}
                      onChange={() => handleDietTagToggle("veg")}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                    />
                    <span>Veg</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.dietTags.includes("vegan")}
                      onChange={() => handleDietTagToggle("vegan")}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                    />
                    <span>Vegan</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.dietTags.includes("non-veg")}
                      onChange={() => handleDietTagToggle("non-veg")}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                    />
                    <span>Non-Veg</span>
                  </label>
                </div>
              </div>

              {/* Availability checkbox */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isAvailable}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isAvailable: e.target.checked,
                      })
                    }
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                  />
                  <span>Dish is currently available to customers</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg shadow-lg shadow-amber-500/10 transition-colors"
                >
                  {saving ? "Saving..." : formState.id ? "Update Dish" : "Create Dish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Dish</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-white">
                &ldquo;{deleteTarget.name}&rdquo;
              </span>
              ? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm p-3 rounded-lg flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span className="flex-1">{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                {deleteError ? "Close" : "Cancel"}
              </button>
              {deleteError && deleteTarget.isAvailable ? (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleAvailability(deleteTarget);
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                >
                  Disable Dish Instead
                </button>
              ) : !deleteError ? (
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
