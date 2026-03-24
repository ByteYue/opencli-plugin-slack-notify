/**
 * Slack/Telegram notification hooks: push alerts when command results match keywords.
 *
 * Configuration: ~/.opencli/notify.json
 * {
 *   "webhookUrl": "https://hooks.slack.com/services/...",
 *   "telegramBotToken": "123456:ABC-DEF...",   // optional, alternative to Slack
 *   "telegramChatId": "-1001234567890",         // required if using Telegram
 *   "keywords": ["AI", "降息", "OpenAI", "Rust"],
 *   "watchCommands": ["*"],                     // "*" = all, or specific ["zhihu/hot", "hackernews/top"]
 *   "minMatches": 1                             // minimum keyword matches to trigger
 * }
 */

import { onAfterExecute } from '@jackwener/opencli/registry';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIG_PATH = path.join(os.homedir(), '.opencli', 'notify.json');

interface NotifyConfig {
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  keywords: string[];
  watchCommands: string[];
  minMatches: number;
}

function loadConfig(): NotifyConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as NotifyConfig;
  } catch {
    return null;
  }
}

/**
 * Search for keyword matches in result items.
 * Returns matched items with the keywords that triggered them.
 */
function findMatches(
  result: unknown[],
  keywords: string[],
): { item: unknown; matched: string[] }[] {
  const matches: { item: unknown; matched: string[] }[] = [];

  for (const item of result) {
    const text = JSON.stringify(item).toLowerCase();
    const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    if (matched.length > 0) {
      matches.push({ item, matched });
    }
  }

  return matches;
}

/**
 * Extract a readable label from a result item for the notification.
 */
function itemLabel(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    return String(obj.title ?? obj.name ?? obj.text ?? obj.description ?? JSON.stringify(item)).slice(0, 80);
  }
  return String(item);
}

/**
 * Detect webhook type from URL.
 */
function detectWebhookType(url: string): 'slack' | 'feishu' | 'generic' {
  if (url.includes('feishu.cn') || url.includes('larksuite.com')) return 'feishu';
  if (url.includes('hooks.slack.com')) return 'slack';
  return 'generic';
}

/**
 * Format a Feishu (Lark) message payload.
 */
function formatFeishuMessage(command: string, matches: { item: unknown; matched: string[] }[]): object {
  const lines = matches.slice(0, 10).map(
    (m) => `• ${itemLabel(m.item)} (🏷️ ${m.matched.join(', ')})`
  );
  const text =
    `🔔 opencli alert\n` +
    `Command: ${command}\n` +
    `Matches: ${matches.length}\n\n` +
    lines.join('\n') +
    (matches.length > 10 ? `\n...and ${matches.length - 10} more` : '');

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `🔔 opencli alert — ${command}` },
        template: 'blue',
      },
      elements: [
        {
          tag: 'markdown',
          content: text,
        },
      ],
    },
  };
}

/**
 * Format a Slack message payload.
 */
function formatSlackMessage(command: string, matches: { item: unknown; matched: string[] }[]): object {
  const lines = matches.slice(0, 10).map(
    (m) => `• *${itemLabel(m.item)}* (🏷️ ${m.matched.join(', ')})`
  );
  return {
    text: `🔔 *opencli alert*: \`${command}\` found ${matches.length} keyword match(es)`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `🔔 *opencli alert*\n` +
            `Command: \`${command}\`\n` +
            `Matches: ${matches.length}\n\n` +
            lines.join('\n') +
            (matches.length > 10 ? `\n_...and ${matches.length - 10} more_` : ''),
        },
      },
    ],
  };
}

/**
 * Format a Telegram message.
 */
function formatTelegramMessage(command: string, matches: { item: unknown; matched: string[] }[]): string {
  const lines = matches.slice(0, 10).map(
    (m) => `• ${itemLabel(m.item)} (🏷️ ${m.matched.join(', ')})`
  );
  return (
    `🔔 *opencli alert*\n` +
    `Command: \`${command}\`\n` +
    `Matches: ${matches.length}\n\n` +
    lines.join('\n') +
    (matches.length > 10 ? `\n...and ${matches.length - 10} more` : '')
  );
}

/**
 * Send notification via Slack/Feishu webhook or Telegram bot.
 */
async function sendNotification(
  config: NotifyConfig,
  command: string,
  matches: { item: unknown; matched: string[] }[],
): Promise<void> {
  if (config.webhookUrl) {
    const type = detectWebhookType(config.webhookUrl);
    const payload = type === 'feishu'
      ? formatFeishuMessage(command, matches)
      : formatSlackMessage(command, matches);
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  if (config.telegramBotToken && config.telegramChatId) {
    const text = formatTelegramMessage(command, matches);
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  }
}

onAfterExecute(async (ctx, result) => {
  if (!Array.isArray(result) || result.length === 0) return;
  if (ctx.command.startsWith('slack-notify/')) return;

  const config = loadConfig();
  if (!config) return;
  if (!config.keywords || config.keywords.length === 0) return;

  // Check if this command is being watched
  const watch = config.watchCommands ?? ['*'];
  if (!watch.includes('*') && !watch.includes(ctx.command)) return;

  const matches = findMatches(result, config.keywords);
  const minMatches = config.minMatches ?? 1;

  if (matches.length >= minMatches) {
    try {
      await sendNotification(config, ctx.command, matches);
    } catch {
      // Non-fatal: don't break commands if notification fails
    }
  }
});
