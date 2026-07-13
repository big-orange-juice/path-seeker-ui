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
    extend: {
      fontFamily: {
        display: ['"Noto Serif SC"', "STSong", "serif"],
        sans: ['"Noto Sans SC"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config
