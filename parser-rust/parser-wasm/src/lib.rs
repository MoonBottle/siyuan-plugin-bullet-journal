use wasm_bindgen::prelude::*;
use parser_core::parse_kramdown as core_parse_kramdown;
use serde_wasm_bindgen::to_value;

/// 解析 Kramdown 内容为 Project
/// 
/// # Arguments
/// * `kramdown` - Kramdown 格式文本
/// * `doc_id` - 文档 ID
/// 
/// # Returns
/// * `JsValue` - Project 对象的 JSON 表示，解析失败返回 null
#[wasm_bindgen]
pub fn parse_kramdown(kramdown: String, doc_id: String) -> JsValue {
    match core_parse_kramdown(&kramdown, &doc_id) {
        Some(project) => to_value(&project).unwrap_or(JsValue::NULL),
        None => JsValue::NULL,
    }
}

/// 测试解析器是否可用
#[wasm_bindgen]
pub fn health_check() -> bool {
    true
}

/// 去除列表标记和块属性
#[wasm_bindgen]
pub fn strip_list_and_block_attr(line: String) -> String {
    parser_core::strip_list_and_block_attr(&line)
}

/// 解析块引用
#[wasm_bindgen]
pub fn parse_block_refs(line: String) -> JsValue {
    use parser_core::LineParser;
    let parser = LineParser::new(&line);
    let (result, links) = parser.parse_block_refs();
    
    #[derive(serde::Serialize)]
    struct BlockRefsResult {
        result: String,
        links: Vec<parser_core::Link>,
    }
    
    let output = BlockRefsResult { result, links };
    to_value(&output).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_health_check() {
        assert!(health_check());
    }

    #[wasm_bindgen_test]
    fn test_parse_kramdown() {
        let kramdown = r#"## 测试项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }事项A @2024-01-01
{: id="after-i" }
"#;
        let result = parse_kramdown(kramdown.to_string(), "test-doc".to_string());
        assert!(!result.is_null());
    }
}
