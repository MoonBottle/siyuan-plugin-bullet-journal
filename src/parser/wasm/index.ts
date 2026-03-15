/**
 * WASM Parser 包装层
 * 提供与原有 TypeScript Parser 兼容的接口
 */

import init, {
  parse_kramdown as wasmParseKramdown,
  strip_list_and_block_attr as wasmStripListAndBlockAttr,
  parse_block_refs as wasmParseBlockRefs,
  health_check as wasmHealthCheck,
} from './pkg';
import type { Project, Link } from '@/types/models';

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 初始化 WASM 模块
 * 幂等操作，多次调用只会初始化一次
 */
export async function initWasm(): Promise<void> {
  if (wasmInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = init()
    .then(() => {
      wasmInitialized = true;
    })
    .catch((err) => {
      console.error('WASM initialization failed:', err);
      throw err;
    });

  return initPromise;
}

/**
 * 检查 WASM 是否已初始化
 */
export function isWasmInitialized(): boolean {
  return wasmInitialized;
}

/**
 * 测试 WASM 解析器是否可用
 */
export async function healthCheck(): Promise<boolean> {
  await initWasm();
  return wasmHealthCheck();
}

/**
 * 解析 Kramdown 内容为 Project
 * @param kramdown - Kramdown 格式文本
 * @param docId - 文档 ID
 * @returns Project 对象，解析失败返回 null
 */
export async function parseKramdown(
  kramdown: string,
  docId: string
): Promise<Project | null> {
  await initWasm();
  const result = wasmParseKramdown(kramdown, docId);
  return result ? (result as unknown as Project) : null;
}

/**
 * 同步解析 Kramdown（需确保已初始化）
 * @param kramdown - Kramdown 格式文本
 * @param docId - 文档 ID
 * @returns Project 对象，解析失败返回 null
 */
export function parseKramdownSync(
  kramdown: string,
  docId: string
): Project | null {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initWasm() first.');
  }
  const result = wasmParseKramdown(kramdown, docId);
  return result ? (result as unknown as Project) : null;
}

/**
 * 去除列表标记和块属性
 * @param line - 输入行
 * @returns 处理后的字符串
 */
export function stripListAndBlockAttr(line: string): string {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initWasm() first.');
  }
  return wasmStripListAndBlockAttr(line);
}

/**
 * 异步去除列表标记和块属性
 * @param line - 输入行
 * @returns 处理后的字符串
 */
export async function stripListAndBlockAttrAsync(line: string): Promise<string> {
  await initWasm();
  return wasmStripListAndBlockAttr(line);
}

/**
 * 解析块引用
 * @param line - 输入行
 * @returns 解析结果和链接列表
 */
export async function parseBlockRefs(line: string): Promise<{ result: string; links: Link[] }> {
  await initWasm();
  const result = wasmParseBlockRefs(line);
  return result as unknown as { result: string; links: Link[] };
}

/**
 * 同步解析块引用（需确保已初始化）
 * @param line - 输入行
 * @returns 解析结果和链接列表
 */
export function parseBlockRefsSync(line: string): { result: string; links: Link[] } {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initWasm() first.');
  }
  const result = wasmParseBlockRefs(line);
  return result as unknown as { result: string; links: Link[] };
}

// 重新导出类型
export type { Project, Link };
