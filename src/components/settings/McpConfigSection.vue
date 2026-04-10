<template>
  <!-- Desktop Version -->
  <template v-if="!isMobile">
    <SySettingsSection
      icon="iconLink"
      :title="(t('settings') as any).mcp?.title ?? 'MCP 配置'"
      :description="(t('settings') as any).mcp?.description ?? '将任务数据暴露给 Cursor、Claude 等 AI 助手'"
    >
      <SySettingsActionButton
        icon="iconCopy"
        :text="(t('settings') as any).mcp?.copyButton ?? '复制 MCP 配置'"
        @click="copyMcpConfig"
      />
    </SySettingsSection>
  </template>

  <!-- iOS Mobile Version -->
  <template v-else>
    <div class="ios-settings-content">
      <div class="ios-group-header">
        <div class="header-icon">🔗</div>
        <div class="header-info">
          <div class="header-title">{{ (t('settings') as any).mcp?.title ?? 'MCP 配置' }}</div>
          <div class="header-desc">{{ (t('settings') as any).mcp?.description ?? '将任务数据暴露给 Cursor、Claude 等 AI 助手' }}</div>
        </div>
      </div>

      <div class="ios-group">
        <div class="ios-card">
          <div class="ios-cell ios-cell-info">
            <div class="info-icon">💡</div>
            <div class="info-text">{{ (t('settings') as any).mcp?.mobileHint ?? 'MCP 配置需要在桌面端复制后使用' }}</div>
          </div>
        </div>
        <button class="ios-action-btn" @click="copyMcpConfig">
          <svg><use xlink:href="#iconCopy"></use></svg>
          {{ (t('settings') as any).mcp?.copyButton ?? '复制 MCP 配置' }}
        </button>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan';
import { getWorkspaceInfo } from '@/api';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';

defineProps<{
  isMobile?: boolean;
}>();

async function copyMcpConfig() {
  const workspaceInfo = await getWorkspaceInfo();
  const workspacePath = workspaceInfo?.workspaceDir ?? '';
  if (!workspacePath) {
    showMessage((t('settings') as any).mcp?.workspaceUnavailable ?? '无法获取工作空间路径，请使用思源桌面版', 4000, 'error');
    return;
  }

  const base = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const mcpPath = `${base}/data/plugins/siyuan-plugin-bullet-journal/mcp-server.js`;

  const mcpConfig = {
    mcpServers: {
      'sy-task-assistant': {
        command: 'node',
        args: [mcpPath],
        env: {
          SIYUAN_TOKEN: '{请从思源 设置→关于 获取 API Token}',
          SIYUAN_API_URL: 'http://127.0.0.1:6806'
        }
      }
    }
  };

  const configStr = JSON.stringify(mcpConfig, null, 2);
  try {
    await navigator.clipboard.writeText(configStr);
    showMessage((t('settings') as any).mcp?.copySuccess ?? 'MCP 配置已复制到剪贴板', 3000, 'info');
  } catch (err) {
    showMessage((t('settings') as any).mcp?.copyFailed ?? '复制失败，请手动复制', 3000, 'error');
  }
}
</script>

<style scoped>
/* Desktop styles */

/* iOS Mobile Styles */
.ios-settings-content {
  padding: 0 16px 32px;
}

.ios-group-header {
  display: flex;
  gap: 12px;
  padding: 16px 0 20px;
}

.ios-group-header .header-icon {
  font-size: 36px;
}

.ios-group-header .header-info {
  flex: 1;
}

.ios-group-header .header-title {
  font-size: 20px;
  font-weight: 600;
  color: #000;
  margin-bottom: 4px;
}

.ios-group-header .header-desc {
  font-size: 14px;
  color: #6c6c70;
  line-height: 1.4;
}

.ios-group {
  margin-bottom: 20px;
}

.ios-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}

.ios-cell {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  min-height: 44px;
}

.ios-cell-info {
  gap: 12px;
}

.ios-cell-info .info-icon {
  font-size: 20px;
}

.ios-cell-info .info-text {
  flex: 1;
  font-size: 15px;
  color: #000;
  line-height: 1.4;
}

.ios-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #007aff;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.ios-action-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.ios-action-btn:active {
  opacity: 0.9;
}
</style>
