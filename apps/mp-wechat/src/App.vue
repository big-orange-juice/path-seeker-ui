<script setup lang="ts">
import { onHide, onLaunch, onShow } from "@dcloudio/uni-app"

onLaunch(() => {
  console.log("Path Seeker mini app launch")
})

onShow(() => {
  console.log("Path Seeker mini app show")
})

onHide(() => {
  console.log("Path Seeker mini app hide")
})
</script>

<style lang="scss">
@use "@/styles/theme.scss";
</style>
