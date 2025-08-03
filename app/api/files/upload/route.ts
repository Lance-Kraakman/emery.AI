import { NextRequest, NextResponse } from "next/server";
import { uploadFile, validateFileType, validateFileSize } from "@/lib/s3/operations";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = parseInt(formData.get('workspaceId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldId = parseInt(formData.get('fieldId') as string);

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!workspaceId || !tableId || !fieldId) {
      return NextResponse.json(
        { error: "workspaceId, tableId, and fieldId are required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!validateFileType(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed` },
        { status: 400 }
      );
    }

    // Validate file size
    if (!validateFileSize(file.size)) {
      return NextResponse.json(
        { error: "File size exceeds maximum allowed size" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const fileMetadata = await uploadFile(
      buffer,
      file.name,
      file.type,
      workspaceId,
      tableId,
      fieldId
    );

    return NextResponse.json(fileMetadata, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}