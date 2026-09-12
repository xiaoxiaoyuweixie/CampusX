import { renderTable } from '../components/table.js';
import { escapeHtml, formatDate } from '../utils/format.js';

export async function loadChats({ adminCall, renderApp }) {
  const data = await adminCall('listChatSessions', { page: 1, pageSize: 50 });
  renderApp(`
    <div class="split">
      <div>
        ${renderTable({
          rows: data.list || [],
          columns: [
            { label: '商品', render: row => escapeHtml(row.productTitle || '-') },
            { label: '买家', render: row => escapeHtml((row.buyerSnapshot && row.buyerSnapshot.nickname) || row.buyerOpenid || '-') },
            { label: '卖家', render: row => escapeHtml((row.sellerSnapshot && row.sellerSnapshot.nickname) || row.sellerOpenid || '-') },
            { label: '最后消息', render: row => escapeHtml((row.lastMessage && row.lastMessage.content) || '-') },
            { label: '更新时间', render: row => formatDate(row.updatedAt || row.createdAt) },
            { label: '操作', render: row => `<button data-chat-session="${row.sessionId || row._id}">查看消息</button>` },
          ],
        })}
      </div>
      <aside class="message-panel" data-message-panel>选择会话查看消息</aside>
    </div>
  `);
  bindChatActions({ adminCall });
}

function bindChatActions({ adminCall }) {
  document.querySelectorAll('[data-chat-session]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const data = await adminCall('listChatMessages', { sessionId: btn.dataset.chatSession, page: 1, pageSize: 100 });
      const panel = document.querySelector('[data-message-panel]');
      panel.innerHTML = `
        <h2>消息记录</h2>
        ${(data.list || []).map(message => `
          <div class="message-item">
            <strong>${escapeHtml(message.senderRole || message.senderOpenid || '-')}</strong>
            ${message.type === 'image'
              ? (message.imageUrl && /^https:\/\//.test(message.imageUrl)
                ? `<a href="${escapeHtml(message.imageUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(message.imageUrl)}" alt="聊天图片" style="display:block;max-width:100%;width:240px;max-height:240px;object-fit:contain" /></a>`
                : '<p>[图片暂时无法加载]</p>')
              : `<p>${escapeHtml(message.content || '')}</p>`}
            <span>${formatDate(message.createdTimestamp || message.createdAt)}</span>
          </div>
        `).join('') || '<p class="empty">暂无消息</p>'}
      `;
    });
  });
}
