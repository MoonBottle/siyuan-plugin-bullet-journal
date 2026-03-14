# 文档迁移计划

## 目标
将 `CHANGELOG.md`、`CONTRIBUTING.md` 移动到用户指南目录下，增加英文版，并更新相关链接。

## 当前结构分析

### 根目录文件
- `CHANGELOG.md` - 更新日志（中文）
- `CONTRIBUTING.md` - 参与贡献（中文）

### docs 目录结构
```
docs/
├── API/                    # API 文档（保持不动）
├── article/                # 文章目录（保持不动）
├── en/user-guide/          # 英文用户指南
├── user-guide/             # 中文用户指南
└── prd/                    # PRD 文档（保持不动）
```

## 计划步骤

### 步骤 1: 移动 CHANGELOG.md
- **源**: `CHANGELOG.md` (根目录)
- **目标**: 
  - `docs/user-guide/changelog.md` (中文)
  - `docs/en/user-guide/changelog.md` (英文 - 需要翻译)

### 步骤 2: 移动 CONTRIBUTING.md
- **源**: `CONTRIBUTING.md` (根目录)
- **目标**: 
  - `docs/user-guide/contributing.md` (中文)
  - `docs/en/user-guide/contributing.md` (英文 - 需要翻译)

### 步骤 3: 更新用户指南索引
更新以下文件，添加新文档的链接：
- `docs/user-guide/index.md`
- `docs/en/user-guide/index.md`

### 步骤 4: 更新根目录 README 链接
- `README.md` - 更新英文版中的文档链接
- `README_zh_CN.md` - 更新中文版中的文档链接

## 详细任务列表

1. **移动 CHANGELOG.md**
   - [ ] 复制 `CHANGELOG.md` 到 `docs/user-guide/changelog.md`
   - [ ] 翻译并创建 `docs/en/user-guide/changelog.md`

2. **移动 CONTRIBUTING.md**
   - [ ] 复制 `CONTRIBUTING.md` 到 `docs/user-guide/contributing.md`
   - [ ] 翻译并创建 `docs/en/user-guide/contributing.md`

3. **更新用户指南索引**
   - [ ] 更新 `docs/user-guide/index.md`，添加：
     - 更新日志链接
     - 参与贡献链接
   - [ ] 更新 `docs/en/user-guide/index.md`，添加：
     - Changelog link
     - Contributing link

4. **更新 README 链接**
   - [ ] 更新 `README.md` 中的文档链接
   - [ ] 更新 `README_zh_CN.md` 中的文档链接

5. **清理旧文件**
   - [ ] 删除根目录 `CHANGELOG.md`
   - [ ] 删除根目录 `CONTRIBUTING.md`
