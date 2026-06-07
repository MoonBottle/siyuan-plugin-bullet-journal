<template>
  <div
    class="todo-sidebar"
    :class="{ 'todo-sidebar--embedded': displayMode === 'embedded' }"
  >
    <div class="todo-content">
      <SyLoading
        v-if="showInitialLoading"
        :text="t('common').loading"
      />

      <!-- 空状态：有筛选条件但无结果 -->
      <div
        v-else-if="showPanelEmptyState"
        class="empty-guide"
      >
        <div class="empty-guide-icon">
          <svg><use xlink:href="#iconList"></use></svg>
        </div>
        <div class="empty-guide-title">
          {{ panelEmptyTitle }}
        </div>
        <div
          v-if="panelEmptyDesc"
          class="empty-guide-desc"
        >
          {{ panelEmptyDesc }}
        </div>
      </div>

      <div
        v-else-if="hasActiveFilters && visibleItemCount === 0"
        class="empty-guide"
      >
        <div class="empty-guide-icon">
          <svg><use xlink:href="#iconSearch"></use></svg>
        </div>
        <div class="empty-guide-title">
          {{ t('todo').noFilterResults || '没有找到符合条件的事项' }}
        </div>
        <div class="empty-guide-desc">
          {{ t('todo').adjustFilters || '请尝试调整筛选条件' }}
        </div>
      </div>

      <!-- 空状态：真的没有任何数据 -->
      <div
        v-else-if="!hasAnyItemsRaw"
        class="empty-guide"
      >
        <div class="empty-guide-icon">
          <svg><use xlink:href="#iconList"></use></svg>
        </div>
        <div class="empty-guide-title">
          {{ t('todo').emptyGuideTitle }}
        </div>
        <div class="empty-guide-desc">
          {{ t('todo').emptyGuideDesc }}
        </div>
        <div class="empty-guide-actions">
          <button
            class="b3-button b3-button--outline"
            @click="handleCreateExample"
          >
            <svg><use xlink:href="#iconAdd"></use></svg>
            <span>{{ t('todo').createExampleDoc }}</span>
          </button>
        </div>
      </div>

      <div
        v-else
        class="todo-list"
      >
        <!-- 已置顶 -->
        <div
          v-if="pinnedItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('pinned')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.pinned"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').pinned || '已置顶' }} ({{ pinnedItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.pinned"
            class="todo-items"
          >
            <Card
              v-for="item in pinnedItems"
              :key="item.id"
              status="today"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                    class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                    v-if="getPriorityEmoji(item)"
                    class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-pin="true"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                  @togglePinned="handleTogglePinned(item)"
                  @skipOccurrence="handleSkipOccurrence(item)"
                />
              </template>
            </Card>
          </div>
        </div>

        <!-- 已过期 -->
        <div
          v-if="expiredItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('expired')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.expired"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').expired }} ({{ expiredItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.expired"
            class="todo-items"
          >
            <Card
              v-for="item in expiredItems"
              :key="item.id"
              status="expired"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                    class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                  v-if="getPriorityEmoji(item)"
                    class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-pin="true"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                  @togglePinned="handleTogglePinned(item)"
                  @skipOccurrence="handleSkipOccurrence(item)"
                />
              </template>
            </Card>
          </div>
        </div>

        <!-- 今日 -->
        <div
          v-if="todayItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('today')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.today"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').today }} ({{ todayItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.today"
            class="todo-items"
          >
            <Card
              v-for="item in todayItems"
              :key="item.id"
              status="today"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                  class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                    v-if="getPriorityEmoji(item)"
                    class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-pin="true"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                  @togglePinned="handleTogglePinned(item)"
                  @skipOccurrence="handleSkipOccurrence(item)"
                />
              </template>
            </Card>
          </div>
        </div>

        <!-- 明日 -->
        <div
          v-if="tomorrowItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('tomorrow')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.tomorrow"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').tomorrow }} ({{ tomorrowItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.tomorrow"
            class="todo-items"
          >
            <Card
              v-for="item in tomorrowItems"
              :key="item.id"
              status="tomorrow"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                    class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                    v-if="getPriorityEmoji(item)"
                    class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                  </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-pin="true"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                  @togglePinned="handleTogglePinned(item)"
                  @skipOccurrence="handleSkipOccurrence(item)"
                />
              </template>
            </Card>
          </div>
        </div>

        <!-- 未来日期 -->
        <div
          v-if="futureItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('future')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.future"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').future }} ({{ futureItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.future"
            class="todo-items"
          >
            <div
              v-for="date in futureDates"
              :key="date"
              class="todo-date-group"
            >
              <div class="date-label">
                {{ formatDateLabel(date) }}
              </div>
              <div class="todo-items">
                <Card
                  v-for="item in groupedFutureItems.get(date)"
                  :key="item.id"
                  status="future"
                  :show-header="true"
                  :show-footer="true"
                  :clickable="true"
                  :draggable="getItemDraggable(item)"
                  :data-testid="`todo-sidebar-card-${item.id}`"
                  :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
                  @click="handleItemPreviewClick(item, $event)"
                  @contextmenu="handleContextMenu($event, item)"
                  @mouseenter="handleItemHoverStart(item, $event)"
                  @mouseleave="handleItemHoverEnd(item, $event)"
                  @dragstart="handleItemDragStart(item, $event)"
                  @dragend="handleItemDragEnd(item, $event)"
                >
                  <template #header>
                    <div class="item-header-left">
                      <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                    </div>
                    <div class="item-header-right">
                      <span
                        v-if="getFocusPlanDisplay(item.focusPlan)"
                        class="item-focus-plan-badge"
                        @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                        @mouseleave="hideTooltip"
                      >
                        <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                        <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                      </span>
                      <span
                        v-if="getPriorityEmoji(item)"
                        class="item-priority"
                        @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                        @mouseleave="hideTooltip"
                      >{{ getPriorityEmoji(item) }}</span>
                    </div>
                  </template>
                  <div
                    v-if="item.task || item.project"
                    class="item-task"
                  >
                    <span
                      v-if="item.project"
                      class="item-project-name"
                    >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
                  </div>
                  <div class="item-content">
                    {{ getStatusEmoji(item) }} {{ item.content }}
                  </div>
                  <div
                    v-if="item.tags?.length"
                    class="item-tag-list"
                  >
                    <button
                      v-for="tag in item.tags"
                      :key="`${item.id}-${tag}`"
                      class="item-tag-chip"
                      :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                      @click.stop="handleAddTagFilter(tag)"
                    >
                      #{{ tag }}
                    </button>
                  </div>
                  <TodoItemMeta :item="item" />
                  <template #footer>
                    <ItemActionBar
                      :item="item"
                      :show-pin="true"
                      :show-detail="true"
                      @openCalendar="openCalendar(item)"
                      @openDetail="openDetail(item)"
                      @togglePinned="handleTogglePinned(item)"
                      @skipOccurrence="handleSkipOccurrence(item)"
                    />
                  </template>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <!-- 已完成事项 -->
        <div
          v-if="!hideCompleted && completedItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('completed')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.completed"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').completed }} ({{ completedItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.completed"
            class="todo-items"
          >
            <Card
              v-for="item in completedItems.slice(0, 10)"
              :key="item.id"
              status="completed"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                    class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                  v-if="getPriorityEmoji(item)"
                  class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                />
              </template>
            </Card>
          </div>
        </div>

        <!-- 已放弃事项 -->
        <div
          v-if="!hideAbandoned && abandonedItems.length > 0"
          class="todo-section"
        >
          <div
            class="section-label clickable"
            @click="toggleSection('abandoned')"
          >
            <span class="collapse-icon">
              <svg v-if="collapsedSections.abandoned"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').abandoned }} ({{ abandonedItems.length }})</span>
          </div>
          <div
            v-show="!collapsedSections.abandoned"
            class="todo-items"
          >
            <Card
              v-for="item in abandonedItems.slice(0, 10)"
              :key="item.id"
              status="abandoned"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              :draggable="getItemDraggable(item)"
              :data-testid="`todo-sidebar-card-${item.id}`"
              :class="{ 'todo-card--drag-source': getItemDraggable(item) }"
              @click="handleItemPreviewClick(item, $event)"
              @contextmenu="handleContextMenu($event, item)"
              @mouseenter="handleItemHoverStart(item, $event)"
              @mouseleave="handleItemHoverEnd(item, $event)"
              @dragstart="handleItemDragStart(item, $event)"
              @dragend="handleItemDragEnd(item, $event)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <div class="item-header-right">
                  <span
                  v-if="getFocusPlanDisplay(item.focusPlan)"
                    class="item-focus-plan-badge"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getFocusPlanTooltip(item.focusPlan))"
                    @mouseleave="hideTooltip"
                  >
                    <template v-if="getFocusPlanDisplay(item.focusPlan)?.type === 'pomodoro'">🍅x{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                    <template v-else>⏳{{ getFocusPlanDisplay(item.focusPlan)?.value }}</template>
                  </span>
                  <span
                  v-if="getPriorityEmoji(item)"
                    class="item-priority"
                    @mouseenter="(e) => showTooltip(e.currentTarget as HTMLElement, getPriorityLabel(item))"
                    @mouseleave="hideTooltip"
                    >{{ getPriorityEmoji(item) }}</span>
                  <ItemStatusTag :item="item" />
                </div>
              </template>
              <div
                v-if="item.task || item.project"
                class="item-task"
              >
                <span
                  v-if="item.project"
                  class="item-project-name"
                >{{ item.project.name }}<span v-if="item.task"> · </span></span>{{ item.task?.name }}
              </div>
              <div class="item-content">
                {{ getStatusEmoji(item) }} {{ item.content }}
              </div>
              <div
                v-if="item.tags?.length"
                class="item-tag-list"
              >
                <button
                  v-for="tag in item.tags"
                  :key="`${item.id}-${tag}`"
                  class="item-tag-chip"
                  :class="[{ 'item-tag-chip--active': isTagSelected(tag) }]"
                  @click.stop="handleAddTagFilter(tag)"
                >
                  #{{ tag }}
                </button>
              </div>
              <TodoItemMeta :item="item" />
              <template #footer>
                <ItemActionBar
                  :item="item"
                  :show-detail="true"
                  @openCalendar="openCalendar(item)"
                  @openDetail="openDetail(item)"
                />
              </template>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  TodoSidebarDragPayload,
  TodoSidebarHoverPayload,
  TodoSidebarPreviewTriggerMode,
} from './todoSidebarTypes'
import type {
  Item,
  PriorityLevel,
} from '@/types/models'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'

import Card from '@/components/common/Card.vue'
import ItemStatusTag from '@/components/common/ItemStatusTag.vue'
import SyLoading from '@/components/SiyuanTheme/SyLoading.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
import TodoItemMeta from '@/components/todo/TodoItemMeta.vue'
import { TAB_TYPES } from '@/constants'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import { PRIORITY_CONFIG } from '@/parser/priorityParser'
import { skipCurrentOccurrence } from '@/services/recurringService'
import {
  usePomodoroStore,
  useProjectStore,
} from '@/stores'
import { writeBlock } from '@/utils/blockWriter'
import {
  createItemMenu,
  showContextMenu,
} from '@/utils/contextMenu'
import {
  dateRangeStatusToEmoji,
  getDateRangeStatus,
  getEffectiveDate,
  getTimeRangeStatus,
} from '@/utils/dateRangeUtils'
import {
  formatDateLabel as formatDateLabelUtil,
  formatTimeRange,
} from '@/utils/dateUtils'
import dayjs from '@/utils/dayjs'
import {
  showDatePickerDialog,
  showItemDetailModal,
  showPomodoroTimerDialog,
} from '@/utils/dialog'

import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import { createExampleDocument } from '@/utils/exampleDocUtils'
import { openDocumentAtLine } from '@/utils/fileUtils'
import {
  getFocusPlanDisplay,
  getFocusPlanTooltip,
} from '@/utils/format'

import {
  abandonItem,
  completeItem,
  migrateItem,
  migrateItemToDate,
  migrateItemToToday,
} from '@/utils/itemActions'
import { toggleItemPinned } from '@/utils/itemSettingUtils'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

const props = withDefaults(defineProps<{
  selectedTags?: string[]
  items?: Item[]
  hasAnyItemsRaw?: boolean
  hasActiveFilters?: boolean
  emptyStateMode?: 'default' | 'panel'
  emptyStateTitle?: string
  emptyStateDesc?: string
  loading?: boolean
  displayMode?: 'default' | 'embedded'
  previewTriggerMode?: TodoSidebarPreviewTriggerMode
  enableDrag?: boolean
  onItemDragStart?: (payload: TodoSidebarDragPayload, event: DragEvent) => void
  onItemDragEnd?: (payload: TodoSidebarDragPayload, event: DragEvent) => void
  onItemHoverStart?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void
  onItemHoverEnd?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void
  onItemPreviewClick?: (payload: TodoSidebarHoverPayload, event: MouseEvent) => void
}>(), {
  selectedTags: () => [],
  items: () => [],
  hasAnyItemsRaw: false,
  hasActiveFilters: false,
  emptyStateMode: 'default',
  emptyStateTitle: '',
  emptyStateDesc: '',
  loading: undefined,
  displayMode: 'default',
  previewTriggerMode: 'hover',
  enableDrag: false,
  onItemDragStart: undefined,
  onItemDragEnd: undefined,
  onItemHoverStart: undefined,
  onItemHoverEnd: undefined,
  onItemPreviewClick: undefined,
})

const emit = defineEmits<{
  (event: 'addTagFilter', value: string): void
}>()

const getPriorityEmoji = (item: Item): string => {
  if (item.priority === 'high') return '🔥'
  if (item.priority === 'medium') return '🌱'
  if (item.priority === 'low') return '🍃'
  return ''
}

const getPriorityLabel = (item: Item): string => {
  if (item.priority && PRIORITY_CONFIG[item.priority]) {
    return PRIORITY_CONFIG[item.priority].label
  }
  return ''
}

const projectStore = useProjectStore()
const pomodoroStore = usePomodoroStore()
const plugin = usePlugin()

const getStatusEmoji = (item: Item): string => {
  if (pomodoroStore.activePomodoro?.blockId && item.blockId === pomodoroStore.activePomodoro.blockId) {
    return '🍅'
  }
  if (item.status === 'completed') return '✅'
  if (item.status === 'abandoned') return '❌'
  const todayStr = dayjs().format('YYYY-MM-DD')
  if (item.dateRangeStart && item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(item, todayStr)
    if (rangeStatus) return dateRangeStatusToEmoji(rangeStatus)
  }
  if (!item.dateRangeStart && !item.dateRangeEnd && item.date) {
    const timeStatus = getTimeRangeStatus(item, dayjs().format('YYYY-MM-DD HH:mm:ss'))
    if (timeStatus) return dateRangeStatusToEmoji(timeStatus)
  }
  const isExpired = item.date && item.date < todayStr
  if (isExpired) return '⚠️'
  return '⏳'
}

// 防止重复点击的执行锁
const isProcessing = ref(false)

// 从 store 获取当前日期，确保日期变化时 computed 会重新计算
const currentDate = computed(() => projectStore.currentDate)

const loading = computed(() => props.loading ?? projectStore.loading)

// 折叠状态管理
const collapsedSections = ref({
  pinned: false,
  expired: false,
  today: false,
  tomorrow: false,
  future: false,
  completed: false,
  abandoned: false,
})

// 切换分组折叠状态
const toggleSection = (section: keyof typeof collapsedSections.value) => {
  collapsedSections.value[section] = !collapsedSections.value[section]
}

const allCollapsed = computed(() => {
  return (Object.keys(collapsedSections.value) as Array<keyof typeof collapsedSections.value>).every((key) => collapsedSections.value[key])
})

const collapseAll = () => {
  (Object.keys(collapsedSections.value) as Array<keyof typeof collapsedSections.value>).forEach((key) => {
    collapsedSections.value[key] = true
  })
}

const expandAll = () => {
  (Object.keys(collapsedSections.value) as Array<keyof typeof collapsedSections.value>).forEach((key) => {
    collapsedSections.value[key] = false
  })
}

const toggleCollapseAll = () => {
  if (allCollapsed.value) {
    expandAll()
  } else {
    collapseAll()
  }
}

defineExpose({
  collapseAll,
  expandAll,
  toggleCollapseAll,
  allCollapsed,
})

// 获取今天的日期字符串（基于 store 的 currentDate）
const getTodayStr = (): string => {
  return currentDate.value
}

// 获取明天的日期字符串（基于 store 的 currentDate）
const getTomorrowStr = (): string => {
  return dayjs(currentDate.value).add(1, 'day').format('YYYY-MM-DD')
}

// 是否隐藏已完成事项
const hideCompleted = computed(() => projectStore.hideCompleted)

// 是否隐藏已放弃事项
const hideAbandoned = computed(() => projectStore.hideAbandoned)

const visibleItems = computed(() => {
  let items = [...props.items]
  if (projectStore.hideCompleted) {
    items = items.filter((item) => item.status !== 'completed')
  }
  if (projectStore.hideAbandoned) {
    items = items.filter((item) => item.status !== 'abandoned')
  }
  return items
})

const completedItems = computed(() => {
  return visibleItems.value.filter((item) => item.status === 'completed')
})

const abandonedItems = computed(() => {
  return visibleItems.value.filter((item) => item.status === 'abandoned')
})

const pinnedItems = computed(() => {
  return visibleItems.value.filter((item) => item.pinned && item.status === 'pending')
})

const regularPendingItems = computed(() => {
  return visibleItems.value.filter((item) => !item.pinned && item.status === 'pending')
})

const expiredItems = computed(() => {
  const todayStr = getTodayStr()
  return regularPendingItems.value.filter((item) => {
    const effectiveDate = getEffectiveDate(item)
    return effectiveDate < todayStr
  })
})

const todayItems = computed(() => {
  const todayStr = getTodayStr()
  return regularPendingItems.value.filter((item) => item.date === todayStr)
})

const tomorrowItems = computed(() => {
  const tomorrowStr = getTomorrowStr()
  return regularPendingItems.value.filter((item) => item.date === tomorrowStr)
})

const futureItems = computed(() => {
  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  return regularPendingItems.value.filter((item) => {
    if (item.date === todayStr || item.date === tomorrowStr) return false
    const effectiveDate = getEffectiveDate(item)
    return effectiveDate >= todayStr
  })
})

const visibleItemCount = computed(() => {
  return pinnedItems.value.length
    + expiredItems.value.length
    + todayItems.value.length
    + tomorrowItems.value.length
    + futureItems.value.length
    + (hideCompleted.value ? 0 : completedItems.value.length)
    + (hideAbandoned.value ? 0 : abandonedItems.value.length)
})

const hasAnyItemsRaw = computed(() => {
  return props.hasAnyItemsRaw
})

const hasActiveFilters = computed(() => {
  return props.hasActiveFilters || props.selectedTags.length > 0
})

const showPanelEmptyState = computed(() => {
  return props.emptyStateMode === 'panel' && visibleItemCount.value === 0
})

const panelEmptyTitle = computed(() => {
  return props.emptyStateTitle || t('quadrant').noTodos || '暂无事项'
})

const panelEmptyDesc = computed(() => props.emptyStateDesc)

const showInitialLoading = computed(() => {
  return loading.value && !hasAnyItemsRaw.value && visibleItemCount.value === 0
})

function normalizeTag(tag?: string) {
  return (tag || '').trim().toLocaleLowerCase()
}

function isTagSelected(tag: string) {
  const normalizedTargetTag = normalizeTag(tag)
  return props.selectedTags.some((selectedTag) => normalizeTag(selectedTag) === normalizedTargetTag)
}

function handleAddTagFilter(tag: string) {
  if (!tag) return
  emit('addTagFilter', tag)
}

async function handleTogglePinned(item: Item) {
  if (isProcessing.value) return

  isProcessing.value = true
  try {
    await toggleItemPinned(item)
  } finally {
    isProcessing.value = false
  }
}

// 按日期分组的未来待办事项（基于筛选后的数据）
const groupedFutureItems = computed(() => {
  const grouped = new Map<string, Item[]>()
  futureItems.value.forEach((item) => {
    const list = grouped.get(item.date)
    if (list) {
      list.push(item)
    } else {
      grouped.set(item.date, [item])
    }
  })
  // 每个日期内按时间排序
  grouped.forEach((list) => {
    list.sort((a, b) => (a.startDateTime || a.date).localeCompare(b.startDateTime || b.date))
  })
  return grouped
})

// 排序后的未来日期（基于筛选后的数据）
const futureDates = computed(() => {
  return Array.from(groupedFutureItems.value.keys()).sort()
})

// 格式化日期标签
const formatDateLabel = (date: string): string => {
  return formatDateLabelUtil(date, t('todo').today, t('todo').tomorrow)
}

// 格式化时间
const formatTime = (item: Item): string => {
  return formatTimeRange(item.startDateTime, item.endDateTime)
}

const getItemDragPayload = (item: Item): TodoSidebarDragPayload | null => {
  if (!item.blockId) return null
  return {
    blockId: item.blockId,
    itemId: item.id,
    priority: item.priority,
  }
}

const getItemDraggable = (item: Item): boolean => {
  return !!props.enableDrag && !!item.blockId
}

const getItemHoverPayload = (item: Item, event: MouseEvent): TodoSidebarHoverPayload | null => {
  if (!item.blockId) return null

  const anchorEl = event.currentTarget as HTMLElement | null
  if (!anchorEl) return null

  return {
    blockId: item.blockId,
    itemId: item.id,
    anchorEl,
  }
}

const handleItemDragStart = (item: Item, event: DragEvent) => {
  const payload = getItemDragPayload(item)
  if (!props.enableDrag || !payload) return
  event.dataTransfer?.setData('application/json', JSON.stringify(payload))
  event.dataTransfer?.setData('text/plain', payload.blockId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
  props.onItemDragStart?.(payload, event)
}

const handleItemDragEnd = (item: Item, event: DragEvent) => {
  const payload = getItemDragPayload(item)
  if (!props.enableDrag || !payload) return
  props.onItemDragEnd?.(payload, event)
}

const handleItemHoverStart = (item: Item, event: MouseEvent) => {
  if (props.previewTriggerMode !== 'hover') return
  const payload = getItemHoverPayload(item, event)
  if (!payload) return
  props.onItemHoverStart?.(payload, event)
}

const openItem = async (item: Item) => {
  if (!item.docId) return
  await openDocumentAtLine(item.docId, item.lineNumber, item.blockId)
}

const handleItemPreviewClick = (item: Item, event: MouseEvent) => {
  if (props.previewTriggerMode !== 'click') {
    openItem(item)
    return
  }

  const payload = getItemHoverPayload(item, event)
  if (!payload) return

  event.preventDefault()
  event.stopPropagation()
  props.onItemPreviewClick?.(payload, event)
}

function shouldSuppressHoverEndForAnchor(anchorEl: HTMLElement, event: MouseEvent) {
  const relatedTarget = event.relatedTarget
  if (relatedTarget instanceof Node && anchorEl.contains(relatedTarget)) {
    return true
  }

  const anchorRect = anchorEl.getBoundingClientRect()
  return (
    !!relatedTarget
    && event.clientX >= anchorRect.left
    && event.clientX <= anchorRect.right
    && event.clientY >= anchorRect.top
    && event.clientY <= anchorRect.bottom
  )
}

function shouldSuppressHoverEndAfterFrame(anchorEl: HTMLElement, event: MouseEvent) {
  if (anchorEl.matches(':hover')) {
    return true
  }

  const elementUnderPointer = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(event.clientX, event.clientY)
    : null
  if (elementUnderPointer instanceof Node && anchorEl.contains(elementUnderPointer)) {
    return true
  }

  return (
    elementUnderPointer instanceof HTMLElement
    && !!elementUnderPointer.closest('.block__popover')
  )
}

const handleItemHoverEnd = (item: Item, event: MouseEvent) => {
  if (props.previewTriggerMode !== 'hover') return
  const payload = getItemHoverPayload(item, event)
  if (!payload) return

  if (shouldSuppressHoverEndForAnchor(payload.anchorEl, event)) {
    return
  }

  window.requestAnimationFrame(() => {
    if (shouldSuppressHoverEndAfterFrame(payload.anchorEl, event)) {
      return
    }

    props.onItemHoverEnd?.(payload, event)
  })
}

const openDetail = (item: Item) => {
  showItemDetailModal(item)
}

// 在日历中打开（afterOpen 会 emit CALENDAR_NAVIGATE，无需重复）
const openCalendar = (item: Item) => {
  if (plugin && (plugin as any).openCustomTab) {
    (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date })
  }
}

// 迁移到自定义日期
const handleMigrateCustom = (item: Item) => {
  if (!item.blockId) return
  if (isProcessing.value) return // 防止重复点击

  showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
    if (isProcessing.value) return // 防止在回调中重复点击
    isProcessing.value = true
    try {
      await migrateItemToDate(item, newDate)
    } finally {
      isProcessing.value = false
    }
  })
}

// 跳过当前重复事项
async function handleSkipOccurrence(item: Item) {
  if (isProcessing.value) return
  if (!item.repeatRule || !item.blockId) return
  isProcessing.value = true
  try {
    await skipCurrentOccurrence(plugin as any, item)
  } finally {
    isProcessing.value = false
  }
}

// 右键菜单处理
const handleContextMenu = (event: MouseEvent, item: Item) => {
  const menuOptions = createItemMenu(
    {
      id: item.id,
      content: item.content,
      date: item.date,
      blockId: item.blockId,
      docId: item.docId,
      lineNumber: item.lineNumber,
      status: item.status,
      task: item.task,
    },
    {
      onComplete: () => {
        if (isProcessing.value) return
        isProcessing.value = true
        completeItem(item).finally(() => {
          isProcessing.value = false
        })
      },
      onStartPomodoro: () => {
        if (isProcessing.value) return
        if (!item.blockId) return
        showPomodoroTimerDialog(item.blockId)
      },
      onMigrateToday: () => {
        if (isProcessing.value) return
        isProcessing.value = true
        migrateItemToToday(item).finally(() => {
          isProcessing.value = false
        })
      },
      onMigrateTomorrow: () => {
        if (isProcessing.value) return
        isProcessing.value = true
        migrateItem(item).finally(() => {
          isProcessing.value = false
        })
      },
      onMigrateCustom: () => {
        if (isProcessing.value) return
        handleMigrateCustom(item)
      },
      onAbandon: () => {
        if (isProcessing.value) return
        isProcessing.value = true
        abandonItem(item).finally(() => {
          isProcessing.value = false
        })
      },
      onOpenDoc: () => openItem(item),
      onShowDetail: () => openDetail(item),
      onShowCalendar: () => openCalendar(item),
      onSetPriority: (priority: PriorityLevel | undefined) => {
        if (!item.blockId) return
        writeBlock({ blockId: item.blockId }, {
          type: 'setPriority',
          priority,
        }).then((success) => {
          if (success) {
            item.priority = priority
          }
        })
      },
    },
    {
      showCalendarMenu: true,
      isFocusing: pomodoroStore.isFocusing,
    },
  )

  menuOptions.x = event.clientX
  menuOptions.y = event.clientY
  showContextMenu(menuOptions)
}

// 恢复番茄钟状态
const restorePomodoroState = async () => {
  if (!plugin) return
  if (pomodoroStore.isFocusing) return // 已经有专注状态，不需要恢复

  console.log('[TodoSidebar] 尝试恢复番茄钟状态')
  const restored = await pomodoroStore.restorePomodoro(plugin)
  if (restored) {
    console.log('[TodoSidebar] 番茄钟状态已恢复')
  }
}

// 监听番茄钟恢复事件
let unsubscribePomodoroRestore: (() => void) | null = null

onMounted(async () => {
  // 恢复番茄钟状态
  await restorePomodoroState()

  // 监听番茄钟恢复事件（跨上下文）
  unsubscribePomodoroRestore = eventBus.on(Events.POMODORO_RESTORE, async (data) => {
    console.log('[TodoSidebar] 收到番茄钟恢复事件', data)
    if (!pomodoroStore.isFocusing && plugin) {
      await pomodoroStore.restorePomodoro(plugin)
    }
  })
})

onUnmounted(() => {
  if (unsubscribePomodoroRestore) {
    unsubscribePomodoroRestore()
  }
})

// 创建示例文档
const handleCreateExample = async () => {
  if (isProcessing.value) return
  isProcessing.value = true
  try {
    await createExampleDocument()
    // 新文档创建成功，等待 ws-main 事件触发刷新
  } finally {
    isProcessing.value = false
  }
}
</script>

<style lang="scss" scoped>
.todo-sidebar {
  width: 100%;
  height: 100%;
  min-height: 0;

  &--embedded {
    height: 100%;
    min-height: 0;
  }

  &--embedded .todo-content {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
    scrollbar-gutter: stable;
  }
}

.todo-content {
  padding: 8px;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 13px;
}

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: var(--b3-theme-on-surface);

  .empty-guide-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.4;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }

  .empty-guide-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--b3-theme-on-background);
  }

  .empty-guide-desc {
    font-size: 13px;
    opacity: 0.7;
    margin-bottom: 20px;
    line-height: 1.5;
    max-width: 240px;
  }

  .empty-guide-actions {
    .b3-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
    }
  }
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-date-group {
  .date-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    margin-bottom: 8px;
    padding-left: 4px;
  }
}

.todo-section {
  margin-top: 0;
  padding-top: 0;
  border-top: none;

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    opacity: 0.7;
    margin-bottom: 8px;
    padding-left: 4px;
    display: flex;
    align-items: center;
    gap: 4px;

    &.clickable {
      cursor: pointer;
      user-select: none;

      &:hover {
        opacity: 1;
        color: var(--b3-theme-primary);
      }
    }

    .collapse-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;

      svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
    }
  }
}

.todo-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-header-left {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  height: 20px;
  line-height: 20px;
}

.item-header-right {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 50%;
}

.item-focus-plan-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  cursor: help;
  flex-shrink: 0;
}

.item-project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  flex-shrink: 0;
}

.item-time {
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}

.item-priority {
  flex-shrink: 0;
  cursor: help;
}

.item-task {
  width: 100%;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  word-break: break-all;
  line-height: 1.3;
  margin: 2px 0;
}

.item-content {
  width: 100%;
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-all;
  line-height: 1.4;
}

.item-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.item-tag-chip {
  border: none;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  opacity: 0.82;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;

  &:hover {
    opacity: 1;
    color: var(--b3-theme-primary);
  }

  &--active {
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
    opacity: 1;
  }
}

.todo-card--drag-source {
  cursor: grab;
}
</style>
