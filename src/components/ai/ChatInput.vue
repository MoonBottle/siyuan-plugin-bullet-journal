<template>
  <div class="chat-input">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      class="chat-input__textarea"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="1"
      @keydown="handleKeydown"
      @input="handleInput"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  send: [content: string];
}>();

const textareaRef = ref<HTMLTextAreaElement>();

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('send', props.modelValue?.trim() || '');
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);

  // 自动调整高度
  nextTick(() => {
    const textarea = textareaRef.value;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  });
}

function focus() {
  textareaRef.value?.focus();
}

defineExpose({
  focus
});
</script>

<style lang="scss" scoped>
.chat-input {
  width: 100%;

  &__textarea {
    width: 100%;
    border: none;
    background: transparent;
    resize: none;
    outline: none;
    font-size: 14px;
    line-height: 1.6;
    color: var(--b3-theme-on-background);
    min-height: 24px;
    max-height: 120px;
    font-family: inherit;
    padding: 0;

    &::placeholder {
      color: var(--b3-theme-on-surface-light);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
