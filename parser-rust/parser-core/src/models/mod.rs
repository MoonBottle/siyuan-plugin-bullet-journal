use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tasks: Vec<Task>,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub links: Option<Vec<Link>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub links: Option<Vec<Link>>,
    pub items: Vec<Item>,
    pub line_number: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub content: String,
    pub date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date_time: Option<String>,
    pub line_number: i32,
    pub doc_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_id: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub links: Option<Vec<Link>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sibling_items: Option<Vec<SiblingItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_range_start: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_range_end: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroRecord {
    pub id: String,
    pub date: String,
    pub start_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub duration_minutes: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_duration_minutes: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SiblingItem {
    pub date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_date_time: Option<String>,
}

/// 解析后的块结构
#[derive(Debug, Clone)]
pub struct Block {
    pub content: String,
    pub line_number: i32,
    pub block_id: Option<String>,
}

/// Kramdown 块属性
#[derive(Debug, Clone, Default)]
pub struct BlockAttr {
    pub id: Option<String>,
    pub block_type: Option<String>,
    pub updated: Option<String>,
    pub created: Option<String>,
}

/// 解析后的任务行
#[derive(Debug, Clone, Default)]
pub struct ParsedTask {
    pub name: String,
    pub level: String,
    pub date: Option<String>,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
    pub links: Vec<Link>,
    pub block_id: Option<String>,
}

/// 解析后的事项行
#[derive(Debug, Clone, Default)]
pub struct ParsedItem {
    pub content: String,
    pub dates: Vec<ItemDate>,
    pub status: String,
    pub links: Vec<Link>,
    pub block_id: Option<String>,
}

/// 事项日期
#[derive(Debug, Clone, Default)]
pub struct ItemDate {
    pub date: String,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
}

/// 解析后的番茄钟
#[derive(Debug, Clone, Default)]
pub struct ParsedPomodoro {
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub description: Option<String>,
    pub duration_minutes: i32,
    pub actual_duration_minutes: Option<i32>,
    pub block_id: Option<String>,
    pub status: Option<String>,
    pub item_content: Option<String>,
}
