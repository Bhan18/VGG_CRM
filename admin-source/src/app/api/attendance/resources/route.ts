import { NextRequest } from "next/server";
import { listResources, createResource } from "@/lib/attendance/resources";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") as "ACTIVE" | "INACTIVE" | null;
  const category = url.searchParams.get("category") ?? undefined;
  const department = url.searchParams.get("department") ?? undefined;
  const items = await listResources({
    status: status ?? undefined,
    category,
    department,
  });
  return json({ items });
}, "resources/list");

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.fileData || !body?.fileName) {
    return errorResponse("Missing title / fileData / fileName", 400);
  }
  const resource = await createResource(
    {
      title: body.title,
      description: body.description,
      category: body.category,
      visibility: body.visibility,
      departmentFilter: body.departmentFilter,
      fileData: body.fileData,
      fileName: body.fileName,
      fileType: body.fileType,
    },
    ctx,
  );
  return json({ resource }, { status: 201 });
}, "resources/create");
