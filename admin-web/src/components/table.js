export function renderTable({ columns, rows, empty = '暂无数据' }) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(row => `
            <tr>
              ${columns.map(col => `<td>${col.render(row)}</td>`).join('')}
            </tr>
          `).join('') : `<tr><td colspan="${columns.length}" class="empty">${empty}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}
