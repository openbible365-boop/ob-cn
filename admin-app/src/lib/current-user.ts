import { db } from "@/lib/db";

// The public site doesn't have real end-user auth yet — every request acts
// as this fixed seeded user (王弟兄) until registration/login is built.
const FIXED_TEST_USER_NAME = "王弟兄";

export async function getCurrentUser() {
  return db.user.findFirstOrThrow({ where: { name: FIXED_TEST_USER_NAME } });
}
