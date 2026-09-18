import { NextRequest, NextResponse } from "next/server";
import { ingestCsv } from "@/lib/ingestion/service";
import { CsvParseError } from "@/lib/csv/pipeline";

// Required for Prisma and optimal CSV parsing
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    // Validate extension
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { error: "Only CSV files are allowed" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the maximum allowed size (10MB)" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    
    // Pass strictly just the filename metadata (not a path) and content
    const result = await ingestCsv(file.name, csvText);

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error("Upload processing failed:", error);

    // Differentiate between our pipeline's expected errors and DB failures
    if (error instanceof CsvParseError) {
      return NextResponse.json(
        { error: "Invalid CSV format: " + error.message },
        { status: 400 }
      );
    }

    // Safely mask internal/Prisma errors
    return NextResponse.json(
      { error: "An internal server error occurred while processing the upload" },
      { status: 500 }
    );
  }
}
