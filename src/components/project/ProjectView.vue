<template>
  <div class="project-view">
    <div v-if="projects.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </div>
      <h3>暂无项目数据</h3>
      <p class="hint">请在设置中配置笔记本目录</p>
      <p class="hint">项目文档需放置在 <code>工作安排/YYYY/项目/</code> 目录下</p>
    </div>

    <div v-else class="project-grid">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-card"
        @click="handleClick(project)"
      >
        <div class="project-header">
          <h3 class="project-name">{{ project.name }}</h3>
          <span class="task-count">{{ project.tasks.length }} 个任务</span>
        </div>

        <p v-if="project.description" class="project-desc">
          {{ project.description }}
        </p>

        <div class="project-stats">
          <div class="stat">
            <span class="stat-value">{{ getTaskCountByLevel(project, 'L1') }}</span>
            <span class="stat-label">L1</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ getTaskCountByLevel(project, 'L2') }}</span>
            <span class="stat-label">L2</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ getTaskCountByLevel(project, 'L3') }}</span>
            <span class="stat-label">L3</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ getItemCount(project) }}</span>
            <span class="stat-label">事项</span>
          </div>
        </div>

        <div v-if="project.links && project.links.length > 0" class="project-links">
          <a
            v-for="link in project.links.slice(0, 2)"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="project-link"
            @click.stop
          >
            {{ link.name }}
          </a>
          <span v-if="project.links.length > 2" class="more-links">
            +{{ project.links.length - 2 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Project, Task } from '@/types/models';

interface Props {
  projects: Project[];
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'project-click', project: Project): void;
}>();

const handleClick = (project: Project) => {
  emit('project-click', project);
};

const getTaskCountByLevel = (project: Project, level: string): number => {
  return project.tasks.filter((t: Task) => t.level === level).length;
};

const getItemCount = (project: Project): number => {
  return project.tasks.reduce((sum: number, task: Task) => sum + task.items.length, 0);
};
</script>

<style lang="scss" scoped>
.project-view {
  height: 100%;
  overflow: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;

  .empty-icon {
    margin-bottom: 16px;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 500;
  }

  .hint {
    margin: 0 0 4px 0;
    font-size: 13px;
  }

  code {
    background: var(--b3-theme-surface);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.project-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  flex: 1;
  word-break: break-all;
}

.task-count {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  white-space: nowrap;
  margin-left: 8px;
}

.project-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--b3-border-color);
  border-bottom: 1px solid var(--b3-border-color);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;

  .stat-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .stat-label {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }
}

.project-links {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-link {
  font-size: 12px;
  color: var(--b3-theme-primary);
  text-decoration: none;
  padding: 2px 8px;
  background: var(--b3-theme-primary-lightest, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1));
  border-radius: 4px;

  &:hover {
    text-decoration: underline;
  }
}

.more-links {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}
</style>
