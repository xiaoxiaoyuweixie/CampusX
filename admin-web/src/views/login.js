export function renderLogin({ app, callAdmin, setSession, onSuccess }) {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <div class="brand-mark">CX</div>
        <h1>CampusX 后台管理</h1>
        <p>使用超级管理员账号登录。</p>
        <form data-login-form>
          <label>
            <span>账号</span>
            <input name="username" autocomplete="username" placeholder="wu / xiao" required />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required />
          </label>
          <button type="submit">登录</button>
        </form>
        <!-- 当前版本不开放初始化管理员功能
        <button class="text-btn" type="button" data-init-admins>初始化管理员</button>
        -->
        <p class="hint" data-login-message></p>
      </section>
    </main>
  `;

  document.querySelector('[data-login-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector('[data-login-message]');
    message.textContent = '登录中...';
    try {
      const payload = await callAdmin('login', {
        username: form.get('username'),
        password: form.get('password'),
      });
      if (payload.code !== 0) throw new Error(payload.message || '登录失败');
      setSession(payload.data.token, payload.data.admin);
      await onSuccess();
    } catch (err) {
      message.textContent = err.message || '登录失败';
    }
  });

  /*
  当前版本不开放初始化管理员功能。
  document.querySelector('[data-init-admins]').addEventListener('click', async () => {
    const message = document.querySelector('[data-login-message]');
    message.textContent = '初始化中...';
    try {
      const payload = await callAdmin('initAdmins');
      message.textContent = payload.code === 0 ? '管理员已初始化' : payload.message;
    } catch (err) {
      message.textContent = err.message || '初始化失败';
    }
  });
  */
}
