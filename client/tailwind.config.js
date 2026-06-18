/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        pitch: "#1a472a",
        "pitch-light": "#2d6a4f",
        "npl-green": "#00ff41",
        "npl-gold": "#ffd700",
        "npl-red": "#ff3333",
        "npl-blue": "#0066cc",
        "dark-bg": "#0a0a0f",
        "dark-panel": "#12121a",
        "dark-border": "#2a2a3a",
        "dark-hover": "#1e1e2e",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "ticker": "ticker 20s linear infinite",
        "blink": "blink 1s step-end infinite",
        "goal-flash": "goalFlash 0.5s ease-out",
      },
      keyframes: {
        slideUp: { from: { transform: "translateY(10px)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } },
        ticker: { from: { transform: "translateX(100%)" }, to: { transform: "translateX(-100%)" } },
        blink: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
        goalFlash: { "0%": { backgroundColor: "#ffd700" }, "100%": { backgroundColor: "transparent" } },
      },
    },
  },
  plugins: [],
};
