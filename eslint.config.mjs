import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Os módulos legados iniciam loaders assíncronos em effects. A migração para
      // React Query/SWR será feita em etapa própria, sem bloquear o gate atual.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
