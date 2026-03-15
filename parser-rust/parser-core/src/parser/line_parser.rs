use crate::models::*;
use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    // 匹配块引用: ((blockId)) 或 ((blockId "锚文本"))
    static ref BLOCK_REF_RE: Regex = Regex::new(
        r"\(\(([^)]+)\)"
    ).unwrap();

    // 匹配块引用（带锚文本）
    static ref BLOCK_REF_WITH_ANCHOR_RE: Regex = Regex::new(
        r"\(\((\d{14}-\w{7})\s+([\"'])([^\"']+)\2\)"
    ).unwrap();

    // 匹配块引用（无锚文本）
    static ref BLOCK_REF_SIMPLE_RE: Regex = Regex::new(
        r"\(\((\d{14}-\w{7})\)"
    ).unwrap();

    // 匹配任务级别: @L1, @L2, @L3
    static ref TASK_LEVEL_RE: Regex = Regex::new(
        r"@L([123])"
    ).unwrap();

    // 匹配日期: @YYYY-MM-DD
    static ref DATE_RE: Regex = Regex::new(
        r"@(\d{4}-\d{2}-\d{2})"
    ).unwrap();

    // 匹配日期时间: @YYYY-MM-DD HH:mm 或 @YYYY-MM-DD HH:mm-HH:mm
    static ref DATETIME_RE: Regex = Regex::new(
        r"@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?"
    ).unwrap();

    // 匹配日期范围: @YYYY-MM-DD~YYYY-MM-DD
    static ref DATE_RANGE_RE: Regex = Regex::new(
        r"@(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})"
    ).unwrap();

    // 匹配日期范围+时间: @YYYY-MM-DD~YYYY-MM-DD HH:mm-HH:mm
    static ref DATE_RANGE_TIME_RE: Regex = Regex::new(
        r"@(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})"
    ).unwrap();

    // 匹配多日期: @YYYY-MM-DD,YYYY-MM-DD 或 @YYYY-MM-DD，YYYY-MM-DD
    static ref MULTI_DATE_RE: Regex = Regex::new(
        r"@(\d{4}-\d{2}-\d{2}(?:[,，]\d{4}-\d{2}-\d{2})+)"
    ).unwrap();

    // 匹配状态标签: #done, #已完成, #abandoned, #已放弃
    static ref STATUS_TAG_RE: Regex = Regex::new(
        r"#(done|已完成|abandoned|已放弃)#"
    ).unwrap();

    // 匹配任务列表状态: [ ], [x], [X]
    static ref TASK_LIST_STATUS_RE: Regex = Regex::new(
        r"^\s*\[([ xX])\]"
    ).unwrap();

    // 匹配番茄钟: 番茄钟: YYYY-MM-DD HH:mm-HH:mm 描述
    static ref POMODORO_FULL_RE: Regex = Regex::new(
        r"番茄钟[:：]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})(?:\s+(.+))?"
    ).unwrap();

    // 匹配番茄钟（无描述）
    static ref POMODORO_NO_DESC_RE: Regex = Regex::new(
        r"番茄钟[:：]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})"
    ).unwrap();

    // 匹配番茄钟（无结束时间）
    static ref POMODORO_NO_END_RE: Regex = Regex::new(
        r"番茄钟[:：]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+(.+))?"
    ).unwrap();

    // 匹配实际时长: 实际XX分钟, 实际XX分, 实际XXmin
    static ref ACTUAL_DURATION_RE: Regex = Regex::new(
        r"实际\s*(\d+)\s*(?:分钟|分|min)"
    ).unwrap();

    // 匹配 URL
    static ref URL_RE: Regex = Regex::new(
        r"https?://[^\s\)]+"
    ).unwrap();
}

pub struct LineParser<'a> {
    line: &'a str,
}

impl<'a> LineParser<'a> {
    pub fn new(line: &'a str) -> Self {
        Self { line }
    }

    /// 解析块引用
    pub fn parse_block_refs(&self) -> (String, Vec<Link>) {
        let mut links = Vec::new();
        let mut result = self.line.to_string();

        // 匹配带锚文本的块引用
        for caps in BLOCK_REF_WITH_ANCHOR_RE.captures_iter(self.line) {
            let block_id = caps.get(1).unwrap().as_str();
            let anchor = caps.get(3).unwrap().as_str();
            let full_match = caps.get(0).unwrap().as_str();

            links.push(Link {
                name: anchor.to_string(),
                url: format!("siyuan://blocks/{}?focus=1", block_id),
            });

            result = result.replace(full_match, anchor);
        }

        // 匹配简单块引用
        for caps in BLOCK_REF_SIMPLE_RE.captures_iter(self.line) {
            let block_id = caps.get(1).unwrap().as_str();
            let full_match = caps.get(0).unwrap().as_str();

            links.push(Link {
                name: block_id.to_string(),
                url: format!("siyuan://blocks/{}?focus=1", block_id),
            });

            result = result.replace(full_match, "");
        }

        // 清理多余的空格
        result = Regex::new(r"\s+").unwrap().replace_all(&result, " ").to_string();
        result = result.trim().to_string();

        (result, links)
    }

    /// 解析任务行
    pub fn parse_task_line(&self) -> Option<ParsedTask> {
        let line = self.line.trim();
        if line.is_empty() {
            return None;
        }

        let mut parsed = ParsedTask::default();
        let mut content = line.to_string();

        // 解析块引用
        let (cleaned, links) = self.parse_block_refs();
        parsed.links = links;
        content = cleaned;

        // 解析任务级别
        if let Some(caps) = TASK_LEVEL_RE.captures(&content) {
            let level = caps.get(1).unwrap().as_str();
            parsed.level = format!("L{}", level);
            content = TASK_LEVEL_RE.replace(&content, "").to_string();
        } else {
            parsed.level = "L2".to_string(); // 默认级别
        }

        // 解析日期时间
        if let Some(caps) = DATETIME_RE.captures(&content) {
            let date = caps.get(1).unwrap().as_str();
            let start_time = caps.get(2).unwrap().as_str();
            parsed.date = Some(date.to_string());
            parsed.start_date_time = Some(format!("{} {}", date, start_time));

            if let Some(end_time) = caps.get(3) {
                parsed.end_date_time = Some(format!("{} {}", date, end_time.as_str()));
            }

            content = DATETIME_RE.replace(&content, "").to_string();
        } else if let Some(caps) = DATE_RE.captures(&content) {
            let date = caps.get(1).unwrap().as_str();
            parsed.date = Some(date.to_string());
            content = DATE_RE.replace(&content, "").to_string();
        }

        // 移除任务标签
        content = content.replace("#任务#", "");

        // 清理并设置任务名
        content = Regex::new(r"\s+").unwrap().replace_all(&content, " ").to_string();
        parsed.name = content.trim().to_string();

        if parsed.name.is_empty() {
            return None;
        }

        Some(parsed)
    }

    /// 解析事项行
    pub fn parse_item_line(&self) -> Option<ParsedItem> {
        let line = self.line.trim();
        if line.is_empty() {
            return None;
        }

        let mut parsed = ParsedItem::default();
        let mut content = line.to_string();

        // 解析状态（任务列表形式）
        if let Some(caps) = TASK_LIST_STATUS_RE.captures(&content) {
            let status = caps.get(1).unwrap().as_str();
            parsed.status = if status == " " {
                "pending".to_string()
            } else {
                "completed".to_string()
            };
            content = TASK_LIST_STATUS_RE.replace(&content, "").to_string();
        }

        // 解析状态标签
        if let Some(caps) = STATUS_TAG_RE.captures(&content) {
            let status = caps.get(1).unwrap().as_str();
            parsed.status = match status {
                "done" | "已完成" => "completed".to_string(),
                "abandoned" | "已放弃" => "abandoned".to_string(),
                _ => "pending".to_string(),
            };
            content = STATUS_TAG_RE.replace(&content, "").to_string();
        }

        // 如果还没有状态，默认为 pending
        if parsed.status.is_empty() {
            parsed.status = "pending".to_string();
        }

        // 解析块引用
        let (cleaned, links) = self.parse_block_refs();
        parsed.links = links;
        content = cleaned;

        // 解析日期范围+时间
        if let Some(caps) = DATE_RANGE_TIME_RE.captures(&content) {
            let start_date = caps.get(1).unwrap().as_str();
            let end_date = caps.get(2).unwrap().as_str();
            let start_time = caps.get(3).unwrap().as_str();
            let end_time = caps.get(4).unwrap().as_str();

            // 为范围内的每一天创建一个日期
            if let Ok(start) = chrono::NaiveDate::parse_from_str(start_date, "%Y-%m-%d") {
                if let Ok(end) = chrono::NaiveDate::parse_from_str(end_date, "%Y-%m-%d") {
                    let mut current = start;
                    while current <= end {
                        parsed.dates.push(ItemDate {
                            date: current.format("%Y-%m-%d").to_string(),
                            start_date_time: Some(format!("{} {}", current.format("%Y-%m-%d"), start_time)),
                            end_date_time: Some(format!("{} {}", current.format("%Y-%m-%d"), end_time)),
                        });
                        current = current.succ_opt().unwrap_or(current);
                    }
                }
            }

            content = DATE_RANGE_TIME_RE.replace(&content, "").to_string();
        }
        // 解析日期范围
        else if let Some(caps) = DATE_RANGE_RE.captures(&content) {
            let start_date = caps.get(1).unwrap().as_str();
            let end_date = caps.get(2).unwrap().as_str();

            if let Ok(start) = chrono::NaiveDate::parse_from_str(start_date, "%Y-%m-%d") {
                if let Ok(end) = chrono::NaiveDate::parse_from_str(end_date, "%Y-%m-%d") {
                    let mut current = start;
                    while current <= end {
                        parsed.dates.push(ItemDate {
                            date: current.format("%Y-%m-%d").to_string(),
                            start_date_time: None,
                            end_date_time: None,
                        });
                        current = current.succ_opt().unwrap_or(current);
                    }
                }
            }

            content = DATE_RANGE_RE.replace(&content, "").to_string();
        }
        // 解析多日期
        else if let Some(caps) = MULTI_DATE_RE.captures(&content) {
            let dates_str = caps.get(1).unwrap().as_str();
            let dates: Vec<&str> = dates_str.split(&[',', '，'][..]).collect();

            for date in dates {
                let date = date.trim();
                if !date.is_empty() {
                    parsed.dates.push(ItemDate {
                        date: date.to_string(),
                        start_date_time: None,
                        end_date_time: None,
                    });
                }
            }

            content = MULTI_DATE_RE.replace(&content, "").to_string();
        }
        // 解析日期时间
        else if let Some(caps) = DATETIME_RE.captures(&content) {
            let date = caps.get(1).unwrap().as_str();
            let start_time = caps.get(2).unwrap().as_str();

            parsed.dates.push(ItemDate {
                date: date.to_string(),
                start_date_time: Some(format!("{} {}", date, start_time)),
                end_date_time: caps.get(3).map(|t| format!("{} {}", date, t.as_str())),
            });

            content = DATETIME_RE.replace(&content, "").to_string();
        }
        // 解析简单日期
        else if let Some(caps) = DATE_RE.captures(&content) {
            let date = caps.get(1).unwrap().as_str();
            parsed.dates.push(ItemDate {
                date: date.to_string(),
                start_date_time: None,
                end_date_time: None,
            });
            content = DATE_RE.replace(&content, "").to_string();
        }

        // 清理并设置内容
        content = Regex::new(r"\s+").unwrap().replace_all(&content, " ").to_string();
        parsed.content = content.trim().to_string();

        if parsed.content.is_empty() || parsed.dates.is_empty() {
            return None;
        }

        Some(parsed)
    }

    /// 解析番茄钟行
    pub fn parse_pomodoro_line(&self) -> Option<ParsedPomodoro> {
        let line = self.line.trim();
        if line.is_empty() {
            return None;
        }

        let mut parsed = ParsedPomodoro::default();
        let mut content = line.to_string();

        // 移除任务列表标记
        if let Some(caps) = TASK_LIST_STATUS_RE.captures(&content) {
            content = TASK_LIST_STATUS_RE.replace(&content, "").to_string();
        }

        // 解析完整番茄钟格式
        if let Some(caps) = POMODORO_FULL_RE.captures(&content) {
            parsed.date = caps.get(1).unwrap().as_str().to_string();
            parsed.start_time = caps.get(2).unwrap().as_str().to_string();
            parsed.end_time = caps.get(3).map(|m| m.as_str().to_string());
            parsed.description = caps.get(4).map(|m| m.as_str().to_string());

            // 计算时长
            if let (Some(start), Some(end)) = (caps.get(2), caps.get(3)) {
                if let (Ok(start_h), Ok(start_m), Ok(end_h), Ok(end_m)) = (
                    start.as_str()[0..2].parse::<i32>(),
                    start.as_str()[3..5].parse::<i32>(),
                    end.as_str()[0..2].parse::<i32>(),
                    end.as_str()[3..5].parse::<i32>(),
                ) {
                    let start_minutes = start_h * 60 + start_m;
                    let end_minutes = end_h * 60 + end_m;
                    let duration = if end_minutes >= start_minutes {
                        end_minutes - start_minutes
                    } else {
                        end_minutes + 24 * 60 - start_minutes
                    };
                    parsed.duration_minutes = duration;
                }
            }
        }
        // 解析无结束时间格式
        else if let Some(caps) = POMODORO_NO_END_RE.captures(&content) {
            parsed.date = caps.get(1).unwrap().as_str().to_string();
            parsed.start_time = caps.get(2).unwrap().as_str().to_string();
            parsed.description = caps.get(3).map(|m| m.as_str().to_string());
            parsed.duration_minutes = 25; // 默认 25 分钟
        } else {
            return None;
        }

        // 解析实际时长
        if let Some(caps) = ACTUAL_DURATION_RE.captures(&content) {
            if let Ok(minutes) = caps.get(1).unwrap().as_str().parse::<i32>() {
                parsed.actual_duration_minutes = Some(minutes);
            }
        }

        // 解析状态
        if content.contains("进行中") || content.contains("running") {
            parsed.status = Some("running".to_string());
        } else {
            parsed.status = Some("completed".to_string());
        }

        // 提取 item_content（描述中的内容）
        if let Some(ref desc) = parsed.description {
            parsed.item_content = Some(desc.clone());
        }

        Some(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_block_refs() {
        let parser = LineParser::new("任务名((20240101120000-abc123 \"锚文本\"))");
        let (result, links) = parser.parse_block_refs();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].name, "锚文本");
        assert!(result.contains("任务名"));
    }

    #[test]
    fn test_parse_task_line() {
        let parser = LineParser::new("任务A @L1 @2024-01-01 #任务#");
        let task = parser.parse_task_line().unwrap();
        assert_eq!(task.name, "任务A");
        assert_eq!(task.level, "L1");
        assert_eq!(task.date, Some("2024-01-01".to_string()));
    }

    #[test]
    fn test_parse_item_line() {
        let parser = LineParser::new("整理资料 @2024-01-01");
        let item = parser.parse_item_line().unwrap();
        assert_eq!(item.content, "整理资料");
        assert_eq!(item.dates.len(), 1);
        assert_eq!(item.dates[0].date, "2024-01-01");
    }

    #[test]
    fn test_parse_pomodoro_line() {
        let parser = LineParser::new("番茄钟: 2024-01-01 09:00-09:25 专注工作");
        let pomodoro = parser.parse_pomodoro_line().unwrap();
        assert_eq!(pomodoro.date, "2024-01-01");
        assert_eq!(pomodoro.start_time, "09:00");
        assert_eq!(pomodoro.duration_minutes, 25);
        assert_eq!(pomodoro.description, Some("专注工作".to_string()));
    }
}
