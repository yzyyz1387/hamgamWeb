# Supabase 密码重置配置说明

本项目已经改为更稳的 **TokenHash + verifyOtp** 密码重置方案。

## 你还需要做的事

### 1. 修改 Supabase 的 Reset Password 邮件模板

进入：

- Supabase Dashboard
- Authentication
- Email Templates
- Reset Password

把正文改成下面这版：

```html
<h2>重置密码</h2>
<p>点击下面的按钮继续重置你的密码：</p>
<p>
  <a href="{{ .RedirectTo }}#/reset-password?token_hash={{ .TokenHash }}&type=recovery">
    重置密码
  </a>
</p>
<p>如果按钮无法点击，请复制上面的链接到浏览器打开。</p>
```

说明：

- `{{ .TokenHash }}`：Supabase 在邮件里生成的恢复令牌。
- `{{ .RedirectTo }}`：前端调用 `resetPasswordForEmail(..., { redirectTo })` 时传入的回跳地址。
- 本项目发信时会把 `redirectTo` 设为当前站点根地址，因此这份模板能同时适配本地和线上环境。

### 2. 检查 URL Configuration

进入：

- Supabase Dashboard
- Authentication
- URL Configuration

建议这样配置：

#### Site URL

```text
https://你的正式域名
```

#### Redirect URLs

本地开发：

```text
http://localhost:5173/**
```

线上：

```text
https://你的正式域名/**
```

如果你还会用其他端口或预览域名，也要一并加入。

### 3. 重新发一封密码重置邮件测试

旧邮件里的链接还是旧方案，改完模板以后，必须重新点击“忘记密码”发送一封新的测试邮件。

## 当前项目里的实现方式

- 登录页点击“忘记密码”后，调用 `supabase.auth.resetPasswordForEmail()` 发信。
- 邮件链接会把用户带到 `/#/reset-password?token_hash=...&type=recovery`。
- 前端重置页会调用 `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })` 验证令牌。
- 验证成功后，用户输入新密码，再调用 `supabase.auth.updateUser({ password })` 完成重置。
- 更新成功后，前端自动退出当前恢复会话，并回到登录页。
