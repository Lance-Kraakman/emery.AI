'use server'

import { uploadFile, validateFileType, validateFileSize } from "@/lib/s3/operations";
import { auth, hasPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function uploadFileAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Authentication required");
    }

    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      throw new Error("Permission denied: manage_data required");
    }

    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldId = parseInt(formData.get('fieldId') as string);

    if (!file) {
      throw new Error("No file provided");
    }

    if (!organizationId || !tableId || !fieldId) {
      throw new Error("organizationId, tableId, and fieldId are required");
    }

    if (!validateFileType(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }

    if (!validateFileSize(file.size)) {
      throw new Error("File size exceeds maximum allowed size");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const fileMetadata = await uploadFile(
      buffer,
      file.name,
      file.type,
      organizationId,
      tableId,
      fieldId
    );

    revalidatePath('/mission-control'); // Or a more specific path if available
    return { success: true, data: fileMetadata };
  } catch (error) {
    console.error("Error uploading file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to upload file" };
  }
}
