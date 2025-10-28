/**
 * Example API Routes for Apps
 *
 * Copy these to your app/api/puck/apps directory and adapt for your database.
 *
 * Example structure:
 * app/api/puck/apps/route.ts - GET (list), POST (create)
 * app/api/puck/apps/[id]/route.ts - GET (single), PUT (update), DELETE
 */

import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/db";
// import { puckApps } from "@/db/schema";
// import { eq } from "drizzle-orm";

// ==================== GET /api/puck/apps ====================
// List all apps
export async function GET_APPS(req: NextRequest) {
  try {
    // const apps = await db.select().from(puckApps);
    // return NextResponse.json(apps);

    return NextResponse.json({
      message: "Replace with your database query",
      example: [
        {
          id: "app-1",
          name: "Marketing Site",
          slug: "marketing-site",
          description: "Public marketing website",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch apps" },
      { status: 500 }
    );
  }
}

// ==================== POST /api/puck/apps ====================
// Create new app
export async function POST_APP(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description } = body;

    // Validate input
    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // const [app] = await db
    //   .insert(puckApps)
    //   .values({ name, slug, description })
    //   .returning();

    // return NextResponse.json(app, { status: 201 });

    return NextResponse.json({
      message: "Replace with your database insert",
      received: { name, slug, description },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create app" },
      { status: 500 }
    );
  }
}

// ==================== GET /api/puck/apps/[id] ====================
// Get single app by ID
export async function GET_APP(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const app = await db.query.puckApps.findFirst({
    //   where: eq(puckApps.id, params.id),
    //   with: {
    //     pages: {
    //       with: {
    //         template: true,
    //       },
    //     },
    //   },
    // });

    // if (!app) {
    //   return NextResponse.json({ error: "App not found" }, { status: 404 });
    // }

    // return NextResponse.json(app);

    return NextResponse.json({
      message: "Replace with your database query",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch app" },
      { status: 500 }
    );
  }
}

// ==================== PUT /api/puck/apps/[id] ====================
// Update app
export async function PUT_APP(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { name, slug, description } = body;

    // const [updated] = await db
    //   .update(puckApps)
    //   .set({
    //     name,
    //     slug,
    //     description,
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(puckApps.id, params.id))
    //   .returning();

    // if (!updated) {
    //   return NextResponse.json({ error: "App not found" }, { status: 404 });
    // }

    // return NextResponse.json(updated);

    return NextResponse.json({
      message: "Replace with your database update",
      requestedId: params.id,
      updates: { name, slug, description },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update app" },
      { status: 500 }
    );
  }
}

// ==================== DELETE /api/puck/apps/[id] ====================
// Delete app (cascades to pages)
export async function DELETE_APP(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const [deleted] = await db
    //   .delete(puckApps)
    //   .where(eq(puckApps.id, params.id))
    //   .returning();

    // if (!deleted) {
    //   return NextResponse.json({ error: "App not found" }, { status: 404 });
    // }

    // return NextResponse.json({ success: true });

    return NextResponse.json({
      message: "Replace with your database delete",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete app" },
      { status: 500 }
    );
  }
}
