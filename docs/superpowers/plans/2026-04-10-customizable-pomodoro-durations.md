# 番茄钟专注/休息时长自定义实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许用户在设置中自定义番茄钟的专注时长预设、休息时长预设，以及各自的默认时长。

**Architecture:** 在 `PomodoroSettings` 类型中新增 4 个可选配置字段，设置页面使用数字输入框（预设）和下拉选择（默认值）的组合，专注弹窗和休息弹窗读取配置替代硬编码值。

**Tech Stack:** Vue 3 + TypeScript + Pinia, 使用现有 SySelect/SyInput 组件

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/settings/types.ts` | 修改 | 新增 4 个配置字段，更新默认值常量 |
| `src/i18n/zh_CN.json` | 修改 | 新增 8 个中文翻译键 |
| `src/i18n/en_US.json` | 修改 | 新增 8 个英文翻译键 |
| `src/components/settings/PomodoroConfigSection.vue` | 修改 | 新增配置UI（预设输入框 + 默认下拉选择） |
| `src/components/pomodoro/PomodoroTimerDialog.vue` | 修改 | 读取自定义专注预设和默认值 |
| `src/components/pomodoro/PomodoroCompleteDialog.vue` | 修改 | 读取自定义休息预设和默认值 |

---

## Task 1: 新增配置类型定义

**Files:**
- Modify: `src/settings/types.ts:17-29` (PomodoroSettings 接口)
- Modify: `src/settings/types.ts:67-79` (defaultPomodoroSettings 常量)

- [ ] **Step 1: 在 PomodoroSettings 接口新增字段**

```typescript
// src/settings/types.ts
// 在现有字段后添加：

// 专注时长预设（4个），默认 [15, 25, 45, 60]
focusDurationPresets?: number[];

// 默认专注时长，必须在 presets 中，默认 25
defaultFocusDuration?: number;

// 休息时长预设（3个），默认 [5, 10, 15]
breakDurationPresets?: number[];

// 默认休息时长，必须在 presets 中，默认 5
defaultBreakDuration?: number;
```

- [ ] **Step 2: 在 defaultPomodoroSettings 添加默认值**

```typescript
export const defaultPomodoroSettings: PomodoroSettings = {
  enableStatusBar: false,
  enableStatusBarTimer: false,
  enableFloatingButton: true,
  recordMode: 'block',
  attrPrefix: 'custom-pomodoro',
  autoCompleteOnItemDone: true,
  minFocusMinutes: 5,
  autoExtendEnabled: false,
  autoExtendWaitSeconds: 30,
  autoExtendMinutes: 5,
  autoExtendMaxCount: 3,
  // 新增字段（默认值，不写入配置时兜底使用）
  focusDurationPresets: [15, 25, 45, 60],
  defaultFocusDuration: 25,
  breakDurationPresets: [5, 10, 15],
  defaultBreakDuration: 5,
};
```

- [ ] **Step 3: 验证类型定义**

运行: `npm run build`
Expected: 构建成功，无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/settings/types.ts
git commit -m "feat(pomodoro): add customizable duration settings types"
```

---

## Task 2: 添加国际化翻译

**Files:**
- Modify: `src/i18n/zh_CN.json` (settings.pomodoro 对象)
- Modify: `src/i18n/en_US.json` (settings.pomodoro 对象)

- [ ] **Step 1: 在 zh_CN.json 添加中文翻译**

在 `settings.pomodoro` 对象中，现有字段后添加：

```json
"focusDurationPresets": "专注时长预设",
"focusDurationPresetsDesc": "快速选择按钮的时长选项（分钟）",
"defaultFocusDuration": "默认专注时长",
"defaultFocusDurationDesc": "打开专注弹窗时默认选中的时长",
"breakDurationPresets": "休息时长预设",
"breakDurationPresetsDesc": "完成专注后休息的时长选项（分钟）",
"defaultBreakDuration": "默认休息时长",
"defaultBreakDurationDesc": "休息弹窗默认选中的时长"
```

- [ ] **Step 2: 在 en_US.json 添加英文翻译**

在 `settings.pomodoro` 对象中，现有字段后添加：

```json
"focusDurationPresets": "Focus Duration Presets",
"focusDurationPresetsDesc": "Quick select button duration options (minutes)",
"defaultFocusDuration": "Default Focus Duration",
"defaultFocusDurationDesc": "Default selected duration when opening focus dialog",
"breakDurationPresets": "Break Duration Presets",
"breakDurationPresetsDesc": "Break duration options after focus completes (minutes)",
"defaultBreakDuration": "Default Break Duration",
"defaultBreakDurationDesc": "Default selected duration in break dialog"
```

- [ ] **Step 3: 验证 JSON 格式**

运行: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/zh_CN.json'))" && echo "zh_CN valid"`
运行: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/en_US.json'))" && echo "en_US valid"`
Expected: 两行都输出 valid

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(i18n): add pomodoro duration customization translations"
```

---

## Task 3: 实现设置页面 UI

**Files:**
- Modify: `src/components/settings/PomodoroConfigSection.vue` (template 和 script)

- [ ] **Step 1: 在 template 中新增配置项**

在现有 `<SySettingItemList>` 内，最后一个 `</template>` 标签前添加：

```vue
<!-- 专注时长预设 -->
<SySettingItem
  :label="t('settings').pomodoro.focusDurationPresets"
  :description="t('settings').pomodoro.focusDurationPresetsDesc"
>
  <div class="duration-presets-inputs">
    <input
      v-for="(duration, index) in focusPresets"
      :key="index"
      v-model.number="focusPresets[index]"
      type="number"
      class="b3-text-field fn__flex-center"
      style="width: 60px; text-align: center;"
      min="1"
      max="180"
      @change="validateFocusPreset(index)"
    />
    <span class="unit-label">{{ t('common').minutes }}</span>
  </div>
</SySettingItem>

<!-- 默认专注时长 -->
<SySettingItem
  :label="t('settings').pomodoro.defaultFocusDuration"
  :description="t('settings').pomodoro.defaultFocusDurationDesc"
>
  <SySelect
    :model-value="pomodoro.defaultFocusDuration ?? 25"
    :options="focusDurationOptions"
    @update:model-value="pomodoro.defaultFocusDuration = $event"
  />
</SySettingItem>

<!-- 休息时长预设 -->
<SySettingItem
  :label="t('settings').pomodoro.breakDurationPresets"
  :description="t('settings').pomodoro.breakDurationPresetsDesc"
>
  <div class="duration-presets-inputs">
    <input
      v-for="(duration, index) in breakPresets"
      :key="index"
      v-model.number="breakPresets[index]"
      type="number"
      class="b3-text-field fn__flex-center"
      style="width: 60px; text-align: center;"
      min="1"
      max="60"
      @change="validateBreakPreset(index)"
    />
    <span class="unit-label">{{ t('common').minutes }}</span>
  </div>
</SySettingItem>

<!-- 默认休息时长 -->
<SySettingItem
  :label="t('settings').pomodoro.defaultBreakDuration"
  :description="t('settings').pomodoro.defaultBreakDurationDesc"
>
  <SySelect
    :model-value="pomodoro.defaultBreakDuration ?? 5"
    :options="breakDurationOptions"
    @update:model-value="pomodoro.defaultBreakDuration = $event"
  />
</SySettingItem>
```

- [ ] **Step 2: 在 script 中添加逻辑**

在 `<script setup>` 中，现有的 `recordModeOptions` 后添加：

```typescript
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  pomodoro: PomodoroSettings;
}>();

// 专注时长预设本地状态（4个）
const focusPresets = ref<number[]>([15, 25, 45, 60]);

// 休息时长预设本地状态（3个）
const breakPresets = ref<number[]>([5, 10, 15]);

// 从 props 初始化预设值
const initPresets = () => {
  if (props.pomodoro.focusDurationPresets?.length === 4) {
    focusPresets.value = [...props.pomodoro.focusDurationPresets];
  }
  if (props.pomodoro.breakDurationPresets?.length === 3) {
    breakPresets.value = [...props.pomodoro.breakDurationPresets];
  }
};
initPresets();

// 监听预设变化，同步到 pomodoro 配置
watch(focusPresets, (newVal) => {
  props.pomodoro.focusDurationPresets = [...newVal];
}, { deep: true });

watch(breakPresets, (newVal) => {
  props.pomodoro.breakDurationPresets = [...newVal];
}, { deep: true });

// 验证专注预设输入
const validateFocusPreset = (index: number) => {
  let value = focusPresets.value[index];
  if (value < 1) value = 1;
  if (value > 180) value = 180;
  focusPresets.value[index] = value;
};

// 验证休息预设输入
const validateBreakPreset = (index: number) => {
  let value = breakPresets.value[index];
  if (value < 1) value = 1;
  if (value > 60) value = 60;
  breakPresets.value[index] = value;
};

// 专注时长下拉选项（从 presets 动态生成）
const focusDurationOptions = computed(() => {
  return focusPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});

// 休息时长下拉选项（从 presets 动态生成）
const breakDurationOptions = computed(() => {
  return breakPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});
```

- [ ] **Step 3: 添加样式**

在 `<style>` 中添加：

```scss
.duration-presets-inputs {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    min-width: 50px;
  }

  .unit-label {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    margin-left: 4px;
  }
}
```

- [ ] **Step 4: 验证编译**

运行: `npm run build`
Expected: 构建成功，无 Vue 模板错误

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/PomodoroConfigSection.vue
git commit -m "feat(settings): add pomodoro duration customization UI"
```

---

## Task 4: 专注弹窗读取配置

**Files:**
- Modify: `src/components/pomodoro/PomodoroTimerDialog.vue`

- [ ] **Step 1: 修改 hardcoded 值为读取配置**

找到 `quickDurations = [15, 25, 45, 60]` 和 `selectedDuration = ref(25)`，替换为：

```typescript
// 从设置读取专注时长预设，使用默认值兜底
const quickDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.focusDurationPresets ?? [15, 25, 45, 60];
});

// 从设置读取默认专注时长
const defaultDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultFocusDuration ?? 25;
});

const selectedDuration = ref(defaultDuration.value);
const customDuration = ref(defaultDuration.value);
```

- [ ] **Step 2: 修复 v-for 循环依赖 computed**

模板中的 `v-for="duration in quickDurations"` 需要改为：

```vue
<button
  v-for="duration in quickDurations"
  :key="duration"
  class="duration-btn"
  :class="{ active: selectedDuration === duration }"
  @click="selectDuration(duration)"
>
  {{ duration }}{{ t('pomodoroDialog').minutes }}
</button>
```

- [ ] **Step 3: 添加 watch 监听默认值变化**

在 script 中添加：

```typescript
// 当默认时长变化时，更新选中值（仅当用户未手动选择时）
watch(defaultDuration, (newVal) => {
  selectedDuration.value = newVal;
  customDuration.value = newVal;
});
```

- [ ] **Step 4: 验证编译**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add src/components/pomodoro/PomodoroTimerDialog.vue
git commit -m "feat(pomodoro): read focus duration presets from settings"
```

---

## Task 5: 休息弹窗读取配置

**Files:**
- Modify: `src/components/pomodoro/PomodoroCompleteDialog.vue`

- [ ] **Step 1: 修改硬编码的休息按钮**

找到模板中的休息按钮部分（第119-121行）：

```vue
<div class="break-options">
  <button class="break-btn" @click="handleStartBreak(5)">{{ t('settings').pomodoro.break5min }}</button>
  <button class="break-btn" @click="handleStartBreak(10)">{{ t('settings').pomodoro.break10min }}</button>
  <button class="break-btn" @click="handleStartBreak(15)">{{ t('settings').pomodoro.break15min }}</button>
</div>
```

替换为动态读取配置：

```vue
<div class="break-options">
  <button
    v-for="duration in breakDurations"
    :key="duration"
    class="break-btn"
    :class="{ active: selectedBreakDuration === duration }"
    @click="handleStartBreak(duration)"
  >
    {{ duration }}{{ t('common').minutes }}
  </button>
</div>
```

- [ ] **Step 2: 在 script 中添加计算属性**

在 `<script setup>` 中添加：

```typescript
import { ref, computed, onBeforeUnmount, watch } from 'vue';

// 从设置读取休息时长预设
const breakDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.breakDurationPresets ?? [5, 10, 15];
});

// 从设置读取默认休息时长
const defaultBreakDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultBreakDuration ?? 5;
});

// 当前选中的休息时长
const selectedBreakDuration = ref(defaultBreakDuration.value);

// 默认选中设置的默认值
watch(defaultBreakDuration, (newVal) => {
  selectedBreakDuration.value = newVal;
}, { immediate: true });
```

- [ ] **Step 3: 添加按钮高亮样式**

在 style 中添加 `.break-btn.active` 样式：

```scss
.break-btn {
  // 现有样式...

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-color: var(--b3-theme-primary);
  }
}
```

- [ ] **Step 4: 验证编译**

运行: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add src/components/pomodoro/PomodoroCompleteDialog.vue
git commit -m "feat(pomodoro): read break duration presets from settings"
```

---

## Task 6: 验证测试

**Files:**
- Test manually via UI

- [ ] **Step 1: 开发模式启动**

运行: `npm run dev`
Expected: 构建成功，监听模式启动

- [ ] **Step 2: 功能验证清单**

在思源插件中测试：

1. **设置页面显示**
   - [ ] 打开设置 → 番茄钟
   - [ ] 确认显示"专注时长预设" 4个输入框（15/25/45/60）
   - [ ] 确认显示"默认专注时长"下拉框（选项15/25/45/60）
   - [ ] 确认显示"休息时长预设" 3个输入框（5/10/15）
   - [ ] 确认显示"默认休息时长"下拉框（选项5/10/15）

2. **修改预设值**
   - [ ] 修改专注预设为 [10, 20, 30, 40]
   - [ ] 确认默认专注下拉框自动更新为 10/20/30/40
   - [ ] 修改休息预设为 [3, 8, 15]
   - [ ] 确认默认休息下拉框自动更新为 3/8/15
   - [ ] 保存设置，刷新页面，确认值已持久化

3. **专注弹窗测试**
   - [ ] 点击任务开始专注
   - [ ] 确认快速选择按钮显示自定义预设值
   - [ ] 确认默认选中用户设置的默认值

4. **休息弹窗测试**
   - [ ] 完成专注后弹出休息选择
   - [ ] 确认休息按钮显示自定义预设值
   - [ ] 确认默认高亮用户设置的默认值

- [ ] **Step 3: 边界测试**

- [ ] 输入非法值（负数、0、超过限制）：确认被自动修正
- [ ] 清空配置后重启：确认使用代码默认值

- [ ] **Step 4: Commit 最终版本**

```bash
git add .
git commit -m "feat(pomodoro): complete customizable duration presets feature

- Add focusDurationPresets, defaultFocusDuration config
- Add breakDurationPresets, defaultBreakDuration config
- Settings UI with preset inputs and default dropdown selectors
- Pomodoro dialog reads presets from config
- Break dialog reads presets and default from config"
```

---

## Self-Review 检查

**1. Spec coverage:**
- ✅ 专注时长预设（4个）- Task 1, 3, 4
- ✅ 默认专注时长 - Task 1, 3, 4
- ✅ 休息时长预设（3个）- Task 1, 3, 5
- ✅ 默认休息时长 - Task 1, 3, 5
- ✅ 下拉选择 UI - Task 3
- ✅ 默认值兜底（不写入配置）- Task 1 defaultPomodoroSettings

**2. Placeholder scan:**
- ✅ 无 TBD/TODO
- ✅ 所有代码步骤包含完整代码
- ✅ 所有命令包含预期输出

**3. Type consistency:**
- ✅ 配置字段名一致：`focusDurationPresets`, `defaultFocusDuration`, `breakDurationPresets`, `defaultBreakDuration`
- ✅ 默认值 25/5 与设计一致
