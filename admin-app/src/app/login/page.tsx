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
        redirectTo: "/",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" action={login}>
        <div className="mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#18191F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
