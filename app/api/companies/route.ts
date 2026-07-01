import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import * as XLSX from "xlsx";

export async function GET() {
  const supabase = getSupabaseServer();
  const { count, error } = await supabase
    .from("target_companies")
    .select("*", { count: "exact", head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return NextResponse.json({ error: "Spreadsheet has no sheets" }, { status: 400 });
  }

  // raw: false so every cell comes back as a formatted string, not a JS number/date
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Spreadsheet is empty" }, { status: 400 });
  }

  // Case-insensitive match on the header row
  const companyKey = Object.keys(rows[0]).find(
    (k) => k.trim().toLowerCase() === "company"
  );
  if (!companyKey) {
    return NextResponse.json(
      { error: 'No column named "Company" found in the first sheet' },
      { status: 400 }
    );
  }

  // Coerce each cell to string, trim, drop blanks, deduplicate within the batch.
  // typeof val === "object" catches SheetJS formula-error objects like { error: "#N/A" }.
  const names = [
    ...new Set(
      rows
        .map((row) => {
          const val = row[companyKey];
          if (val === null || val === undefined || typeof val === "object") return "";
          return String(val).trim();
        })
        .filter((n) => n.length > 0)
    ),
  ];

  if (names.length === 0) {
    return NextResponse.json(
      { error: 'The "Company" column has no non-blank values' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServer();

  // ignoreDuplicates: true → ON CONFLICT DO NOTHING, so existing rows are left untouched.
  const { error: upsertErr } = await supabase
    .from("target_companies")
    .upsert(
      names.map((company_name) => ({
        company_name,
        source: "excel_import",
        priority: false,
      })),
      { onConflict: "company_name", ignoreDuplicates: true }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("target_companies")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({ imported: names.length, total: count ?? 0 });
}
