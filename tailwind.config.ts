import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#121212",
        surface: "#1C1C1B",
        surface2: "#2A2A27",
        line: "#3A3935",
        text: "#F4F1EA",
        muted: "#948F84",
        cream: "#EFECE3",
        lime: "#E6EB5E",
        orange: "#FF8A3D",
        olive: "#8A8C45",
        sand: "#E3CDBE",
        sky: "#6FA8DC",
        pink: "#F2A7C3",
        teal: "#5CC8B0",
        brown: "#B8794F",
        violet: "#B388FF",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
