import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

// NestJS's DI relies on TypeScript's emitDecoratorMetadata (design:paramtypes)
// to resolve constructor parameters like `private readonly config: ConfigService`.
// Vitest transforms TS via esbuild by default, which does NOT emit that
// metadata, so DI silently resolves params as undefined. The swc plugin here
// replaces esbuild's transform with swc's, configured to emit the same
// decorator metadata tsc would — this is the standard fix for "NestJS + Vitest".
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
  },
});
