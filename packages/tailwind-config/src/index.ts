export const pathSeekerTailwindPreset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        warm: "var(--shadow-warm)",
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Book Antiqua", "STSong", "serif"],
        sans: ["Segoe UI Variable", "SF Pro Text", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        mono: ["JetBrains Mono", "Cascadia Mono", "Consolas", "monospace"],
      },
      backgroundImage: {
        "museum-radial":
          "radial-gradient(circle at top, rgba(209, 178, 111, 0.18), transparent 32%)",
      },
    },
  },
} as const

export default pathSeekerTailwindPreset
