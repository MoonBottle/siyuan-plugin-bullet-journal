<template>
  <div class="ios-settings-content">
    <div class="ios-group-header">
      <div class="header-icon">⌨️</div>
      <div class="header-info">
        <div class="header-title">{{ t('settings').slashCommands.title }}</div>
        <div class="header-desc">{{ t('settings').slashCommands.description }}</div>
      </div>
    </div>

    <div class="ios-group">
      <div class="ios-cell-header">{{ t('settings').slashCommands.builtinCommands }}</div>
      <div class="ios-card">
        <div v-for="(cmd, index) in builtinCommands.slice(0, 6)" :key="index" class="ios-cell ios-cell-cmd">
          <div class="cmd-tags">
            <span v-for="(c, i) in cmd.commands.slice(0, 2)" :key="i" class="cmd-tag">{{ c }}</span>
          </div>
          <div class="cmd-desc">{{ cmd.description }}</div>
        </div>
      </div>
      <div class="cell-footer">{{ t('settings').slashCommands.builtinHint?.replace('{count}', String(builtinCommands.length)) || `共 ${builtinCommands.length} 个内置命令` }}</div>
    </div>

    <div class="ios-group">
      <div class="ios-cell-header">
        {{ t('settings').slashCommands.customCommands }}
        <span class="header-count">({{ modelValue.length }})</span>
      </div>
      <div v-if="modelValue.length === 0" class="ios-empty">
        {{ t('settings').slashCommands.emptyMessage }}
      </div>
      <div v-else class="ios-card">
        <div v-for="cmd in modelValue" :key="cmd.id" class="ios-cell ios-cell-custom">
          <div class="custom-info">
            <div class="custom-name">{{ cmd.name }}</div>
            <div class="custom-commands">
              <span v-for="c in cmd.commands" :key="c" class="custom-cmd">{{ c }}</span>
            </div>
            <div class="custom-action">{{ getActionLabel(cmd.action) }}</div>
          </div>
          <div class="custom-actions">
            <button class="action-btn edit" @click="editCommand(cmd)">
              <svg><use xlink:href="#iconEdit"></use></svg>
            </button>
            <button class="action-btn delete" @click="deleteCommand(cmd.id)">
              <svg><use xlink:href="#iconTrashcan"></use></svg>
            </button>
          </div>
        </div>
      </div>
      <button class="ios-add-btn" @click="showAddDialog">
        <span class="add-icon">+</span>
        {{ t('settings').slashCommands.addButton }}
      </button>
    </div>

    <!-- Dialog -->
    <Transition name="fade">
      <div v-if="dialogVisible" class="ios-dialog-overlay" @click="closeDialog">
        <div class="ios-dialog" @click.stop>
          <div class="dialog-header">
            <button class="cancel-btn" @click="closeDialog">{{ t('common').cancel }}</button>
            <span class="dialog-title">{{ isEditing ? t('settings').slashCommands.dialogTitleEdit : t('settings').slashCommands.dialogTitleAdd }}</span>
            <button class="save-btn" @click="saveCommand">{{ t('common').save }}</button>
          </div>
          <div class="dialog-content">
            <div class="form-group">
              <label>{{ t('settings').slashCommands.nameLabel }}</label>
              <input v-model="form.name" type="text" class="ios-input" :placeholder="t('settings').slashCommands.namePlaceholder" />
            </div>
            <div class="form-group">
              <label>{{ t('settings').slashCommands.commandsLabel }}</label>
              <input v-model="commandsInput" type="text" class="ios-input" :placeholder="t('settings').slashCommands.commandsPlaceholder" />
              <div class="input-hint">{{ t('settings').slashCommands.commandsHint }}</div>
            </div>
            <div class="form-group">
              <label>{{ t('settings').slashCommands.actionLabel }}</label>
              <select v-model="form.action" class="ios-select">
                <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { CustomSlashCommand } from '@/settings/types';
import { SLASH_COMMAND_FILTERS } from '@/constants';
import { t } from '@/i18n';
import { computed, reactive, ref } from 'vue';

const props = defineProps<{
  modelValue: CustomSlashCommand[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: CustomSlashCommand[]];
}>();

const builtinCommands = computed(() => [
  { commands: SLASH_COMMAND_FILTERS.TODAY, description: t('slash').markAsTodayItem },
  { commands: SLASH_COMMAND_FILTERS.TOMORROW, description: t('slash').markAsTomorrowItem },
  { commands: SLASH_COMMAND_FILTERS.DATE, description: t('slash').markAsDateItem },
  { commands: SLASH_COMMAND_FILTERS.DONE, description: t('slash').markAsDone },
  { commands: SLASH_COMMAND_FILTERS.ABANDON, description: t('slash').markAsAbandoned },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR, description: t('slash').openCalendar },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_DAY, description: t('slash').openCalendarDay },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_WEEK, description: t('slash').openCalendarWeek },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_MONTH, description: t('slash').openCalendarMonth },
  { commands: SLASH_COMMAND_FILTERS.CALENDAR_LIST, description: t('slash').openCalendarList },
  { commands: SLASH_COMMAND_FILTERS.GANTT, description: t('slash').openGantt },
  { commands: SLASH_COMMAND_FILTERS.FOCUS, description: t('slash').startFocus },
  { commands: SLASH_COMMAND_FILTERS.TODO, description: t('slash').openTodoDock },
  { commands: SLASH_COMMAND_FILTERS.SET_PROJECT_DIR, description: t('slash').setAsProjectDir },
  { commands: SLASH_COMMAND_FILTERS.MARK_AS_TASK, description: t('slash').markAsTask },
  { commands: SLASH_COMMAND_FILTERS.VIEW_DETAIL, description: t('slash').viewDetail },
]);

const actionOptions = computed(() => [
  { value: 'today', label: t('settings').slashCommands.actions.today },
  { value: 'tomorrow', label: t('settings').slashCommands.actions.tomorrow },
  { value: 'date', label: t('settings').slashCommands.actions.date },
  { value: 'done', label: t('settings').slashCommands.actions.done },
  { value: 'abandon', label: t('settings').slashCommands.actions.abandon },
  { value: 'calendar', label: t('settings').slashCommands.actions.calendar },
  { value: 'calendarDay', label: t('settings').slashCommands.actions.calendarDay },
  { value: 'calendarWeek', label: t('settings').slashCommands.actions.calendarWeek },
  { value: 'calendarMonth', label: t('settings').slashCommands.actions.calendarMonth },
  { value: 'calendarList', label: t('settings').slashCommands.actions.calendarList },
  { value: 'gantt', label: t('settings').slashCommands.actions.gantt },
  { value: 'focus', label: t('settings').slashCommands.actions.focus },
  { value: 'todo', label: t('settings').slashCommands.actions.todo },
  { value: 'setProjectDir', label: t('settings').slashCommands.actions.setProjectDir },
  { value: 'markAsTask', label: t('settings').slashCommands.actions.markAsTask },
  { value: 'viewDetail', label: t('settings').slashCommands.actions.viewDetail },
]);

function getActionLabel(action: string): string {
  const option = actionOptions.value.find(opt => opt.value === action);
  return option?.label || action;
}

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

  if (commands.length === 0) return;

  const newCommand: CustomSlashCommand = {
    id: isEditing.value ? editingId.value : Date.now().toString(),
    name: form.name || commands[0],
    commands,
    action: form.action,
  };

  const newValue = [...props.modelValue];
  if (isEditing.value) {
    const index = newValue.findIndex(c => c.id === editingId.value);
    if (index !== -1) newValue[index] = newCommand;
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

<style lang="scss" scoped>
.ios-settings-content {
  padding: 0 16px 32px;
}

.ios-group-header {
  display: flex;
  gap: 12px;
  padding: 16px 0 20px;
  .header-icon { font-size: 36px; }
  .header-info { flex: 1; }
  .header-title { font-size: 20px; font-weight: 600; color: #000; margin-bottom: 4px; }
  .header-desc { font-size: 14px; color: #6c6c70; line-height: 1.4; }
}

.ios-group { margin-bottom: 20px; }

.ios-cell-header {
  font-size: 13px;
  font-weight: 500;
  color: #6c6c70;
  text-transform: uppercase;
  margin: 0 16px 8px;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 4px;
  .header-count { font-weight: 400; color: #8e8e93; }
}

.ios-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.ios-empty {
  padding: 32px 16px;
  text-align: center;
  color: #8e8e93;
  font-size: 15px;
}

.ios-cell {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  min-height: 44px;
  & + .ios-cell { border-top: 0.5px solid #e5e5ea; }
  &:active { background: #f2f2f7; }
}

.ios-cell-cmd {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  .cmd-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .cmd-tag { padding: 2px 8px; background: #f2f2f7; border-radius: 4px; font-family: monospace; font-size: 13px; color: #007aff; }
  .cmd-desc { font-size: 13px; color: #6c6c70; }
}

.cell-footer {
  font-size: 13px;
  color: #6c6c70;
  padding: 8px 16px 12px;
  line-height: 1.4;
}

.ios-cell-custom {
  align-items: flex-start;
  gap: 12px;
  .custom-info { flex: 1; min-width: 0; }
  .custom-name { font-size: 16px; font-weight: 500; color: #000; margin-bottom: 4px; }
  .custom-commands { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
  .custom-cmd { padding: 2px 8px; background: #f2f2f7; border-radius: 4px; font-family: monospace; font-size: 12px; color: #007aff; }
  .custom-action { font-size: 13px; color: #6c6c70; }
  .custom-actions { display: flex; gap: 8px; }
  .action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    &.edit { background: #f2f2f7; svg { width: 16px; height: 16px; fill: #007aff; } }
    &.delete { background: #ff3b30; svg { width: 16px; height: 16px; fill: #fff; } }
  }
}

.ios-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: 1px dashed #c5c5c7;
  border-radius: 10px;
  background: transparent;
  color: #007aff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  &:active { background: #f2f2f7; }
}

.ios-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.ios-dialog {
  background: #f2f2f7;
  border-radius: 20px 20px 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 0.5px solid #e5e5ea;
  border-radius: 20px 20px 0 0;
  .cancel-btn, .save-btn {
    padding: 8px;
    border: none;
    background: transparent;
    font-size: 17px;
    cursor: pointer;
  }
  .cancel-btn { color: #8e8e93; }
  .save-btn { color: #007aff; font-weight: 500; }
  .dialog-title { font-size: 17px; font-weight: 600; }
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #6c6c70;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
}

.ios-input, .ios-select {
  width: 100%;
  padding: 12px;
  border: 1px solid #e5e5ea;
  border-radius: 10px;
  font-size: 16px;
  background: #fff;
  &:focus { outline: none; border-color: #007aff; }
}

.input-hint { font-size: 13px; color: #6c6c70; margin-top: 6px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
