<script setup lang="ts">
import type { CulturalPlace } from '../types'
defineProps<{ kind: CulturalPlace['artwork']; accent: string; compact?: boolean }>()
</script>

<template>
  <div class="artwork" :class="{ compact }" :style="{ '--art-accent': accent }">
    <svg viewBox="0 0 440 220" fill="none" aria-hidden="true">
      <circle cx="348" cy="58" r="29" fill="currentColor" opacity=".14" />
      <path d="M0 178Q70 151 140 180T290 180T440 178V220H0Z" fill="currentColor" opacity=".09" />
      <g v-if="kind === 'bridge'" stroke="currentColor" stroke-linecap="round">
        <path d="M57 158H104Q220 43 337 158H384" stroke-width="12" />
        <path d="M90 176H146Q220 98 293 176H352M105 139V108M143 109V81M183 91V65M224 84V57M265 92V65M307 113V85M339 140V111" stroke-width="5" />
        <path d="M103 109Q223 3 341 112M30 195H146M179 199H244M280 190H404M194 184H224" stroke-width="3" />
        <path d="M36 0Q88 46 57 108M53 24Q106 47 100 89M50 49Q27 70 24 102" stroke-width="2" opacity=".5" />
      </g>
      <g v-else-if="kind === 'hutong'" stroke="currentColor" stroke-width="3">
        <path d="M12 96L105 57L183 96H12ZM28 98V186H170V98M257 80L336 47L428 80H257ZM272 82V186H418V82M68 186V124H125V186M315 186V109H372V186" fill="currentColor" fill-opacity=".08" />
        <path d="M0 207L196 152H240L440 207M197 152V101L218 87L240 101V152M70 109H125M315 94H372M99 125V186M344 110V186M30 170H67M125 170H168M274 170H314M373 170H418" />
        <path d="M177 64Q222 81 264 49M182 66V94M257 53V81" opacity=".5" /><rect x="170" y="92" width="23" height="30" rx="9" fill="currentColor" fill-opacity=".3" />
      </g>
      <g v-else-if="['temple', 'palace', 'garden'].includes(kind)" stroke="currentColor" stroke-width="3">
        <path d="M69 119Q125 110 145 78H295Q315 110 371 119H69Z" fill="currentColor" fill-opacity=".2" />
        <path d="M112 116V179H327V116M139 117V179M301 117V179M190 179V128H250V179M220 130V179M94 188H347M79 196H362M153 69H285M168 62H272M157 90H282M130 104H309" />
        <path d="M15 188V99M15 148Q57 112 63 58M20 131Q-8 82 2 45M381 187V107M381 153Q426 128 429 74" opacity=".55" />
        <circle cx="59" cy="58" r="22" fill="currentColor" fill-opacity=".12" stroke="none" /><circle cx="425" cy="72" r="32" fill="currentColor" fill-opacity=".12" stroke="none" />
        <rect x="197" y="97" width="45" height="16" rx="2" fill="currentColor" fill-opacity=".3" />
      </g>
      <g v-else-if="kind === 'bronze'" stroke="currentColor" stroke-width="4">
        <path d="M151 78H287L273 155Q220 182 164 155Z" fill="currentColor" fill-opacity=".2" /><path d="M160 79V47H183V79M254 79V47H277V79M173 162L164 195M220 172V200M268 162L278 195M174 110H264M181 123L197 143L217 123L237 143L255 123" />
      </g>
      <g v-else-if="kind === 'porcelain'" stroke="currentColor" stroke-width="3">
        <path d="M195 40H247L238 94Q306 153 263 190H178Q137 153 205 94Z" fill="currentColor" fill-opacity=".13" /><path d="M195 53H247M203 82H239M176 165Q209 119 267 153M188 151Q210 161 225 136M219 140Q210 110 192 122M227 147Q254 131 260 117M181 181H262" />
      </g>
      <g v-else stroke="currentColor" stroke-width="3">
        <path d="M55 48H384V193H55ZM47 42H392M47 199H392" /><path d="M66 174L140 85L202 158L252 68L373 173M119 153L152 119L187 165M235 110L264 92L315 158" fill="currentColor" fill-opacity=".1" /><path d="M76 180Q205 143 366 179M295 63V105M304 63V96M315 63V88" />
      </g>
    </svg>
    <span v-if="!compact" class="art-caption">{{ ['bronze', 'porcelain', 'painting'].includes(kind) ? '器物印象' : '后海印象' }} · 主题插画</span>
  </div>
</template>

<style scoped>
.artwork{position:relative;color:var(--art-accent);background:color-mix(in srgb,var(--art-accent) 10%,#f8faf9);overflow:hidden;border-radius:14px}
.artwork svg{display:block;width:100%;height:180px;object-fit:cover}.art-caption{position:absolute;bottom:10px;right:13px;font-size:9px;letter-spacing:2px;opacity:.65}.compact{border-radius:10px;width:62px;height:62px;flex-shrink:0}.compact svg{width:106px;height:66px;max-width:none;transform:translateX(-22px)}
</style>
