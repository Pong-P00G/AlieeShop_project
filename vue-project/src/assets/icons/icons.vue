<script setup>
    import * as icons from 'lucide-vue-next'
    const props = defineProps({ name: String })
    const IconComponent = icons[props.name] || icons.HelpCircle
</script>

<template>
    <component :is="IconComponent" class="w-5 h-5" />
</template>