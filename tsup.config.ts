import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    dts: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/mcp.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    sourcemap: true,
    dts: true,
  },
]);
