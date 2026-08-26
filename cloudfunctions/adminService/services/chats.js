const { db } = require('../lib/cloud');
const { parsePagination } = require('../lib/pagination');
const { fail, ok } = require('../lib/response');

async function listChatSessions(data = {}) {
  const { page, pageSize, skip } = parsePagination(data);
  const query = {};
  if (data.keyword) {
    query.productTitle = db.RegExp({ regexp: String(data.keyword), options: 'i' });
  }
  const total = (await db.collection('chat_sessions').where(query).count()).total;
  const res = await db.collection('chat_sessions')
    .where(query)
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data, page, pageSize, total });
}

async function listChatMessages(data = {}) {
  const sessionId = data.sessionId;
  if (!sessionId) return fail('missing_session_id', 40001);
  const { page, pageSize, skip } = parsePagination(data);
  const total = (await db.collection('chat_messages').where({ sessionId }).count()).total;
  const res = await db.collection('chat_messages')
    .where({ sessionId })
    .orderBy('createdTimestamp', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  return ok({ list: res.data.reverse(), page, pageSize, total });
}

module.exports = { listChatSessions, listChatMessages };
