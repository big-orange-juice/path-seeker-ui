<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const props = defineProps<{
  markdown: string;
  streaming?: boolean;
}>();

marked.setOptions({
  gfm: true,
  breaks: true
});

const html = computed(() => {
  const source = String(props.markdown || '');
  if (!source.trim()) {
    return '';
  }

  const raw = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true }
  });
});
</script>

<template>
  <div
    class="ask-md break-words"
    :class="{ 'is-streaming': streaming }"
    v-html="html" />
</template>

<style scoped>
.ask-md {
  font-size: inherit;
  line-height: inherit;
}

.ask-md.is-streaming::after {
  content: '';
  display: inline-block;
  width: 0.35em;
  margin-left: 0.08em;
  color: #e8c98a;
  animation: ask-md-caret 0.9s steps(1) infinite;
}

.ask-md :deep(:first-child) {
  margin-top: 0;
}

.ask-md :deep(:last-child) {
  margin-bottom: 0;
}

.ask-md :deep(p) {
  margin: 0.32em 0;
}

.ask-md :deep(h1),
.ask-md :deep(h2),
.ask-md :deep(h3),
.ask-md :deep(h4) {
  margin: 0.55em 0 0.22em;
  font-weight: 650;
  line-height: 1.35;
  color: #f7f0e4;
}

.ask-md :deep(h1) {
  font-size: 1.02rem;
}

.ask-md :deep(h2) {
  font-size: 0.96rem;
}

.ask-md :deep(h3),
.ask-md :deep(h4) {
  font-size: 0.9rem;
}

.ask-md :deep(ul),
.ask-md :deep(ol) {
  margin: 0.32em 0;
  padding-left: 1.1rem;
}

.ask-md :deep(ul) {
  list-style: disc;
}

.ask-md :deep(ol) {
  list-style: decimal;
}

.ask-md :deep(li) {
  margin: 0.1em 0;
}

.ask-md :deep(li::marker) {
  color: rgba(209, 178, 111, 0.7);
}

.ask-md :deep(blockquote) {
  margin: 0.4em 0;
  border-left: 2px solid rgba(209, 178, 111, 0.4);
  padding-left: 0.65rem;
  color: rgba(242, 235, 224, 0.72);
}

.ask-md :deep(a) {
  color: #e8c98a;
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.ask-md :deep(code) {
  border-radius: 0.3rem;
  background: rgba(209, 178, 111, 0.12);
  padding: 0.08em 0.32em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.84em;
  color: #f0e2bc;
}

.ask-md :deep(pre) {
  margin: 0.45em 0;
  overflow-x: auto;
  border-radius: 0.55rem;
  border: 1px solid rgba(209, 178, 111, 0.12);
  background: rgba(8, 9, 11, 0.55);
  padding: 0.55rem 0.65rem;
}

.ask-md :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  white-space: pre;
}

.ask-md :deep(hr) {
  margin: 0.55em 0;
  border: 0;
  border-top: 1px solid rgba(209, 178, 111, 0.16);
}

.ask-md :deep(strong) {
  font-weight: 650;
  color: #f4e7c4;
}

.ask-md :deep(table) {
  width: 100%;
  margin: 0.4em 0;
  border-collapse: collapse;
  font-size: 0.86em;
}

.ask-md :deep(th),
.ask-md :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.28rem 0.4rem;
  text-align: left;
}

.ask-md :deep(th) {
  background: rgba(209, 178, 111, 0.08);
  font-weight: 600;
}

@keyframes ask-md-caret {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ask-md.is-streaming::after {
    animation: none;
    opacity: 0.7;
  }
}
</style>
