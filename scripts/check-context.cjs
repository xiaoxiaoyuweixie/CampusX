const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');

function unavailable(reason) { return { status: 'unavailable', level: 'unknown', reason }; }

async function findSessionFiles(directory, threadId) {
  const matches = [], pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith(`-${threadId}.jsonl`)) matches.push(file);
    }
  }
  return matches;
}

async function readSessionUsage(file, threadId) {
  let latest = null, compactionCount = 0, lastCompactionAt = null;
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      let record;
      try { record = JSON.parse(line); } catch { continue; }
      if (!record || typeof record !== 'object') continue;
      if (record.type === 'compacted') {
        compactionCount += 1;
        lastCompactionAt = record.timestamp || null;
        latest = null;
      } else if (record.type === 'event_msg' && record.payload?.type === 'token_count' && record.payload.info != null) {
        latest = { recordedAt: record.timestamp || null, info: record.payload.info };
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }
  if (!latest) return unavailable(compactionCount ? 'awaiting_post_compaction_usage' : 'missing_usage');
  const inputTokens = latest.info.last_token_usage?.input_tokens;
  const contextWindow = latest.info.model_context_window;
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || !Number.isSafeInteger(contextWindow) || contextWindow <= 0) {
    return unavailable('invalid_usage');
  }
  const percent = inputTokens / contextWindow * 100;
  const level = percent >= 85 ? 'high' : percent >= 70 ? 'warning' : 'normal';
  return {
    status: 'ok', source: 'latest_request_input', threadId, recordedAt: latest.recordedAt,
    inputTokens, contextWindow, percent: Math.round(percent * 100) / 100, level,
    compactionCount, lastCompactionAt, notificationKey: `${threadId}:${compactionCount}:${level}`,
  };
}

async function checkContext({ threadId = process.env.CODEX_THREAD_ID, codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex') } = {}) {
  if (!threadId) return unavailable('missing_thread_id');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)) return unavailable('invalid_thread_id');
  try {
    const files = await findSessionFiles(path.join(codexHome, 'sessions'), threadId);
    if (!files.length) return unavailable('session_not_found');
    if (files.length > 1) return unavailable('ambiguous_session');
    return await readSessionUsage(files[0], threadId);
  } catch (err) {
    return unavailable(err.code === 'ENOENT' ? 'session_not_found' : 'read_failed');
  }
}

module.exports = { checkContext };
if (require.main === module) {
  checkContext().then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => {
    process.stdout.write(`${JSON.stringify(unavailable('read_failed'))}\n`);
    process.exitCode = 1;
  });
}
