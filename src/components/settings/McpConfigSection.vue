<template>
  <SySettingsSection
    :title="(t('settings') as any).mcp?.title ?? 'MCP 配置'"
    :description="(t('settings') as any).mcp?.description ?? '将任务数据暴露给 Cursor、Claude 等 AI 助手'"
  >
    <SySettingsActionButton
      :text="(t('settings') as any).mcp?.copyButton ?? '复制 MCP 配置'"
      @click="copyMcpConfig"
    />
  </SySettingsSection>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan';
import { getWorkspaceInfo } from '@/api';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingsActionButton from './SySettingsActionButton.vue';

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
