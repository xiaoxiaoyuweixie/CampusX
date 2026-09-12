const { db, cloud } = require('../lib/cloud');
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
  const list = res.data.reverse();
  const imageMessages = list.filter(message => message.type === 'image' && message.image && message.image.fileID);
  for (let offset = 0; offset < imageMessages.length; offset += 50) {
    const batch = imageMessages.slice(offset, offset + 50);
    try {
      const urls = await cloud.getTempFileURL({ fileList: batch.map(message => ({ fileID: message.image.fileID, maxAge: 600 })) });
      const byId = new Map((urls.fileList || []).map(file => [file.fileID, file.tempFileURL || '']));
      batch.forEach(message => { message.imageUrl = byId.get(message.image.fileID) || ''; });
    } catch (err) { batch.forEach(message => { message.imageUrl = ''; }); }
  }
  return ok({ list, page, pageSize, total });
}

module.exports = { listChatSessions, listChatMessages };
