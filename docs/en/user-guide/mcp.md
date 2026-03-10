# MCP AI Assistant

Task Assistant supports the MCP (Model Context Protocol), exposing task and pomodoro data to MCP-compatible AI assistants (e.g. Trae, Cursor, Claude Desktop), so you can "ask about tasks in natural language, view stats, and plan."

## Overview

- **MCP**: An open protocol (by Anthropic) that lets AI safely access local data.
- **This plugin's MCP server**: Exposes project groups, project list, item filtering, and pomodoro stats/records to AI. The AI calls these tools to get Task Assistant data from SiYuan and then answers your questions or generates reports.

For more on use cases and a Trae configuration example, see [MCP Feature Guide](../article/mcp-new-feature.md).

## Configuration

### 1. Get MCP config

1. Open SiYuan Settings → Plugins → Task Assistant
2. Find the "MCP Configuration" section and click "Copy MCP Config"
3. The config is copied to the clipboard (JSON)

### 2. Fill in API info

The copied config includes:

- **SIYUAN_TOKEN**: Must be replaced with your SiYuan API Token. Get it from: SiYuan → Settings → About → API Token
- **SIYUAN_API_URL**: Default is `http://127.0.0.1:6806`. With multiple workspaces, only the first uses port 6806; for others, check the current workspace port in SiYuan "Settings → About" and update this.

### 3. Add MCP server in your AI client

In your AI client (e.g. Trae, Cursor, Claude Desktop):

1. Open MCP or "Integrations" settings
2. Add a new MCP server and paste the config (with Token and URL updated as needed)
3. Save and enable

For **Trae**: Settings → MCP → Add MCP server → Paste config → Replace `SIYUAN_TOKEN` with your API Token → Save. For agent prompts to improve tool usage, see [MCP Feature Guide](../article/mcp-new-feature.md).

## Available tools

The AI uses these tools to access Task Assistant data (all parameters optional, can be combined).

| Tool | Purpose | Main parameters |
|------|---------|-----------------|
| **list_groups** | List all project groups | None |
| **list_projects** | List projects | `groupId`: filter by group |
| **filter_items** | Filter task items by criteria | `projectId` / `projectIds`, `groupId`, `startDate` / `endDate` (YYYY-MM-DD), `status` (pending / completed / abandoned); response includes each item's `pomodoros` list |
| **get_pomodoro_stats** | Get pomodoro statistics | `date: "today"` or `startDate` / `endDate`, optional `projectId`; returns pomodoro count and focus minutes |
| **get_pomodoro_records** | Get pomodoro record list | Same as get_pomodoro_stats; returns time, item, duration per record |

- The `id` from **list_groups** can be used as `groupId` in **list_projects** and **filter_items**.
- The `id` from **list_projects** can be used as `projectId` / `projectIds` in **filter_items** and as `projectId` in **get_pomodoro_stats** / **get_pomodoro_records**.

## Example use cases

- **Today's tasks**: "What are my todos today?" — AI uses `filter_items` with today's `startDate`/`endDate` and `status: pending`.
- **Weekly review**: "What did I complete last week?" — `filter_items` with last week's date range and `status: completed`.
- **Pomodoro stats**: "How many pomodoros did I do today?" — `get_pomodoro_stats` with `date: "today"`; "Pomodoro for project X?" — add `projectId`.

More dialogue examples and agent prompts in [MCP Feature Guide](../article/mcp-new-feature.md).

## FAQ

### MCP server connection failed?

Check: ① SiYuan is running and Task Assistant is enabled; ② API Token in config is correct (SiYuan → Settings → About → API Token); ③ With multiple workspaces, `SIYUAN_API_URL` port matches the current workspace. Check the AI client's MCP logs for the exact error.

### AI doesn't see the latest task data?

Wait 1–2 seconds after saving notes, or start a new conversation so the AI calls the tools again. If still stale, try restarting the AI client.

### Which AI assistants are supported?

Tested with **Trae** (recommended, works in China). Other MCP clients (e.g. Cursor, Claude Desktop) should work similarly: add the MCP server and paste this plugin's config.
