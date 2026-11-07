import Link from "next/link";
import { redirect } from "next/navigation";
import type { BibleVersion } from "@/generated/prisma/client";
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
  type DataInventory,
} from "@/lib/bible-versions";
import {
  addVersion,
  moveVersion,
  toggleVersionDefault,
  toggleVersionEnabled,
  updateVersionInfo,
} from "@/lib/actions/bible-versions";
import { formatDateTime } from "@/lib/format";

// 圣经版本管理：分「已上架 / 未上架」两组，每行的上架/下架、默认显示开关在任何宽度下都直接可见
// （行内容按宽度自动换行，不再依赖横向滚动的表格）。

const FULL_CANON = 66;

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const arrowButton = {
  width: 28,
  height: 26,
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--white)",
  color: "var(--body)",
  fontSize: 12,
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

function actionButton(kind: "primary" | "danger" | "plain", disabled = false) {
  const palette = {
    primary: { bg: "var(--ink)", fg: "var(--yellow)", border: "var(--ink)" },
    danger: { bg: "var(--white)", fg: "var(--pink)", border: "var(--line)" },
    plain: { bg: "var(--white)", fg: "var(--body)", border: "var(--line)" },
  }[kind];
  return {
    height: 32,
    padding: "0 14px",
    borderRadius: 100,
    border: `1px solid ${palette.border}`,
    background: disabled ? "var(--surface-2)" : palette.bg,
    color: disabled ? "var(--muted)" : palette.fg,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap" as const,
  };
}

function DataBadge({ data }: { data?: DataInventory }) {
  if (!data) return <Badge tone="err">无经文数据</Badge>;
  const complete = data.books >= FULL_CANON;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Badge tone={complete ? "ok" : "warn"}>
        {data.books}/{FULL_CANON} 卷
      </Badge>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{formatSize(data.bytes)}</span>
    </span>
  );
}

function VersionRow({
  version,
  data,
  canMoveUp,
  canMoveDown,
  editing,
}: {
  version: BibleVersion;
  data?: DataInventory;
  canMoveUp: boolean;
  canMoveDown: boolean;
  editing: boolean;
}) {
  const isFallback = version.code === FALLBACK_VERSION;
  const complete = (data?.books ?? 0) >= FULL_CANON;
  const isDefault = version.enabled && (version.defaultOn || isFallback);

  return (
    <div style={{ borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px", padding: "14px 18px" }}>
        {version.enabled && (
          <div style={{ display: "flex", gap: 4 }}>
            <form action={moveVersion}>
              <input type="hidden" name="code" value={version.code} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" style={arrowButton} disabled={!canMoveUp} aria-label={`上移 ${version.label}`}>
                ↑
              </button>
            </form>
            <form action={moveVersion}>
              <input type="hidden" name="code" value={version.code} />
              <input type="hidden" name="direction" value="down" />
              <button type="submit" style={arrowButton} disabled={!canMoveDown} aria-label={`下移 ${version.label}`}>
                ↓
              </button>
            </form>
          </div>
        )}

        {/* 版本信息：占满剩余宽度，窄屏时开关整体换到下一行 */}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 15, color: "var(--ink)" }}>{version.label}</strong>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{version.code}</span>
            <span style={{ fontSize: 12, color: "var(--body)" }}>· {LANG_LABEL[version.lang] ?? version.lang}</span>
            {isFallback && <Badge tone="info">兜底版本</Badge>}
            {isDefault && <Badge tone="warn">新用户默认显示</Badge>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
            <DataBadge data={data} />
            {version.note && (
              <span style={{ fontSize: 12, color: "var(--muted)" }} title={version.note}>
                备注：{version.note.length > 40 ? `${version.note.slice(0, 40)}…` : version.note}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {version.enabled ? (
            <>
              {!isFallback && (
                <form action={toggleVersionDefault}>
                  <input type="hidden" name="code" value={version.code} />
                  <button type="submit" style={actionButton("plain")}>
                    {version.defaultOn ? "取消默认显示" : "设为默认显示"}
                  </button>
                </form>
              )}
              <form action={toggleVersionEnabled}>
                <input type="hidden" name="code" value={version.code} />
                <button
                  type="submit"
                  style={actionButton("danger", isFallback)}
                  disabled={isFallback}
                  title={isFallback ? "和合本是兜底版本，不能下架" : "下架后 App 里不再显示这个版本"}
                >
                  下架
                </button>
              </form>
            </>
          ) : (
            <form action={toggleVersionEnabled}>
              <input type="hidden" name="code" value={version.code} />
              <button
                type="submit"
                style={actionButton("primary", !complete)}
                disabled={!complete}
                title={complete ? "上架后用户下次打开 App 就能看到" : "经文数据不满 66 卷，补齐后才能上架"}
              >
                上架
              </button>
            </form>
          )}
          <Link
            href={editing ? "/admin/bible-versions" : `/admin/bible-versions?edit=${version.code}`}
            scroll={false}
            style={{ ...actionButton("plain"), display: "inline-flex", alignItems: "center", color: "var(--purple)" }}
          >
            {editing ? "收起" : "编辑"}
          </Link>
        </div>
      </div>

      {editing && (
        <form
          action={updateVersionInfo}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 10,
            margin: "0 18px 14px",
            padding: 12,
            borderRadius: 12,
            background: "var(--surface-2)",
          }}
        >
          <input type="hidden" name="code" value={version.code} />
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            显示名称
            <input name="label" defaultValue={version.label} maxLength={40} required style={{ ...fieldStyle, width: 180 }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)" }}>
            语言
            <select name="lang" defaultValue={version.lang} style={{ ...fieldStyle, width: 130 }}>
              <option value="zh">中文</option>
              <option value="ko">韩文 / 朝鲜文</option>
              <option value="en">英文</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, color: "var(--muted)", flex: "1 1 220px" }}>
            备注（来源、版权情况等，仅后台可见）
            <input name="note" defaultValue={version.note} maxLength={500} style={{ ...fieldStyle, width: "100%" }} />
          </label>
          <button type="submit" className="action-orange" style={{ height: 32 }}>
            保存
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)", flexBasis: "100%" }}>
            最后修改 {formatDateTime(version.updatedAt)}
          </span>
        </form>
      )}
    </div>
  );
}

function SectionHead({ title, hint, count }: { title: string; hint: string; count: number }) {
  return (
    <div style={{ padding: "14px 18px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 14, color: "var(--ink)" }}>{title}</strong>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{count} 个</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

export default async function BibleVersionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  const { edit } = await searchParams;

  await ensureBibleVersions();
  const [versions, inventory] = await Promise.all([
    db.bibleVersion.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    readDataInventory(),
  ]);
  const listed = versions.filter((version) => version.enabled || version.code === FALLBACK_VERSION);
  const unlisted = versions.filter((version) => !version.enabled && version.code !== FALLBACK_VERSION);
  const untracked = untrackedFolders(inventory, versions.map((version) => version.code));
  const defaultNames = listed
    .filter((version) => version.defaultOn || version.code === FALLBACK_VERSION)
    .map((version) => version.label);

  return (
    <>
      <div className="admin-header">
        <div className="title">圣经版本</div>
        <div className="meta">
          {listed.length} 个已上架 · {unlisted.length} 个未上架 · 新用户默认显示：{defaultNames.join("、")}
        </div>
      </div>

      <div
        className="card"
        style={{ borderRadius: 16, padding: "12px 16px", marginBottom: 12, fontSize: 12, lineHeight: 1.8, color: "var(--body)" }}
      >
        <strong style={{ color: "var(--ink)" }}>怎么生效：</strong>
        改动在用户下次打开 App 时生效，无需发新版。已上架的版本出现在 App「资源管理」的译本列表里，用户勾选后显示在阅读页；
        「默认显示」的版本新用户不用勾选就能看到。和合本是兜底版本，不能下架。经文不满 66 卷的版本不能上架。
      </div>

      <div className="card" style={{ borderRadius: 16, padding: 0, marginBottom: 12 }}>
        <SectionHead title="已上架" hint="App 里可见，按这里的顺序排列；用 ↑↓ 调整顺序" count={listed.length} />
        {listed.map((version, index) => (
          <VersionRow
            key={version.code}
            version={version}
            data={inventory.get(dataFolder(version.code))}
            canMoveUp={index > 0}
            canMoveDown={index < listed.length - 1}
            editing={edit === version.code}
          />
        ))}
      </div>

      <div className="card" style={{ borderRadius: 16, padding: 0 }}>
        <SectionHead title="未上架" hint="App 里看不到；确认版权与数据无误后点「上架」" count={unlisted.length} />
        {unlisted.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", fontSize: 12, color: "var(--muted)" }}>
            所有版本都已上架。
          </div>
        ) : (
          unlisted.map((version) => (
            <VersionRow
              key={version.code}
              version={version}
              data={inventory.get(dataFolder(version.code))}
              canMoveUp={false}
              canMoveDown={false}
              editing={edit === version.code}
            />
          ))
        )}
      </div>

      {untracked.length > 0 && (
        <div className="card" style={{ borderRadius: 16, padding: "14px 18px", marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>未收录的经文数据</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            服务器 data/bible 里有这些目录，但还不在版本列表中。加入后归入「未上架」，确认无误再上架。
          </div>
          {untracked.map((folder) => (
            <form key={folder} action={addVersion} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <input type="hidden" name="code" value={folder} />
              <strong style={{ minWidth: 80, fontSize: 13 }}>{folder}</strong>
              <DataBadge data={inventory.get(folder)} />
              <input name="label" placeholder="显示名称" maxLength={40} style={{ ...fieldStyle, width: 160 }} />
              <select name="lang" defaultValue="zh" style={{ ...fieldStyle, width: 130 }}>
                <option value="zh">中文</option>
                <option value="ko">韩文 / 朝鲜文</option>
                <option value="en">英文</option>
              </select>
              <button type="submit" className="action-orange">
                加入列表
              </button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
