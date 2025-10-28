/**
 * Example API Routes for Pages
 *
 * Copy these to your app/api/puck/pages directory and adapt for your database.
 */

import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/db";
// import { puckPages } from "@/db/schema";
// import { eq } from "drizzle-orm";

// ==================== GET /api/puck/pages?appId=xxx ====================
// List pages for an app
export async function GET_PAGES(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");

    if (!appId) {
      return NextResponse.json(
        { error: "appId query parameter required" },
        { status: 400 }
      );
    }

    // const pages = await db.query.puckPages.findMany({
    //   where: eq(puckPages.appId, appId),
    //   with: {
    //     template: true,
    //   },
    //   orderBy: (pages, { asc }) => [asc(pages.order)],
    // });

    // return NextResponse.json(pages);

    return NextResponse.json({
      message: "Replace with your database query",
      appId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

// ==================== POST /api/puck/pages ====================
// Create new page
export async function POST_PAGE(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, order, templateId, appId, isPublished } = body;

    // Validate
    if (!name || !slug || !templateId || !appId) {
      return NextResponse.json(
        { error: "name, slug, templateId, and appId are required" },
        { status: 400 }
      );
    }

    // const [page] = await db
    //   .insert(puckPages)
    //   .values({
    //     name,
    //     slug,
    //     description,
    //     order: order ?? 0,
    //     templateId,
    //     appId,
    //     isPublished: isPublished ?? false,
    //   })
    //   .returning();

    // return NextResponse.json(page, { status: 201 });

    return NextResponse.json({
      message: "Replace with your database insert",
      received: body,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create page" },
      { status: 500 }
    );
  }
}

// ==================== GET /api/puck/pages/[id] ====================
// Get single page with template
export async function GET_PAGE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const page = await db.query.puckPages.findFirst({
    //   where: eq(puckPages.id, params.id),
    //   with: {
    //     template: true,
    //     app: true,
    //   },
    // });

    // if (!page) {
    //   return NextResponse.json({ error: "Page not found" }, { status: 404 });
    // }

    // return NextResponse.json(page);

    return NextResponse.json({
      message: "Replace with your database query",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}

// ==================== PUT /api/puck/pages/[id] ====================
// Update page
export async function PUT_PAGE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    // const [updated] = await db
    //   .update(puckPages)
    //   .set({
    //     ...body,
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(puckPages.id, params.id))
    //   .returning();

    // if (!updated) {
    //   return NextResponse.json({ error: "Page not found" }, { status: 404 });
    // }

    // return NextResponse.json(updated);

    return NextResponse.json({
      message: "Replace with your database update",
      requestedId: params.id,
      updates: body,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}

// ==================== DELETE /api/puck/pages/[id] ====================
// Delete page
export async function DELETE_PAGE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const [deleted] = await db
    //   .delete(puckPages)
    //   .where(eq(puckPages.id, params.id))
    //   .returning();

    // if (!deleted) {
    //   return NextResponse.json({ error: "Page not found" }, { status: 404 });
    // }

    // return NextResponse.json({ success: true });

    return NextResponse.json({
      message: "Replace with your database delete",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
