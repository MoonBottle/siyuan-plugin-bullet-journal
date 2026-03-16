<template>
  <SySettingsSection icon="iconSlash" :title="t('settings').slashCommands.title" :description="t('settings').slashCommands.description">
    <div class="slash-command-section">
      <!-- 内置命令列表 -->
      <div class="builtin-commands">
        <div class="subsection-title">{{ t('settings').slashCommands.builtinCommands }}</div>
        <div class="builtin-list">
          <div v-for="(cmd, key) in builtinCommands" :key="key" class="builtin-item">
            <code class="command-code">{{ cmd.commands.join(', ') }}</code>
            <span class="command-desc">- {{ cmd.description }}</span>
          </div>
        </div>
      </div>

      <!-- 自定义命令列表 -->
      <div class="custom-commands">
        <div class="subsection-title">{{ t('settings').slashCommands.customCommands }}</div>
        <div v-if="modelValue.length === 0" class="empty-message">
          {{ t('settings').slashCommands.emptyMessage }}
        </div>
        <div v-else class="custom-list">
          <div v-for="cmd in modelValue" :key="cmd.id" class="custom-item">
            <div class="custom-item-header">
              <span class="custom-item-name">{{ cmd.name }}</span>
              <div class="custom-item-actions">
                <button class="b3-button b3-button--text" @click="editCommand(cmd)">
                  {{ t('settings').slashCommands.editButton }}
                </button>
                <button class="b3-button b3-button--text" @click="deleteCommand(cmd.id)">
                  {{ t('settings').slashCommands.deleteButton }}
                </button>
              </div>
            </div>
            <div class="custom-item-detail">
              <code class="command-code">{{ cmd.commands.join(', ') }}</code>
            </div>
            <div class="custom-item-action">
              {{ t('settings').slashCommands.actionLabel }}: {{ getActionLabel(cmd.action) }}
            </div>
          </div>
        </div>
        <button class="b3-button b3-button--outline" @click="showAddDialog">
          <svg class="b3-button__icon"><use xlink:href="#iconAdd"></use></svg>
          {{ t('settings').slashCommands.addButton }}
        </button>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <div v-if="dialogVisible" class="b3-dialog">
      <div class="b3-dialog__scrim" @click="closeDialog"></div>
      <div class="b3-dialog__container">
        <div class="b3-dialog__header">
          <div class="b3-dialog__title">{{ isEditing ? t('settings').slashCommands.dialogTitleEdit : t('settings').slashCommands.dialogTitleAdd }}</div>
          <button class="b3-dialog__close" @click="closeDialog">
            <svg><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="b3-dialog__content">
          <div class="form-item">
            <label class="form-label">{{ t('settings').slashCommands.nameLabel }}</label>
            <input
              v-model="form.name"
              type="text"
              class="b3-text-field"
              :placeholder="t('settings').slashCommands.namePlaceholder"
            />
          </div>
          <div class="form-item">
            <label class="form-label">{{ t('settings').slashCommands.commandsLabel }}</label>
            <input
              v-model="commandsInput"
              type="text"
              class="b3-text-field"
              :placeholder="t('settings').slashCommands.commandsPlaceholder"
            />
            <div class="form-hint">{{ t('settings').slashCommands.commandsHint }}</div>
          </div>
          <div class="form-item">
            <label class="form-label">{{ t('settings').slashCommands.actionLabel }}</label>
            <SySelect
              v-model="form.action"
              :options="actionOptions"
            />
          </div>
        </div>
        <div class="b3-dialog__action">
          <button class="b3-button b3-button--cancel" @click="closeDialog">
            {{ t('settings').slashCommands.cancelButton }}
          </button>
          <button class="b3-button b3-button--text" @click="saveCommand">
            {{ t('settings').slashCommands.saveButton }}
          </button>
        </div>
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import type { CustomSlashCommand } from '@/settings/types';
import { t } from '@/i18n';
import { SLASH_COMMAND_FILTERS } from '@/constants';
import SySettingsSection from './SySettingsSection.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

const props = defineProps<{
  modelValue: CustomSlashCommand[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: CustomSlashCommand[]];
}>();

// 内置命令列表
const builtinCommands = computed(() => [
  { commands: SLASH_COMMAND_FILTERS.TODAY, description: t('slash').markAsTodayItem },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR, description: t('slash').openCalendar },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_DAY, description: t('slash').openCalendarDay },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_WEEK, description: t('slash').openCalendarWeek },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_MONTH, description: t('slash').openCalendarMonth },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_LIST, description: t('slash').openCalendarList },
  { commands: SLASH_COMMAND_FILTERS.GANTT, description: t('slash').openGantt },
  { commands: SLASH_COMMAND_FILTERS.FOCUS, description: t('slash').startFocus },
  { commands: SLASH_COMMAND_FILTERS.TODO, description: t('slash').openTodoDock },
]);

// 动作选项
const actionOptions = computed(() => [
  { value: 'today', label: t('settings').slashCommands.actions.today },
  { value: 'calendar', label: t('settings').slashCommands.actions.calendar },
  { value: 'calendarDay', label: t('settings').slashCommands.actions.calendarDay },
  { value: 'calendarWeek', label: t('settings').slashCommands.actions.calendarWeek },
  { value: 'calendarMonth', label: t('settings').slashCommands.actions.calendarMonth },
  { value: 'calendarList', label: t('settings').slashCommands.actions.calendarList },
  { value: 'gantt', label: t('settings').slashCommands.actions.gantt },
  { value: 'focus', label: t('settings').slashCommands.actions.focus },
  { value: 'todo', label: t('settings').slashCommands.actions.todo },
]);

function getActionLabel(action: string): string {
  const option = actionOptions.value.find(opt => opt.value === action);
  return option?.label || action;
}

// 对话框状态
const dialogVisible = ref(false);
const isEditing = ref(false);
const editingId = ref<string>('');
const commandsInput = ref('');

const form = reactive({
  name: '',
  action: 'today' as CustomSlashCommand['action'],
});

function showAddDialog() {
  isEditing.value = false;
  editingId.value = '';
  form.name = '';
  form.action = 'today';
  commandsInput.value = '';
  dialogVisible.value = true;
}

function editCommand(cmd: CustomSlashCommand) {
  isEditing.value = true;
  editingId.value = cmd.id;
  form.name = cmd.name;
  form.action = cmd.action;
  commandsInput.value = cmd.commands.join(', ');
  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
}

function saveCommand() {
  const commands = commandsInput.value
    .split(/[,，]/)
    .map(c => c.trim())
    .filter(c => c.startsWith('/'));

  if (commands.length === 0) {
    return;
  }

  const newCommand: CustomSlashCommand = {
    id: isEditing.value ? editingId.value : Date.now().toString(),
    name: form.name || commands[0],
    commands,
    action: form.action,
  };

  const newValue = [...props.modelValue];
  if (isEditing.value) {
    const index = newValue.findIndex(c => c.id === editingId.value);
    if (index !== -1) {
      newValue[index] = newCommand;
    }
  } else {
    newValue.push(newCommand);
  }

  emit('update:modelValue', newValue);
  closeDialog();
}

function deleteCommand(id: string) {
  const newValue = props.modelValue.filter(c => c.id !== id);
  emit('update:modelValue', newValue);
}
</script>

<style scoped>
.slash-command-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.subsection-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  margin-bottom: 12px;
}

.builtin-list {
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 12px;
}

.builtin-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.builtin-item:not(:last-child) {
  border-bottom: 1px solid var(--b3-border-color);
}

.command-code {
  font-family: monospace;
  background: var(--b3-theme-background);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-primary);
}

.command-desc {
  color: var(--b3-theme-on-surface);
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.custom-item {
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 12px;
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.custom-item-name {
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.custom-item-actions {
  display: flex;
  gap: 8px;
}

.custom-item-detail {
  margin-bottom: 4px;
}

.custom-item-action {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.empty-message {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 16px;
  text-align: center;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  margin-bottom: 16px;
}

.form-item {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 8px;
}

.form-hint {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  margin-top: 4px;
}

.b3-dialog__container {
  width: 400px;
}

.b3-button__icon {
  width: 12px;
  height: 12px;
  margin-right: 4px;
}
</style>
