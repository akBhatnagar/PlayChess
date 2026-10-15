import { build, context } from "esbuild";
import { spawn } from "node:child_process";

const watch = process.argv.includes("--watch");

/** Bundle workspace TypeScript. Leave Fastify and Prisma external so their plugins and engines load from node_modules. */
const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/server.js",
  sourcemap: true,
  external: ["@prisma/client", "fastify", "@fastify/cookie", "@fastify/cors", "@fastify/static"],
};

if (!watch) {
  await build(options);
} else {
  let child;
  const ctx = await context({
    ...options,
    plugins: [
      {
        name: "restart",
        setup(buildApi) {
          buildApi.onEnd((result) => {
            if (result.errors.length > 0) {
              return;
            }
            child?.kill("SIGTERM");
            child = spawn(process.execPath, ["dist/server.js"], { stdio: "inherit" });
          });
        },
      },
    ],
  });
  await ctx.watch();
}
