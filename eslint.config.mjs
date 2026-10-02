import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-verify/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  // Flat config only lints .js/.mjs/.cjs by default: .jsx must be listed explicitly
  { files: ["**/*.{js,jsx,mjs,cjs}"] },
  ...compat.extends("next/core-web-vitals"),
  {
    // Catch missing imports (e.g. a helper used but never imported)
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
    },
  },
  {
    // Accessibility: jsx-a11y's strict set (next/core-web-vitals only enables a few rules).
    // The plugin itself is already registered by the Next.js config above.
    files: ["**/*.{js,jsx}"],
    rules: jsxA11y.flatConfigs.strict.rules,
  },
  {
    files: ["**/*.test.{js,jsx}", "tests/**/*.{js,mjs}", "scripts/**/*.mjs"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
