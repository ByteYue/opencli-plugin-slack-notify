/**
 * slack-notify/test — Send a test notification to verify your webhook config.
 *
 * Usage:
 *   opencli slack-notify test
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIG_PATH = path.join(os.homedir(), '.opencli', 'notify.json');

cli({
  site: 'slack-notify',
  name: 'test',
  description: 'Send a test notification to verify webhook configuration',
  browser: false,
  strategy: Strategy.PUBLIC,
  args: [],
  func: async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log(`❌ Config file not found: ${CONFIG_PATH}`);
      console.log(`\nCreate it with:\n`);
      console.log(JSON.stringify({
        webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
        keywords: ['AI', 'trending'],
        watchCommands: ['*'],
        minMatches: 1,
      }, null, 2));
      return [{ status: 'error', message: 'Config file not found' }];
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

    if (config.webhookUrl) {
      try {
        const isFeishu = config.webhookUrl.includes('feishu.cn') || config.webhookUrl.includes('larksuite.com');
        const payload = isFeishu
          ? { msg_type: 'text', content: { text: '✅ opencli slack-notify test — webhook is working!' } }
          : { text: '✅ opencli slack-notify test — webhook is working!' };
        const res = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const resText = await res.text();
        console.log(`Webhook (${isFeishu ? 'Feishu' : 'Slack'}): ${res.ok ? '✅ sent' : `❌ ${res.status}`} ${resText}`);
      } catch (err) {
        console.log(`Webhook: ❌ ${err instanceof Error ? err.message : err}`);
      }
    }

    if (config.telegramBotToken && config.telegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: '✅ opencli slack-notify test — Telegram bot is working!',
          }),
        });
        console.log(`Telegram: ${res.ok ? '✅ sent' : `❌ ${res.status}`}`);
      } catch (err) {
        console.log(`Telegram: ❌ ${err instanceof Error ? err.message : err}`);
      }
    }

    return [{ status: 'ok', keywords: config.keywords, watchCommands: config.watchCommands }];
  },
});
