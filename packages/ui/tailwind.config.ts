import type { Config } from "tailwindcss"
import pathSeekerTailwindPreset from "@path-seeker/tailwind-config"

export default {
  presets: [pathSeekerTailwindPreset as Partial<Config>],
  content: ["./src/**/*.{vue,ts}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
