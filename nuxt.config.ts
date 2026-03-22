import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  
  // Nuxt 4 compatibility features
  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: false },

  nitro: {
    experimental: {
      openAPI: true
    }
  },

  app: {
    head: {
      title: 'Digital Twin - Room Planner',
      meta: [
        { name: 'description', content: 'Visual room planner for your home renovation' }
      ]
    }
  },

  compatibilityDate: '2024-04-03'
})
