import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-light": "var(--primary-light)",
        "primary-dark": "var(--primary-dark)",
        accent: "var(--accent)",
        "accent-light": "var(--accent-light)",
        green: "var(--green)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      backgroundColor: {
        primary: "var(--bg-primary)",
        secondary: "var(--bg-secondary)",
        card: "var(--bg-card)",
      },
      textColor: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "glow-blue": "var(--shadow-glow-blue)",
        "glow-orange": "var(--shadow-glow-orange)",
      },
      transitionDuration: {
        fast: "var(--ease-fast)",
        normal: "var(--ease-normal)",
        slow: "var(--ease-slow)",
      },
    },
  },
  plugins: [],
};

export default config;
