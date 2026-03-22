import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss"],

  devtools: { enabled: false },

  app: {
    head: {
      title: "Digital Twin - Room Planner",
      meta: [{ name: "description", content: "Visual room planner for your home renovation" }],
    },
  },

  compatibilityDate: "2026-03-22",
});
