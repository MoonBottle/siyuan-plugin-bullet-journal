# 计划：项目 Header 右侧添加分组 Tag

## 摘要

在 `ItemDetailContent.vue` 的项目 Card header 中，参考事项的 `ItemStatusTag` 样式，在项目标签右侧添加分组 tag（当项目有 `groupId` 时显示）。

## 现状分析

- 项目 Card 的 header（第 16-20 行）目前只有一个 `card-label`，没有右侧 tag
- 任务 Card 的 header（第 50-61 行）已有 `tag-badge`（显示 task.level），可作为参考
- 事项 Card 的 header（第 101-116 行）已有 `header-tags` 区域，包含 `ItemStatusTag` 和优先级 emoji
- `Project` 类型有 `groupId?: string` 字段（[models.ts#L97](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/types/models.ts#L97)）
- `ProjectGroup` 类型为 `{ id: string, name: string }`（[models.ts#L311-L314](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/types/models.ts#L311-L314)）
- `settingsStore.groups` 存储所有分组（[settingsStore.ts#L39](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/stores/settingsStore.ts#L39)）
- 可通过 `settingsStore.groups.find(g => g.id === project.groupId)?.name` 获取分组名称

## 修改方案

### 文件：`src/components/dialog/ItemDetailContent.vue`

1. **Template 修改**（第 16-20 行）：在项目 Card 的 `#header` slot 中，添加分组 tag

   修改前：
   ```html
   <template #header>
     <div class="card-label">
       {{ t('todo').project }}
     </div>
   </template>
   ```

   修改后：
   ```html
   <template #header>
     <div class="card-label">
       {{ t('todo').project }}
     </div>
     <div
       v-if="projectGroupName"
       class="tag-badge group-tag"
     >
       {{ projectGroupName }}
     </div>
   </template>
   ```

2. **Script 修改**：添加 `projectGroupName` 计算属性

   在 `const projectLinks = computed(...)` 之后添加：
   ```ts
   const projectGroupName = computed(() => {
     if (!project.value?.groupId) return ''
     return settingsStore.groups.find(g => g.id === project.value!.groupId)?.name || ''
   })
   ```

3. **Style 修改**：添加 `.group-tag` 样式，复用现有 `.tag-badge` 的基础样式，添加分组专属配色

   ```scss
   .group-tag {
     background: color-mix(in srgb, var(--b3-theme-primary-lightest) 50%, transparent);
     color: var(--b3-theme-primary);
   }
   ```

## 设计决策

- 使用与 `tag-badge`（task level）相同的 DOM 结构和基础样式，保持视觉一致性
- 分组 tag 使用主题色（primary）配色，与事项状态 tag 的各状态配色区分
- 仅当项目有 `groupId` 且能找到对应分组名时才显示（`v-if="projectGroupName"`）
- 不创建新组件，因为逻辑简单，直接在模板中实现

## 验证步骤

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
4. 手动验证：打开有分组的项目事项详情，确认项目 header 右侧显示分组 tag；无分组的项目不显示
