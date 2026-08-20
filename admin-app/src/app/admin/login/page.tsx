import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirectTo: "/admin",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/admin/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" action={login}>
        <div className="mark">
<svg width="32" height="32" viewBox="22 5 76 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="60,9 63.2,15.8 72,19 63.2,22.2 60,31 56.8,22.2 48,19 56.8,15.8" fill="#E89A2C" />
            <polygon points="43.6,25.6 45.5,30.1 50,32 45.5,33.9 43.6,38.4 41.7,33.9 37.2,32 41.7,30.1" fill="#202229" />
            <polygon points="77.9,23.6 79.8,28.1 84.3,30 79.8,31.9 77.9,36.4 76,31.9 71.5,30 76,28.1" fill="#202229" />
            <path d="M60 53 C 50 45, 34 45, 26 52 L 26 88 C 34 79, 50 79, 60 88 Z" fill="#F2C96D" stroke="#202229" strokeWidth="6" strokeLinejoin="round" />
            <path d="M60 53 C 70 45, 86 45, 94 52 L 94 88 C 86 79, 70 79, 60 88 Z" fill="#F2C96D" stroke="#202229" strokeWidth="6" strokeLinejoin="round" />
            <line x1="60" y1="53" x2="60" y2="88" stroke="#202229" strokeWidth="5" />
          </svg>
        </div>
        <h1>OpenBible 后台管理</h1>
        <div className="sub">运营账号登录</div>

        {error ? <div className="login-error">用户名或密码不正确</div> : null}

        <div className="field">
          <label htmlFor="username">用户名</label>
          <input id="username" name="username" type="text" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">密码</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        <button className="btn-primary" type="submit">登录</button>
      </form>
    </div>
  );
}
