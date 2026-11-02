import { tusServer } from "@/server/media/upload";

// Upload video dạng resumable (giao thức tus): mỗi chunk là một request PATCH riêng,
// nên không bị giới hạn kích thước request của IIS/Next.js với file nhiều GB.
const handler = (request: Request) => tusServer.handleWeb(request);

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;

export const dynamic = "force-dynamic";
export const maxDuration = 3600;
