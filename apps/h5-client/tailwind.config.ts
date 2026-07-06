import type { Config } from "tailwindcss"
import pathSeekerTailwindPreset from "@path-seeker/tailwind-config"

export default {
  presets: [pathSeekerTailwindPreset as unknown as Partial<Config>],
  content: [
    "./index.html",
    "./src/**/*.{vue,ts}",
    "../../packages/ui/src/**/*.{vue,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
