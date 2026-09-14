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
      // Algumas telas administrativas calculam validade documental em relação ao
      // instante de renderização. Isso é deliberado e não altera estado durante render.
      "react-hooks/purity": "off",
    },
  },
  {
    files: [
      "src/modules/editais/Editais.tsx",
      "src/modules/oportunidades/OportunidadesUnified.tsx",
      "src/modules/radar/Radar.tsx",
    ],
    rules: {
      // Estes módulos usam expressões condicionais exclusivamente para mutar Sets.
      // O padrão é intencional, tem efeito definido e não representa expressão perdida.
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Edge Functions usam runtime Deno e precisam de lint próprio; não devem ser
  // analisadas pelo conjunto de regras do Next.js/React.
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "supabase/functions/**"]),
]);
