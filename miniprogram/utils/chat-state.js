const storage = require('./storage');

function storageKey(owner, sessionId) { return `chat:v1:${encodeURIComponent(owner)}:${encodeURIComponent(sessionId)}`; }
function read(owner, sessionId) {
  const state = storage.get(storageKey(owner, sessionId), {});
  return { draft: typeof state.draft === 'string' ? state.draft : '', revision: Number(state.revision || 0),
    outbox: Array.isArray(state.outbox) ? state.outbox.map(item => ({ ...item, status: 'failed' })) : [] };
}
function write(owner, sessionId, state) { if (owner && sessionId) storage.set(storageKey(owner, sessionId), state); }
let sequence = 0;
function newId() {
  sequence += 1;
  return `c${Date.now().toString(36)}_${sequence.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
function textError(value) {
  if (!value.trim()) return '请输入消息内容';
  return Array.from(value).length > 1000 ? '单条消息最多输入1000字' : '';
}
function mergeMessages(remote, outbox) {
  const map = new Map();
  remote.forEach(item => map.set(item.id, item));
  const confirmed = new Set(remote.filter(item => item.from === 'me').map(item => item.clientMessageId));
  outbox.forEach(item => {
    if (!confirmed.has(item.clientMessageId)) map.set(item.id, item);
  });
  return [...map.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp || String(a.id).localeCompare(String(b.id)));
}
function acknowledgedDraft(draft, revision, message) {
  return message.type === 'text' && draft === message.text && revision === message.draftRevision;
}
module.exports = { read, write, newId, textError, mergeMessages, acknowledgedDraft };
