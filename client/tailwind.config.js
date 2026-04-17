/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-background": "#191c1e",
        "inverse-primary": "#68dbae",
        "inverse-surface": "#2d3133",
        "on-tertiary-container": "#fffbff",
        "secondary-fixed": "#dae2fd",
        "surface-dim": "#d8dadc",
        "primary": "#00694c",
        "on-surface": "#191c1e",
        "outline-variant": "#bccac1",
        "on-primary": "#ffffff",
        "on-tertiary": "#ffffff",
        "surface-variant": "#e0e3e5",
        "on-secondary-container": "#5c647a",
        "on-error-container": "#93000a",
        "primary-fixed": "#86f8c9",
        "on-secondary": "#ffffff",
        "tertiary": "#825100",
        "surface-container-lowest": "#ffffff",
        "surface-container": "#eceef0",
        "primary-container": "#008560",
        "on-tertiary-fixed": "#2a1700",
        "secondary-container": "#dae2fd",
        "secondary-fixed-dim": "#bec6e0",
        "on-error": "#ffffff",
        "surface-container-high": "#e6e8ea",
        "on-surface-variant": "#3d4943",
        "on-secondary-fixed": "#131b2e",
        "primary-fixed-dim": "#68dbae",
        "on-tertiary-fixed-variant": "#653e00",
        "outline": "#6d7a73",
        "error-container": "#ffdad6",
        "tertiary-container": "#a36700",
        "surface-tint": "#006c4e",
        "inverse-on-surface": "#eff1f3",
        "secondary": "#565e74",
        "on-primary-fixed-variant": "#00513a",
        "on-secondary-fixed-variant": "#3f465c",
        "tertiary-fixed-dim": "#ffb95f",
        "error": "#ba1a1a",
        "on-primary-container": "#f5fff7",
        "surface-container-highest": "#e0e3e5",
        "on-primary-fixed": "#002115",
        "tertiary-fixed": "#ffddb8",
        "background": "#f7f9fb",
        "surface": "#f7f9fb",
        "surface-bright": "#f7f9fb",
        "surface-container-low": "#f2f4f6"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["Inter"],
        "body": ["Inter"],
        "label": ["Inter"]
      },
      animation: {
          "fade-in-up": "fadeInUp 0.6s ease-out forwards",
          "shimmer": "shimmer 2s infinite linear",
          "breath": "breath 3s ease-in-out infinite",
          "badge-pulse": "badgePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
          "fadeInUp": {
              "0%": { opacity: "0", transform: "translateY(20px)" },
              "100%": { opacity: "1", transform: "translateY(0)" },
          },
          "shimmer": {
              "0%": { backgroundPosition: "-200% 0" },
              "100%": { backgroundPosition: "200% 0" },
          },
          "breath": {
              "0%, 100%": { opacity: "0.8" },
              "50%": { opacity: "1" },
          },
          "badgePulse": {
              "0%, 100%": { transform: "scale(1)", opacity: "1" },
              "50%": { transform: "scale(1.1)", opacity: "0.9" },
          }
      }
    },
  },
  plugins: [],
}
