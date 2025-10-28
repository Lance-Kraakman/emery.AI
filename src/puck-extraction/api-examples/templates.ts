/**
 * Example API Routes for Templates
 *
 * Copy these to your app/api/puck/templates directory and adapt for your database.
 */

import { NextRequest, NextResponse } from "next/server";
import { Data } from "@measured/puck";
// import { db } from "@/db";
// import { puckTemplates } from "@/db/schema";
// import { eq } from "drizzle-orm";

// ==================== GET /api/puck/templates ====================
// List all templates
export async function GET_TEMPLATES(req: NextRequest) {
  try {
    // const templates = await db.select().from(puckTemplates);
    // return NextResponse.json(templates);

    return NextResponse.json({
      message: "Replace with your database query",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// ==================== POST /api/puck/templates ====================
// Create new template
export async function POST_TEMPLATE(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, data } = body;

    // Validate
    if (!name || !slug) {
      return NextResponse.json(
        { error: "name and slug are required" },
        { status: 400 }
      );
    }

    const templateData: Data = data || {
      content: [],
      root: {},
      zones: {},
    };

    // const [template] = await db
    //   .insert(puckTemplates)
    //   .values({ name, slug, data: templateData })
    //   .returning();

    // return NextResponse.json(template, { status: 201 });

    return NextResponse.json({
      message: "Replace with your database insert",
      received: { name, slug, data: templateData },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// ==================== GET /api/puck/templates/[id] ====================
// Get single template
export async function GET_TEMPLATE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const template = await db.query.puckTemplates.findFirst({
    //   where: eq(puckTemplates.id, params.id),
    // });

    // if (!template) {
    //   return NextResponse.json(
    //     { error: "Template not found" },
    //     { status: 404 }
    //   );
    // }

    // return NextResponse.json(template);

    return NextResponse.json({
      message: "Replace with your database query",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// ==================== PUT /api/puck/templates/[id] ====================
// Update template (usually just the data field)
export async function PUT_TEMPLATE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { name, slug, data } = body;

    // const [updated] = await db
    //   .update(puckTemplates)
    //   .set({
    //     ...(name && { name }),
    //     ...(slug && { slug }),
    //     ...(data && { data }),
    //     updatedAt: new Date(),
    //   })
    //   .where(eq(puckTemplates.id, params.id))
    //   .returning();

    // if (!updated) {
    //   return NextResponse.json(
    //     { error: "Template not found" },
    //     { status: 404 }
    //   );
    // }

    // return NextResponse.json(updated);

    return NextResponse.json({
      message: "Replace with your database update",
      requestedId: params.id,
      updates: body,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// ==================== DELETE /api/puck/templates/[id] ====================
// Delete template (will fail if pages reference it due to FK constraint)
export async function DELETE_TEMPLATE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // const [deleted] = await db
    //   .delete(puckTemplates)
    //   .where(eq(puckTemplates.id, params.id))
    //   .returning();

    // if (!deleted) {
    //   return NextResponse.json(
    //     { error: "Template not found" },
    //     { status: 404 }
    //   );
    // }

    // return NextResponse.json({ success: true });

    return NextResponse.json({
      message: "Replace with your database delete",
      requestedId: params.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
