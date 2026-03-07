/**
 * MCP 配置加载与类型定义
 */
import { SiYuanClient } from './siyuan-client';
import type { ProjectGroup, ProjectDirectory } from '@/types/models';

export const PLUGIN_NAME = 'siyuan-plugin-bullet-journal';

export interface PluginSettings {
  directories?: ProjectDirectory[];
  groups?: ProjectGroup[];
}

/**
 * 仅通过思源 API 读取插件配置。
 * saveData 存储：/data/storage/petal/{pluginName}/settings（无扩展名）
 */
export async function loadPluginSettingsFromSiYuan(
  client: SiYuanClient,
  pluginName: string
): Promise<PluginSettings> {
  const path = `/data/storage/petal/${pluginName}/settings`;
  const raw = await client.getFile(path);
  if (raw == null || raw === '') {
    console.error('[Task Assistant MCP] Failed to load settings from SiYuan API (path:', path, ')');
    return { directories: [], groups: [] };
  }
  try {
    const parsed = JSON.parse(raw) as PluginSettings;
    const result = {
      directories: Array.isArray(parsed.directories) ? parsed.directories : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : []
    };
    console.error('[Task Assistant MCP] 配置已加载:', JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    console.error('[Task Assistant MCP] Failed to parse settings JSON:', e);
    return { directories: [], groups: [] };
  }
}
