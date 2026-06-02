# 技能市场（模板市场）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 添加技能市场功能，用户可从内置模板浏览并创建技能，同一模板可多次使用（可重命名）。

**架构：** 新增 `MarketService` 单例服务加载内置 JSON 模板目录，新增 `SkillMarketDialog.vue` 独立对话框展示模板卡片，修改 `AiSkillConfigSection.vue` 移除硬编码模板并添加"技能市场"入口按钮。市场模板本质是模板而非安装包，使用后创建的技能等同自建技能（`source: 'user'`）。

**技术栈：** Vue 3 + Pinia + TypeScript + Vite `import.meta.glob` + SiYuan Dialog API

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/market-skills/daily-report.json` | 新增 | 日报模板数据 |
| `src/services/marketService.ts` | 新增 | 市场服务：加载内置目录、查询模板 |
| `src/components/dialog/SkillMarketDialog.vue` | 新增 | 市场对话框：模板卡片列表 + 命名子对话框 |
| `src/components/settings/AiSkillConfigSection.vue` | 修改 | 移除 skillTemplates、简化空状态、添加市场按钮 |
| `src/index.ts` | 修改 | 添加 MarketService 初始化 |
| `src/i18n/zh_CN.json` | 修改 | 添加市场相关 i18n key |

---

### 任务 1：创建日报模板 JSON 文件

**文件：**
- 创建：`src/market-skills/daily-report.json`

- [ ] **步骤 1：创建 JSON 文件**

将 `AiSkillConfigSection.vue` 中 `skillTemplates[0].content` 的内容迁移到 JSON 文件：

```json
{
  "name": "daily-report",
  "description": "生成每日工作日报，汇总当天完成的任务和番茄钟记录",
  "version": "1.0.0",
  "author": "Task Assistant",
  "tags": ["report", "daily"],
  "type": "prompt",
  "content": "## 工作流程\n\n1. **查询当天任务** — 获取今天完成和进行中的任务\n2. **查询番茄钟记录** — 获取今日番茄钟统计\n3. **生成日报** — 按以下格式整理信息并输出\n\n## 日报格式\n\n```markdown\n# 📋 日报 - {日期}\n\n## ✅ 今日完成\n- {任务1}\n- {任务2}\n\n## 🔄 进行中\n- {任务3}\n\n## 🍅 番茄钟统计\n- 今日完成 {n} 个番茄钟\n- 累计专注 {n} 分钟\n\n## 📝 明日计划\n（根据进行中的任务和用户补充信息生成）\n```\n\n## 注意事项\n- 如果用户指定了日期范围，按范围查询\n- 如果没有完成的任务，提示\"今日暂无完成任务\"\n- 番茄钟数据为空时省略该部分\n"
}
```

- [ ] **步骤 2：验证 JSON 格式正确**

运行：`node -e "console.log(JSON.parse(require('fs').readFileSync('src/market-skills/daily-report.json','utf8')).name)"`
预期：输出 `daily-report`

---

### 任务 2：创建 MarketService

**文件：**
- 创建：`src/services/marketService.ts`

- [ ] **步骤 1：编写 MarketService**

```typescript
export interface MarketSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
  content: string
}

class MarketService {
  private static instance: MarketService
  private catalog: MarketSkill[] = []

  private constructor() {}

  static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService()
    }
    return MarketService.instance
  }

  loadBuiltinCatalog(): void {
    const modules = import.meta.glob('/src/market-skills/*.json', { eager: true })
    this.catalog = Object.values(modules).map(
      (m: any) => m.default as MarketSkill,
    )
  }

  getCatalog(): MarketSkill[] {
    return this.catalog
  }

  getSkill(name: string): MarketSkill | undefined {
    return this.catalog.find(s => s.name === name)
  }
}

export { MarketService }
```

- [ ] **步骤 2：验证构建通过**

运行：`npm run build 2>&1 | Select-Object -Last 5`
预期：`✓ built in` 成功

---

### 任务 3：在 index.ts 中初始化 MarketService

**文件：**
- 修改：`src/index.ts:411`（`initSkillStorage` 调用附近）

- [ ] **步骤 1：添加 import 和初始化调用**

在 `src/index.ts` 顶部 import 区域添加：

```typescript
import { MarketService } from '@/services/marketService'
```

在 `onload()` 方法中，`this.initSkillStorage()` 之后添加：

```typescript
MarketService.getInstance().loadBuiltinCatalog()
```

- [ ] **步骤 2：验证构建通过**

运行：`npm run build 2>&1 | Select-Object -Last 5`
预期：`✓ built in` 成功

---

### 任务 4：添加 i18n key

**文件：**
- 修改：`src/i18n/zh_CN.json`

- [ ] **步骤 1：在 `aiSkills` 对象中添加市场相关 key**

在 `src/i18n/zh_CN.json` 的 `"aiSkills"` 对象中添加以下 key（在 `"executionFailed"` 之后）：

```json
"marketTitle": "技能市场",
"marketDescription": "浏览模板，快速创建技能",
"useTemplate": "使用模板",
"createFromTemplate": "从模板创建技能",
"templateName": "技能名称",
"templateNamePlaceholder": "输入技能名称",
"templateDesc": "技能描述",
"templateDescPlaceholder": "输入技能描述",
"createBtn": "创建",
"emptyMarket": "暂无可用模板",
"searchPlaceholder": "搜索模板..."
```

同时更新 `emptySkills` 的文案：
```json
"emptySkills": "暂无技能，从技能市场浏览模板，或自定义创建"
```

- [ ] **步骤 2：验证 JSON 格式正确**

运行：`node -e "JSON.parse(require('fs').readFileSync('src/i18n/zh_CN.json','utf8')); console.log('OK')"`
预期：输出 `OK`

---

### 任务 5：创建 SkillMarketDialog.vue

**文件：**
- 创建：`src/components/dialog/SkillMarketDialog.vue`

- [ ] **步骤 1：编写 SkillMarketDialog 组件**

组件功能：
- 展示模板卡片列表（名称、描述、标签、"使用模板"按钮）
- 搜索过滤（按名称/描述/标签匹配）
- 点击"使用模板"弹出命名子对话框（技能名称预填模板名 + 描述预填模板描述）
- 确认后调用 `skillStore.addSkill()` 创建技能

```vue
<template>
  <div class="skill-market-dialog">
    <div class="market-search">
      <SyInput
        v-model="searchQuery"
        :placeholder="t('settings').aiSkills?.searchPlaceholder ?? '搜索模板...'"
      />
    </div>

    <div
      v-if="filteredCatalog.length === 0"
      class="market-empty"
    >
      {{ t('settings').aiSkills?.emptyMarket ?? '暂无可用模板' }}
    </div>

    <div
      v-else
      class="market-list"
    >
      <div
        v-for="skill in filteredCatalog"
        :key="skill.name"
        class="market-card"
      >
        <div class="market-card-header">
          <span class="market-card-name">{{ skill.name }}</span>
          <div class="market-card-tags">
            <span
              v-for="tag in skill.tags"
              :key="tag"
              class="market-card-tag"
            >{{ tag }}</span>
          </div>
        </div>
        <div class="market-card-desc">{{ skill.description }}</div>
        <div class="market-card-footer">
          <span class="market-card-author">{{ skill.author }}</span>
          <SyButton
            :text="t('settings').aiSkills?.useTemplate ?? '使用模板'"
            @click="openCreateFromTemplate(skill)"
          />
        </div>
      </div>
    </div>

    <div
      v-if="creatingFrom"
      class="b3-dialog"
    >
      <div
        class="b3-dialog__scrim"
        @click="creatingFrom = null"
      ></div>
      <div class="b3-dialog__container create-from-template-dialog">
        <div class="b3-dialog__header">
          <div class="b3-dialog__title">
            {{ t('settings').aiSkills?.createFromTemplate ?? '从模板创建技能' }}
          </div>
          <svg
            class="b3-dialog__close"
            @click="creatingFrom = null"
          ><use xlink:href="#iconCloseRound"></use></svg>
        </div>
        <div class="b3-dialog__content">
          <div class="create-form">
            <div class="create-form-item">
              <label class="create-form-label">{{ t('settings').aiSkills?.templateName ?? '技能名称' }}</label>
              <SyInput
                v-model="createForm.name"
                :placeholder="t('settings').aiSkills?.templateNamePlaceholder ?? '输入技能名称'"
                @blur="validateName"
              />
              <span
                v-if="createErrors.name"
                class="create-form-error"
              >{{ createErrors.name }}</span>
            </div>
            <div class="create-form-item">
              <label class="create-form-label">{{ t('settings').aiSkills?.templateDesc ?? '技能描述' }}</label>
              <SyInput
                v-model="createForm.description"
                :placeholder="t('settings').aiSkills?.templateDescPlaceholder ?? '输入技能描述'"
              />
            </div>
          </div>
        </div>
        <div class="b3-dialog__action">
          <button
            class="b3-button b3-button--cancel"
            @click="creatingFrom = null"
          >
            {{ t('common').cancel }}
          </button>
          <button
            class="b3-button b3-button--text"
            :disabled="!isCreateValid || isCreating"
            @click="createFromTemplate"
          >
            {{ isCreating ? (t('common').saving ?? '创建中...') : (t('settings').aiSkills?.createBtn ?? '创建') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import {
  computed,
  reactive,
  ref,
} from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import { t } from '@/i18n'
import { MarketService } from '@/services/marketService'
import { useSkillStore } from '@/stores/skillStore'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const skillStore = useSkillStore()
const marketService = MarketService.getInstance()

const searchQuery = ref('')
const creatingFrom = ref<typeof catalog.value[0] | null>(null)
const isCreating = ref(false)

const catalog = computed(() => marketService.getCatalog())

const filteredCatalog = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return catalog.value
  return catalog.value.filter((s) => {
    return s.name.toLowerCase().includes(q)
      || s.description.toLowerCase().includes(q)
      || s.tags.some(tag => tag.toLowerCase().includes(q))
  })
})

const createForm = reactive({
  name: '',
  description: '',
})

const createErrors = reactive({
  name: '',
})

const isCreateValid = computed(() => {
  return createForm.name.trim().length > 0
    && createForm.description.trim().length > 0
    && !createErrors.name
})

function validateName() {
  const name = createForm.name.trim()
  createErrors.name = ''
  if (!name) {
    createErrors.name = t('slash').skillNameRequired
    return
  }
  const existing = skillStore.getSkillByName(name)
  if (existing) {
    createErrors.name = t('slash').skillNameExists
  }
}

function openCreateFromTemplate(skill: typeof catalog.value[0]) {
  createForm.name = skill.name
  createForm.description = skill.description
  createErrors.name = ''
  creatingFrom.value = skill
}

async function createFromTemplate() {
  if (!creatingFrom.value || !isCreateValid.value) return

  isCreating.value = true
  try {
    await skillStore.addSkill({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      content: creatingFrom.value.content,
      autoEnable: true,
    })
    showMessage(`技能「${createForm.name.trim()}」已创建`, 2000, 'info')
    creatingFrom.value = null
    emit('created')
  } catch (err) {
    showMessage(`创建失败: ${(err as Error).message}`, 3000, 'error')
  } finally {
    isCreating.value = false
  }
}
</script>

<style lang="scss" scoped>
.skill-market-dialog {
  padding: 16px;
  min-width: 400px;
  position: relative;
}

.market-search {
  margin-bottom: 16px;
}

.market-empty {
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 32px 0;
}

.market-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.market-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  padding: 14px 16px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary-light, var(--b3-theme-primary));
  }
}

.market-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.market-card-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.market-card-tags {
  display: flex;
  gap: 4px;
}

.market-card-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-on-surface-light);
}

.market-card-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  line-height: 1.5;
  margin-bottom: 10px;
}

.market-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.market-card-author {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.7;
}

.create-from-template-dialog {
  width: 420px;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.create-form-label {
  font-size: 13px;
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

.create-form-error {
  font-size: 12px;
  color: var(--b3-theme-error);
}
</style>
```

- [ ] **步骤 2：验证构建通过**

运行：`npm run build 2>&1 | Select-Object -Last 5`
预期：`✓ built in` 成功

---

### 任务 6：修改 AiSkillConfigSection.vue

**文件：**
- 修改：`src/components/settings/AiSkillConfigSection.vue`

- [ ] **步骤 1：移除 skillTemplates 和 createFromTemplate，添加市场按钮**

模板部分改动：

1. 移除 `skillTemplates` 常量及其 `createFromTemplate` 函数
2. 将空状态从模板卡片列表改为简洁提示
3. 添加"技能市场"按钮（与"添加技能"并列）
4. 添加 `openMarketDialog` 函数

template 部分修改 — 将空状态区域替换为：

```html
<div
  v-if="skills.length === 0"
  class="skill-empty"
>
  {{ t('settings').aiSkills?.emptySkills ?? '暂无技能，从技能市场浏览模板，或自定义创建' }}
</div>
```

底部操作区替换为两个并列按钮：

```html
<div class="skill-actions">
  <SySettingsActionButton
    icon="iconAdd"
    :text="t('settings').aiSkills?.addSkill ?? '添加技能'"
    @click="showAddSkillDialog"
  />
  <SySettingsActionButton
    icon="iconSparkles"
    :text="t('settings').aiSkills?.marketTitle ?? '技能市场'"
    @click="openMarketDialog"
  />
</div>
```

script 部分修改：

1. 移除 `skillTemplates` 常量
2. 移除 `createFromTemplate` 函数
3. 添加 `SkillMarketDialog` import
4. 添加 `openMarketDialog` 函数：

```typescript
import SkillMarketDialog from '@/components/dialog/SkillMarketDialog.vue'

function openMarketDialog() {
  const container = document.createElement('div')

  let app: ReturnType<typeof createApp>

  const dialog = createDialog({
    title: t('settings').aiSkills?.marketTitle ?? '技能市场',
    content: '',
    width: '600px',
    destroyCallback: () => {
      app.unmount()
    },
  })

  app = createApp(SkillMarketDialog, {
    onClose: () => {
      dialog.destroy()
    },
    onCreated: () => {
      dialog.destroy()
    },
  })

  app.use(getSharedPinia())
  app.mount(container)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body')
  if (bodyEl) {
    bodyEl.appendChild(container)
  }
}
```

style 部分修改：

1. 移除 `.skill-templates`、`.skill-templates-hint`、`.template-list`、`.template-item`、`.template-info`、`.template-name`、`.template-desc` 样式
2. 添加 `.skill-empty` 和 `.skill-actions` 样式：

```scss
.skill-empty {
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  padding: 12px 0;
  text-align: center;
}

.skill-actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **步骤 2：验证构建通过**

运行：`npm run build 2>&1 | Select-Object -Last 5`
预期：`✓ built in` 成功

---

### 任务 7：端到端验证

- [ ] **步骤 1：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 2：运行构建**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 3：Commit**

```bash
git add src/market-skills/daily-report.json src/services/marketService.ts src/components/dialog/SkillMarketDialog.vue src/components/settings/AiSkillConfigSection.vue src/index.ts src/i18n/zh_CN.json
git commit -m "feat: 添加技能市场（模板市场）功能"
```
