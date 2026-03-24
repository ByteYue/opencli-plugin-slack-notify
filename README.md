# opencli-plugin-slack-notify

**OpenCLI plugin** that pushes alerts to Slack or Telegram when command results match configured keywords. Turn opencli into a **keyword monitoring sentinel**.

## Install

```bash
opencli plugin install github:ByteYue/opencli-plugin-slack-notify
```

## Configuration

Create `~/.opencli/notify.json`:

```json
{
  "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  "keywords": ["AI", "降息", "OpenAI", "Rust", "Bitcoin"],
  "watchCommands": ["*"],
  "minMatches": 1
}
```

### Options

| Field | Description |
|---|---|
| `webhookUrl` | Slack incoming webhook URL |
| `telegramBotToken` | Telegram bot token (alternative to Slack) |
| `telegramChatId` | Telegram chat ID |
| `keywords` | Keywords to match in results (case-insensitive) |
| `watchCommands` | `["*"]` for all commands, or specific `["zhihu/hot", "hackernews/top"]` |
| `minMatches` | Minimum keyword matches before sending notification (default: 1) |

## Usage

Once configured, notifications are sent automatically when keyword matches are found:

```bash
opencli zhihu hot         # If "AI" appears → Slack notification!
opencli hackernews top    # If "Rust" appears → Slack notification!
```

Test your webhook:
```bash
opencli slack-notify test
```

## Notification Format

**Slack:**
```
🔔 opencli alert
Command: `zhihu/hot`
Matches: 3

• AI大模型再获突破 (🏷️ AI)
• 降息预期增强 (🏷️ 降息)
• OpenAI发布新产品 (🏷️ OpenAI, AI)
```

## Requirements

- opencli >= 1.3.0 (lifecycle hooks support)
