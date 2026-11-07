import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Primitives";
import {
  FALLBACK_VERSION,
  LANG_LABEL,
  dataFolder,
  ensureBibleVersions,
  readDataInventory,
  untrackedFolders,
} from "@/lib/bible-versions";
import {
  addVersion,
  moveVersion,
  toggleVersionDefault,
  toggleVersionEnabled,
  updateVersionInfo,
} from "@/lib/actions/bible-versions";
import { formatDateTime } from "@/lib/format";

const FULL_CANON = 66;

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const pillButton = (active: boolean, tone: "ok" | "gold") => ({
  minWidth: 64,
  height: 28,
  padding: "0 12px",
  borderRadius: 100,
  border: `1px solid ${active ? "transparent" : "var(--line)"}`,
  background: active
    ? tone === "ok"
      ? "var(--st-ok, #1f6b45)"
      : "var(--yellow)"
    : "var(--white)",
  color: active ? (tone === "ok" ? "#fff" : "var(--ink)") : "var(--body)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

const arrowButton = {
  width: 26,
  height: 24,
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--white)",
  color: "var(--body)",
  fontSize: 11,
  cursor: "pointer",
};

const fieldStyle = {
  height: 32,
  padding: "0 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--white)",
  color: "var(--ink)",
  fontSize: 13,
};

export default async function BibleVersionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");

  await ensureBibleVersions();
  const [versions, inventory] = await Promise.all([
    db.bibleVersion.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    readDataInventory(),
  ]);
  const untracked = untrackedFolders(
    inventory,
    versions.map((version) => version.code),
  );
  const enabledCount = versions.filter((version) => version.enabled).length;
  const defaultNames = versions
    .filter((version) => version.enabled && version.defaultOn)
    .map((version) => version.label);

  return (
    <>
      <div className="admin-header">
        <div className="title">圣经版本</div>
        <div className="meta">
          共 {versions.length} 个版本 · {enabledCount} 个已上架 ·
          新用户默认显示：{defaultNames.join("、") || "和合本"}
        </div>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: "12px 16px",
          marginBottom: 12,
          fontSize: 12,
          lineHeight: 1.8,
          color: "var(--body)",
        }}
      >
        <strong style={{ color: "var(--ink)" }}>怎么生效：</strong>
        App 每次启动会拉取这里的清单，改动在用户下次打开 App
        时生效，无需发新版。 「上架」的版本出现在
        App「资源管理」的译本列表里，用户勾选后才显示在阅读页；
        「默认显示」决定新用户不用勾选就能看到哪些版本。和合本是兜底版本，始终上架、默认显示。
        经文数据随安装包内置，书卷不满 66 卷的版本请先补齐数据再上架。
      </div>

      <div
        className="card"
        style={{ borderRadius: 16, padding: "6px 0", overflow: "auto" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "64px minmax(180px, 1.4fr) 110px 150px 96px 110px 70px",
            gap: 12,
            padding: "10px 18px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted)",
            borderBottom: "1px solid var(--line)",
            minWidth: 860,
          }}
        >
          <span>排序</span>
          <span>版本</span>
          <span>语言</span>
          <span>经文数据</span>
          <span>上架</span>
          <span>新用户默认</span>
          <span>编辑</span>
        </div>

        {versions.map((version, index) => {
          const data = inventory.get(dataFolder(version.code));
          const complete = (data?.books ?? 0) >= FULL_CANON;
          const isFallback = version.code === FALLBACK_VERSION;
          return (
            <div
              key={version.code}
              style={{
                borderBottom:
                  index < versions.length - 1
                    ? "1px solid var(--line)"
                    : "none",
                minWidth: 860,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "64px minmax(180px, 1.4fr) 110px 150px 96px 110px 70px",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 18px",
                  opacity: version.enabled ? 1 : 0.72,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  <form action={moveVersion}>
                    <input type="hidden" name="code" value={version.code} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      style={arrowButton}
                      disabled={index === 0}
                      aria-label={`上移 ${version.label}`}
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveVersion}>
                    <input type="hidden" name="code" value={version.code} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      style={arrowButton}
                      disabled={index === versions.length - 1}
                      aria-label={`下移 ${version.label}`}
                    >
                      ↓
                    </button>
                  </form>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {version.label}
                    {isFallback ? (
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone="info">兜底版本</Badge>
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {version.code}
                    {version.note ? ` · ${version.note}` : ""}
                  </div>
                </div>

                <span style={{ fontSize: 13, color: "var(--body)" }}>
                  {LANG_LABEL[version.lang] ?? version.lang}
                </span>

                <span style={{ fontSize: 12 }}>
                  {data ? (
                    <>
                      <Badge tone={complete ? "ok" : "warn"}>
                        {data.books}/{FULL_CANON} 卷
                      </Badge>
                      <span style={{ marginLeft: 6, color: "var(--muted)" }}>
                        {formatSize(data.bytes)}
                      </span>
                    </>
                  ) : (
                    <Badge tone="err">无数据</Badge>
                  )}
                </span>

                <form action={toggleVersionEnabled}>
                  <input type="hidden" name="code" value={version.code} />
                  <button
                    type="submit"
                    style={pillButton(version.enabled, "ok")}
                    disabled={isFallback || (!version.enabled && !complete)}
                    title={
                      isFallback
                        ? "和合本始终上架"
                        : !version.enabled && !complete
                          ? "经文数据不完整，暂不能上架"
                          : version.enabled
                            ? "点击下架"
                            : "点击上架"
                    }
                  >
                    {version.enabled ? "已上架" : "未上架"}
                  </button>
                </form>

                <form action={toggleVersionDefault}>
                  <input type="hidden" name="code" value={version.code} />
                  <button
                    type="submit"
                    style={pillButton(
                      version.enabled && (version.defaultOn || isFallback),
                      "gold",
                    )}
                    disabled={isFallback || !version.enabled}
                    title={
                      isFallback
                        ? "和合本始终默认显示"
                        : !version.enabled
                          ? "先上架才能设为默认"
                          : ""
                    }
                  >
                    {version.enabled && (version.defaultOn || isFallback)
                      ? "默认显示"
                      : "需勾选"}
                  </button>
                </form>

                <Link
                  href={
                    edit === version.code
                      ? "/admin/bible-versions"
                      : `/admin/bible-versions?edit=${version.code}`
                  }
                  scroll={false}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--purple)",
                  }}
                >
                  {edit === version.code ? "收起 ▴" : "编辑 ▾"}
                </Link>
              </div>

              {edit === version.code && (
                <form
                  action={updateVersionInfo}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    gap: 10,
                    margin: "0 18px 14px 94px",
                    padding: 12,
                    borderRadius: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <input type="hidden" name="code" value={version.code} />
                  <label
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 11,
                      color: "var(--muted)",
                    }}
                  >
                    显示名称
                    <input
                      name="label"
                      defaultValue={version.label}
                      maxLength={40}
                      required
                      style={{ ...fieldStyle, width: 180 }}
                    />
                  </label>
                  <label
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 11,
                      color: "var(--muted)",
                    }}
                  >
                    语言
                    <select
                      name="lang"
                      defaultValue={version.lang}
                      style={{ ...fieldStyle, width: 130 }}
                    >
                      <option value="zh">中文</option>
                      <option value="ko">韩文 / 朝鲜文</option>
                      <option value="en">英文</option>
                    </select>
                  </label>
                  <label
                    style={{
                      display: "grid",
                      gap: 4,
                      fontSize: 11,
                      color: "var(--muted)",
                      flex: "1 1 220px",
                    }}
                  >
                    备注（来源、版权情况等，仅后台可见）
                    <input
                      name="note"
                      defaultValue={version.note}
                      maxLength={500}
                      style={{ ...fieldStyle, width: "100%" }}
                    />
                  </label>
                  <button
                    type="submit"
                    className="action-orange"
                    style={{ height: 32 }}
                  >
                    保存
                  </button>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      flexBasis: "100%",
                    }}
                  >
                    最后修改 {formatDateTime(version.updatedAt)}
                  </span>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {untracked.length > 0 && (
        <div
          className="card"
          style={{ borderRadius: 16, padding: "14px 18px", marginTop: 16 }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 4,
            }}
          >
            未收录的经文数据
          </div>
          <div
            style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}
          >
            服务器 data/bible
            里有这些目录，但还不在版本列表中。加入后默认下架，确认无误再上架。
          </div>
          {untracked.map((folder) => {
            const data = inventory.get(folder);
            return (
              <form
                key={folder}
                action={addVersion}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                }}
              >
                <input type="hidden" name="code" value={folder} />
                <strong style={{ width: 90, fontSize: 13 }}>{folder}</strong>
                <span
                  style={{ width: 130, fontSize: 12, color: "var(--muted)" }}
                >
                  {data
                    ? `${data.books}/${FULL_CANON} 卷 · ${formatSize(data.bytes)}`
                    : ""}
                </span>
                <input
                  name="label"
                  placeholder="显示名称"
                  maxLength={40}
                  style={{ ...fieldStyle, width: 160 }}
                />
                <select
                  name="lang"
                  defaultValue="zh"
                  style={{ ...fieldStyle, width: 130 }}
                >
                  <option value="zh">中文</option>
                  <option value="ko">韩文 / 朝鲜文</option>
                  <option value="en">英文</option>
                </select>
                <button type="submit" className="action-orange">
                  加入列表
                </button>
              </form>
            );
          })}
        </div>
      )}
    </>
  );
}
