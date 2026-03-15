use crate::models::*;
use crate::parser::line_parser::LineParser;
use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    // 匹配列表标记和块属性: - {: id="xxx"} 或 1. {: id="xxx"}
    static ref LIST_BLOCK_ATTR_RE: Regex = Regex::new(
        r"^(?:[-*]|\d+\.)\s*(\{\s*:[^}]*\}\s*)?"
    ).unwrap();

    // 匹配块属性行: {: id="xxx" type="doc"}
    static ref BLOCK_ATTR_LINE_RE: Regex = Regex::new(
        r"^\{\s*:([^}]*)\}"
    ).unwrap();

    // 匹配无序列表任务行
    static ref UNORDERED_TASK_RE: Regex = Regex::new(
        r"^\s*[-*]\s*(?:\[([ xX])\]\s+)?(.*)$"
    ).unwrap();

    // 匹配有序列表任务行
    static ref ORDERED_TASK_RE: Regex = Regex::new(
        r"^\s*\d+\.\s*(?:\[([ xX])\]\s+)?(.*)$"
    ).unwrap();

    // 匹配无序列表事项行
    static ref UNORDERED_ITEM_RE: Regex = Regex::new(
        r"^\s*[-*]\s*(.*)$"
    ).unwrap();

    // 匹配有序列表事项行
    static ref ORDERED_ITEM_RE: Regex = Regex::new(
        r"^\s*\d+\.\s*(.*)$"
    ).unwrap();

    // 匹配项目标题
    static ref PROJECT_TITLE_RE: Regex = Regex::new(
        r"^##\s+(.+)$"
    ).unwrap();

    // 匹配任务标签
    static ref TASK_TAG_RE: Regex = Regex::new(
        r"#任务#"
    ).unwrap();

    // 匹配番茄钟行
    static ref POMODORO_RE: Regex = Regex::new(
        r"^\s*(?:[-*]|\d+\.)\s*\[([ xX])\]\s*番茄钟[:：]"
    ).unwrap();
}

/// 去除列表标记和块属性
pub fn strip_list_and_block_attr(line: &str) -> String {
    let result = LIST_BLOCK_ATTR_RE.replace(line, "");
    result.trim().to_string()
}

/// 解析 Kramdown 块属性
pub fn parse_block_attrs(line: &str) -> BlockAttr {
    let mut attr = BlockAttr::default();

    if let Some(caps) = BLOCK_ATTR_LINE_RE.captures(line) {
        let content = caps.get(1).map(|m| m.as_str()).unwrap_or("");

        // 解析 id
        if let Some(id_caps) = Regex::new(r#"id\s*=\s*"([^"]*)""#).unwrap().captures(content) {
            attr.id = id_caps.get(1).map(|m| m.as_str().to_string());
        }

        // 解析 type
        if let Some(type_caps) = Regex::new(r#"type\s*=\s*"([^"]*)""#).unwrap().captures(content) {
            attr.block_type = type_caps.get(1).map(|m| m.as_str().to_string());
        }

        // 解析 updated
        if let Some(updated_caps) = Regex::new(r#"updated\s*=\s*"([^"]*)""#).unwrap().captures(content) {
            attr.updated = updated_caps.get(1).map(|m| m.as_str().to_string());
        }

        // 解析 created
        if let Some(created_caps) = Regex::new(r#"created\s*=\s*"([^"]*)""#).unwrap().captures(content) {
            attr.created = created_caps.get(1).map(|m| m.as_str().to_string());
        }
    }

    attr
}

/// 解析 Kramdown 为块列表
pub fn parse_kramdown_blocks(kramdown: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let lines: Vec<&str> = kramdown.lines().collect();
    let mut i = 0;
    let mut line_number = 1;

    while i < lines.len() {
        let line = lines[i];

        // 跳过空行
        if line.trim().is_empty() {
            i += 1;
            line_number += 1;
            continue;
        }

        // 检查是否是块属性行
        if BLOCK_ATTR_LINE_RE.is_match(line) {
            let attr = parse_block_attrs(line);
            blocks.push(Block {
                content: line.to_string(),
                line_number,
                block_id: attr.id,
            });
            i += 1;
            line_number += 1;
            continue;
        }

        // 收集连续的非空行作为一个块
        let mut content_lines = vec![line];
        let start_line_number = line_number;
        i += 1;
        line_number += 1;

        // 查找当前块的块属性（下一行）
        let mut block_id = None;
        if i < lines.len() && BLOCK_ATTR_LINE_RE.is_match(lines[i]) {
            let attr = parse_block_attrs(lines[i]);
            block_id = attr.id;
            // 块属性行作为独立块
            blocks.push(Block {
                content: lines[i].to_string(),
                line_number,
                block_id: block_id.clone(),
            });
            i += 1;
            line_number += 1;
        }

        // 继续收集属于同一块的内容（缩进的行）
        while i < lines.len() {
            let next_line = lines[i];
            if next_line.trim().is_empty() {
                break;
            }
            // 如果是新的列表项或标题，结束当前块
            if next_line.trim().starts_with("- ")
                || next_line.trim().starts_with("* ")
                || next_line.trim().starts_with("## ")
                || Regex::new(r"^\d+\.").unwrap().is_match(next_line.trim())
            {
                break;
            }
            content_lines.push(next_line);
            i += 1;
            line_number += 1;
        }

        blocks.push(Block {
            content: content_lines.join("\n"),
            line_number: start_line_number,
            block_id,
        });
    }

    blocks
}

/// 主解析函数：解析 Kramdown 为 Project
pub fn parse_kramdown(kramdown: &str, doc_id: &str) -> Option<Project> {
    let blocks = parse_kramdown_blocks(kramdown);
    if blocks.is_empty() {
        return None;
    }

    let mut project = Project {
        id: doc_id.to_string(),
        path: doc_id.to_string(),
        ..Default::default()
    };

    let mut current_task: Option<Task> = None;
    let mut i = 0;

    while i < blocks.len() {
        let block = &blocks[i];
        let line = block.content.trim();

        // 解析项目标题
        if let Some(caps) = PROJECT_TITLE_RE.captures(line) {
            project.name = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

            // 检查下一行是否是项目块属性
            if i + 1 < blocks.len() {
                let next_block = &blocks[i + 1];
                if BLOCK_ATTR_LINE_RE.is_match(&next_block.content) {
                    let attr = parse_block_attrs(&next_block.content);
                    if let Some(block_type) = &attr.block_type {
                        if block_type == "doc" {
                            project.description = project.name.clone();
                        }
                    }
                    if let Some(id) = attr.id {
                        project.id = id;
                    }
                    i += 1; // 跳过块属性行
                }
            }
            i += 1;
            continue;
        }

        // 解析任务行
        let is_task = TASK_TAG_RE.is_match(line)
            || (UNORDERED_TASK_RE.is_match(line) && line.contains("#任务#"))
            || (ORDERED_TASK_RE.is_match(line) && line.contains("#任务#"));

        if is_task {
            // 保存当前任务
            if let Some(task) = current_task.take() {
                project.tasks.push(task);
            }

            let stripped = strip_list_and_block_attr(line);
            let parser = LineParser::new(&stripped);

            if let Some(parsed_task) = parser.parse_task_line() {
                let block_id = if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                    let attr = parse_block_attrs(&blocks[i + 1].content);
                    attr.id
                } else {
                    None
                };

                current_task = Some(Task {
                    id: parsed_task.name.clone(),
                    name: parsed_task.name,
                    level: parsed_task.level,
                    date: parsed_task.date,
                    start_date_time: parsed_task.start_date_time,
                    end_date_time: parsed_task.end_date_time,
                    links: if parsed_task.links.is_empty() { None } else { Some(parsed_task.links) },
                    items: Vec::new(),
                    line_number: block.line_number,
                    block_id,
                    doc_id: Some(doc_id.to_string()),
                    ..Default::default()
                });

                // 如果下一行是块属性，跳过
                if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                    i += 1;
                }
            }
            i += 1;
            continue;
        }

        // 解析事项行
        let is_item = UNORDERED_ITEM_RE.is_match(line) || ORDERED_ITEM_RE.is_match(line);

        if is_item && !is_task {
            let stripped = strip_list_and_block_attr(line);

            // 检查是否是番茄钟行
            if POMODORO_RE.is_match(line) {
                let parser = LineParser::new(&stripped);
                if let Some(pomodoro) = parser.parse_pomodoro_line() {
                    let record = PomodoroRecord {
                        id: format!("{}-pomodoro-{}-{}-{}", doc_id, pomodoro.date, pomodoro.start_time, block.line_number),
                        date: pomodoro.date,
                        start_time: pomodoro.start_time,
                        end_time: pomodoro.end_time,
                        description: pomodoro.description,
                        duration_minutes: pomodoro.duration_minutes,
                        actual_duration_minutes: pomodoro.actual_duration_minutes,
                        block_id: if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                            parse_block_attrs(&blocks[i + 1].content).id
                        } else {
                            None
                        },
                        status: pomodoro.status,
                        item_content: pomodoro.item_content,
                        project_id: Some(project.id.clone()),
                        task_id: current_task.as_ref().map(|t| t.id.clone()),
                        item_id: None,
                        ..Default::default()
                    };

                    // 添加到当前任务或项目
                    if let Some(ref mut task) = current_task {
                        if task.pomodoros.is_none() {
                            task.pomodoros = Some(Vec::new());
                        }
                        task.pomodoros.as_mut().unwrap().push(record);
                    } else {
                        if project.pomodoros.is_none() {
                            project.pomodoros = Some(Vec::new());
                        }
                        project.pomodoros.as_mut().unwrap().push(record);
                    }
                }

                if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                    i += 1;
                }
                i += 1;
                continue;
            }

            // 解析普通事项
            let parser = LineParser::new(&stripped);
            if let Some(parsed_item) = parser.parse_item_line() {
                let block_id = if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                    let attr = parse_block_attrs(&blocks[i + 1].content);
                    attr.id
                } else {
                    None
                };

                // 为每个日期创建一个 Item
                for (idx, item_date) in parsed_item.dates.iter().enumerate() {
                    let item = Item {
                        id: format!("{}-item-{}", doc_id, block.line_number + idx as i32),
                        content: parsed_item.content.clone(),
                        date: item_date.date.clone(),
                        start_date_time: item_date.start_date_time.clone(),
                        end_date_time: item_date.end_date_time.clone(),
                        line_number: block.line_number,
                        doc_id: doc_id.to_string(),
                        block_id: block_id.clone(),
                        status: parsed_item.status.clone(),
                        links: if parsed_item.links.is_empty() { None } else { Some(parsed_item.links.clone()) },
                        sibling_items: if parsed_item.dates.len() > 1 {
                            Some(
                                parsed_item.dates.iter().map(|d| SiblingItem {
                                    date: d.date.clone(),
                                    start_date_time: d.start_date_time.clone(),
                                    end_date_time: d.end_date_time.clone(),
                                }).collect()
                            )
                        } else {
                            None
                        },
                        date_range_start: None,
                        date_range_end: None,
                        ..Default::default()
                    };

                    if let Some(ref mut task) = current_task {
                        task.items.push(item);
                    }
                    // 事项不在项目级别存储
                }

                if i + 1 < blocks.len() && BLOCK_ATTR_LINE_RE.is_match(&blocks[i + 1].content) {
                    i += 1;
                }
            }
            i += 1;
            continue;
        }

        i += 1;
    }

    // 保存最后一个任务
    if let Some(task) = current_task {
        project.tasks.push(task);
    }

    Some(project)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_list_and_block_attr() {
        assert_eq!(
            strip_list_and_block_attr("- {: id=\"xxx\"}测试任务 #任务#"),
            "测试任务 #任务#"
        );
        assert_eq!(
            strip_list_and_block_attr("1. {: id=\"yyy\"}测试任务"),
            "测试任务"
        );
        assert_eq!(
            strip_list_and_block_attr("  - 带缩进的任务"),
            "带缩进的任务"
        );
        assert_eq!(
            strip_list_and_block_attr("普通文本"),
            "普通文本"
        );
    }

    #[test]
    fn test_parse_block_attrs() {
        let attr = parse_block_attrs("{: id=\"xxx\" type=\"doc\" updated=\"20240101\" created=\"20240101\"}");
        assert_eq!(attr.id, Some("xxx".to_string()));
        assert_eq!(attr.block_type, Some("doc".to_string()));
        assert_eq!(attr.updated, Some("20240101".to_string()));
        assert_eq!(attr.created, Some("20240101".to_string()));
    }

    #[test]
    fn test_parse_kramdown_blocks() {
        let kramdown = r#"## 测试项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }事项A @2024-01-01
{: id="after-i" }
"#;
        let blocks = parse_kramdown_blocks(kramdown);
        assert!(!blocks.is_empty());
        assert_eq!(blocks[0].line_number, 1);
    }
}
