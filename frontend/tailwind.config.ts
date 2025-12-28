import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx,css}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        "theme-primary": "hsl(var(--theme-primary))",
        "theme-background": "hsl(var(--theme-background))",
        "theme-foreground": "hsl(var(--theme-foreground))",
        "theme-muted": "hsl(var(--theme-muted))",
        "theme-muted-foreground": "hsl(var(--theme-muted-foreground))",
        "theme-card": "hsl(var(--theme-card))",
        "theme-card-foreground": "hsl(var(--theme-card-foreground))",
        "theme-popover": "hsl(var(--theme-popover))",
        "theme-popover-foreground": "hsl(var(--theme-popover-foreground))",
        "theme-border": "hsl(var(--theme-border))",
        "theme-input": "hsl(var(--theme-input))",
        "theme-ring": "hsl(var(--theme-ring))",
        "theme-destructive": "hsl(var(--theme-destructive))",
        "theme-destructive-foreground": "hsl(var(--theme-destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['EB Garamond', 'serif'],
        mono: ['"Latin Modern Mono"', '"Computer Modern Typewriter"', 'monospace'],
        'source-sans-pro': ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
