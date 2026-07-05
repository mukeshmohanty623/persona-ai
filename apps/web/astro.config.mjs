// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import node from "@astrojs/node"

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  vite: {
    server: {
      host: "0.0.0.0",
    },
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
