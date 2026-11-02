/**
 * Chạy worker xử lý video thành tiến trình riêng: `npm run worker`
 * (đặt WORKER_ENABLED=false trong .env để web server không chạy worker nữa).
 */
import "dotenv/config";
import { startWorker } from "@/server/media/worker";

startWorker();
