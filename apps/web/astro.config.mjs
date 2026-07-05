// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
    },
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
