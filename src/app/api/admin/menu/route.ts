import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  deleteMenuItemSchema,
  toggleAvailabilitySchema,
} from "@/lib/validations/menu";

// GET /api/admin/menu - List all menu items (optional ?category= filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where =
      category && category !== "all"
        ? { category }
        : {};

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}

// POST /api/admin/menu - Create a menu item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createMenuItemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { dietTags, ...data } = result.data;

    const newItem = await prisma.menuItem.create({
      data: {
        ...data,
        dietTags: JSON.stringify(dietTags),
      },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error("Failed to create menu item:", error);
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/menu - Update a menu item
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = updateMenuItemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, dietTags, ...data } = result.data;

    const existing = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...data,
        dietTags: JSON.stringify(dietTags),
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Failed to update menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/menu - Toggle availability
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = toggleAvailabilitySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, isAvailable } = result.data;

    const existing = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const nextAvailability =
      typeof isAvailable === "boolean" ? isAvailable : !existing.isAvailable;

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        isAvailable: nextAvailability,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Failed to toggle menu item availability:", error);
    return NextResponse.json(
      { error: "Failed to toggle menu item availability" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/menu - Delete a menu item
export async function DELETE(request: Request) {
  try {
    let id: string | null = null;

    // Check query params first
    const { searchParams } = new URL(request.url);
    id = searchParams.get("id");

    // Check json body if not in query params
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // Body might be empty
      }
    }

    const result = deleteMenuItemSchema.safeParse({ id });
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    const existing = await prisma.menuItem.findUnique({
      where: { id: result.data.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    await prisma.menuItem.delete({
      where: { id: result.data.id },
    });

    return NextResponse.json({ success: true, id: result.data.id });
  } catch (error) {
    console.error("Failed to delete menu item:", error);
    return NextResponse.json(
      { error: "Failed to delete menu item" },
      { status: 500 }
    );
  }
}
