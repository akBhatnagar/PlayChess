import { parseServerEnv } from "@playchess/validation";
import { buildApp, webDistPath } from "./app.ts";
import { createPrisma } from "./db.ts";

const env = parseServerEnv(process.env);
const prisma = createPrisma();
const app = await buildApp(env, prisma, { webDist: webDistPath() });

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({ host: env.API_HOST, port: env.API_PORT });
