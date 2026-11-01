import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { isLockedOut, recordFailure, clearFailures } from "@/lib/login-rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        // 防爆破：窗口内失败超限的用户名直接拒绝（成功登录后清零）
        const limitKey = username.trim().toLowerCase();
        if (isLockedOut(limitKey)) return null;

        const operator = await db.operator.findUnique({ where: { username } });
        if (!operator) {
          recordFailure(limitKey);
          return null;
        }

        const valid = await bcrypt.compare(password, operator.passwordHash);
        if (!valid) {
          recordFailure(limitKey);
          return null;
        }

        clearFailures(limitKey);
        return { id: operator.id, name: operator.name, username: operator.username, role: operator.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.username = (user as { username?: string }).username;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { username?: string }).username = token.username as string | undefined;
      }
      return session;
    },
  },
});
