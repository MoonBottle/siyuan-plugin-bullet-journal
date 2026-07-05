# 修复 `siyuanKernel.d.ts` 模块声明导致 `showMessage` 等导出不可见的问题

## 根因分析

### 问题现象
TypeScript 报错：模块 `"siyuan"` 没有导出的成员 `showMessage`。

### 根本原因
[siyuanKernel.d.ts:20](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/types/siyuanKernel.d.ts#L20) 中使用了 `declare module 'siyuan'` 语法。在 TypeScript 中，**如果一个 `.d.ts` 文件中存在 `declare module 'X'` 声明，且该文件不是通过 `import`/`export` 声明的模块文件，那么这个 `declare module` 会创建一个** **全新的模块定义**，而不是对已有模块的增强（augmentation）。

具体来说：
1. `siyuanKernel.d.ts` 是一个**脚本文件**（没有顶层的 `import` 或 `export`）
2. 脚本文件中的 `declare module 'siyuan'` 会**完全覆盖** `node_modules/siyuan/siyuan.d.ts` 中对 `siyuan` 模块的原始类型定义
3. 覆盖后，`siyuan` 模块只剩下 `Plugin.kernel?: IKernelPlugin` 这一个成员
4. 因此所有从 `siyuan` 导入的 `showMessage`、`Menu`、`Dialog`、`openTab` 等都报"不存在"的错误

### 正确做法
要实现**模块增强**（module augmentation），`.d.ts` 文件必须是一个**模块文件**（有顶层的 `import` 或 `export`）。这样 TypeScript 才会将 `declare module 'siyuan'` 理解为对已有 `siyuan` 模块的**补充**，而非**替换**。

## 修复方案

### 修改文件
`src/types/siyuanKernel.d.ts`

### 具体改动
在文件顶部添加一个 `export {}` 语句，将文件从**脚本**转变为**模块**：

```diff
+ export {}

type TKernelPluginState = -1 | 0 | 1 | 2 | 3 | 4 | 5
```

这样 `declare module 'siyuan'` 就变成了模块增强（augmentation），而不是模块覆盖。`siyuan` 模块原有的所有导出（`showMessage`、`Menu`、`Dialog` 等）都会保留，同时 `Plugin.kernel` 属性也会被正确添加。

### 影响范围
- 仅修改一个文件，一行代码
- 不影响任何运行时行为
- 修复后所有从 `siyuan` 导入的成员（约 40+ 处引用）将不再报类型错误

## 验证步骤
1. 修改后运行 `npm run build` 确认无类型错误
2. 运行 `npm run lint` 确认无 lint 问题
