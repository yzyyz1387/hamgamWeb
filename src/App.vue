<template>
  <AppShell></AppShell>
</template>

<script setup>
import AppShell from '@/components/AppShell.vue'
import { inject } from "@vercel/analytics"

inject()
</script>
