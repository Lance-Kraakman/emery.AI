import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { fileVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;

    const versions = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.versionNumber));

    return NextResponse.json(versions);
  } catch (error) {
    console.error("Error fetching file versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch file versions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    const { content, changeSummary, createdBy } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get the latest version number
    const [latestVersion] = await db
      .select({ versionNumber: fileVersions.versionNumber })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.versionNumber))
      .limit(1);

    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Mark all existing versions as not current
    await db
      .update(fileVersions)
      .set({ isCurrent: false })
      .where(eq(fileVersions.fileId, fileId));

    // Create new version
    const [newVersion] = await db
      .insert(fileVersions)
      .values({
        fileId,
        versionNumber: newVersionNumber,
        content,
        changeSummary,
        createdBy,
        isCurrent: true,
      })
      .returning();

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    console.error("Error creating file version:", error);
    return NextResponse.json(
      { error: "Failed to create file version" },
      { status: 500 }
    );
  }
}