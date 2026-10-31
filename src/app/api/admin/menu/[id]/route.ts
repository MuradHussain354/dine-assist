import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  updateMenuItemSchema,
  deleteMenuItemSchema,
  toggleAvailabilitySchema,
} from "@/lib/validations/menu";

// PUT /api/admin/menu/[id] - Update a specific menu item
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const result = updateMenuItemSchema.safeParse({
      ...body,
      id: params.id,
    });

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

// PATCH /api/admin/menu/[id] - Toggle availability
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable for simple toggle
    }

    const result = toggleAvailabilitySchema.safeParse({
      ...body,
      id: params.id,
    });

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

// DELETE /api/admin/menu/[id] - Delete a specific menu item
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = deleteMenuItemSchema.safeParse({ id: params.id });
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

    const orderCount = await prisma.orderItem.count({
      where: { menuItemId: result.data.id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { error: "This dish has past orders. Disable it instead." },
        { status: 409 }
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

