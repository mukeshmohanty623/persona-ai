// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"

// https://astro.build/config
export default defineConfig({
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  vite: {
    server: {
      host: "0.0.0.0",
    },
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
