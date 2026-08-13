import { type ReactNode, useState } from "react";
import { Icon } from "../Icon";
import type {
  CommunityWorkspace,
  WorkspaceActionInput,
  WorkspacePostMediaType,
  WorkspacePostType,
} from "../../data/community-workspace";

// 六个栏目的原生新建入口。助手仍然可以用一句话办同样的事，
// 这里只是把高频操作的路径缩短，权限判断沿用后端返回的 access 位。

type RunAction = (input: WorkspaceActionInput) => Promise<boolean>;

export function CommunitySheet({
  title,
  hint,
  busy,
  submitLabel,
  canSubmit,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  hint: string;
  busy: boolean;
  submitLabel: string;
  canSubmit: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="community-publish-backdrop" onClick={onClose}>
      <div
        className="community-publish-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="community-publish-sheet-header">
          <div>
            <b>{title}</b>
            <span>{hint}</span>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="community-sheet-fields">{children}</div>
        {error && <div className="community-sheet-error" role="alert">{error}</div>}
        <div className="community-sheet-actions">
          <button type="button" className="compact-action-btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="compact-action-btn is-primary"
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            {busy ? "提交中…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 破坏性操作的确认弹层。举报早就用的是 action-sheet，
 * 隐藏、删除、移除成员继续用 window.confirm 会在同一页出现两种确认范式，
 * 打包成原生应用后还会变成系统弹窗。
 */
export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  busy,
  danger = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="community-publish-backdrop" onClick={onCancel}>
      <div
        className="community-action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="community-publish-sheet-header">
          <div>
            <b>{title}</b>
            <span>{description}</span>
          </div>
          <button type="button" aria-label="关闭" onClick={onCancel}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="community-sheet-actions">
          <button type="button" className="compact-action-btn" onClick={onCancel}>取消</button>
          <button
            type="button"
            className={`compact-action-btn ${danger ? "is-danger" : "is-primary"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="community-sheet-field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="community-sheet-field">
      <span>{label}</span>
      <div className="community-sheet-segment" role="group" aria-label={label}>
        {options.map(([option, optionLabel]) => (
          <button
            type="button"
            key={option}
            aria-pressed={value === option}
            className={value === option ? "is-active" : ""}
            onClick={() => onChange(option)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PostComposer({
  workspace,
  busy,
  runAction,
  onClose,
}: {
  workspace: CommunityWorkspace;
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const isAdmin = workspace.access.isAdmin;
  const isOfficial = workspace.community.isOfficial;
  const [postType, setPostType] = useState<WorkspacePostType>("POST");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [verseRef, setVerseRef] = useState("");
  const [mediaType, setMediaType] = useState<WorkspacePostMediaType>("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [error, setError] = useState("");

  const typeOptions: Array<[WorkspacePostType, string]> = [
    ["POST", "动态"],
    ["ARTICLE", "文章"],
    ["MEDIA", "影音"],
    ...(isAdmin ? ([["NOTICE", "通知"]] as Array<[WorkspacePostType, string]>) : []),
  ];
  const needsTitle = postType === "ARTICLE" || postType === "NOTICE";
  const allowsMedia = postType !== "NOTICE";
  const canSubmit = Boolean(content.trim()) && (!needsTitle || Boolean(title.trim()))
    && (postType !== "MEDIA" || Boolean(mediaUrl.trim()));

  async function submit() {
    setError("");
    const ok = await runAction({
      action: "CREATE_POST",
      postType,
      title: title.trim() || undefined,
      content: content.trim(),
      verseRef: verseRef.trim() || undefined,
      ...(allowsMedia && mediaUrl.trim()
        ? { mediaType: postType === "MEDIA" ? mediaType : "IMAGE", mediaUrl: mediaUrl.trim() }
        : {}),
      visibility: isOfficial ? "PUBLIC" : adminsOnly ? "ADMINS" : "MEMBERS",
    });
    if (ok) onClose();
    else setError("发布失败，请检查内容后重试");
  }

  return (
    <CommunitySheet
      title="发布内容"
      hint={isOfficial ? "公共社群内容对所有人可见" : "发布前请遵守社群公约"}
      busy={busy}
      submitLabel="发布"
      canSubmit={canSubmit}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Segmented label="类型" value={postType} options={typeOptions} onChange={setPostType} />
      {needsTitle && (
        <Field label="标题">
          <input value={title} maxLength={120} placeholder={postType === "NOTICE" ? "例如：本周主日聚会调整" : "文章标题"} onChange={(event) => setTitle(event.target.value)} />
        </Field>
      )}
      <Field label="正文">
        <textarea
          value={content}
          maxLength={postType === "ARTICLE" ? 10_000 : 2_000}
          rows={postType === "ARTICLE" ? 7 : 4}
          placeholder="写下想分享的内容…"
          onChange={(event) => setContent(event.target.value)}
        />
      </Field>
      <Field label="经文引用" hint="可留空">
        <input value={verseRef} maxLength={100} placeholder="例如：约翰福音 3:16" onChange={(event) => setVerseRef(event.target.value)} />
      </Field>
      {allowsMedia && (
        <Field label={postType === "MEDIA" ? "媒体链接" : "图片链接"} hint={postType === "MEDIA" ? undefined : "可留空"}>
          <input value={mediaUrl} placeholder="https://" onChange={(event) => setMediaUrl(event.target.value)} />
        </Field>
      )}
      {postType === "MEDIA" && (
        <Segmented
          label="媒体类型"
          value={mediaType}
          options={[["IMAGE", "图片"], ["AUDIO", "音频"], ["VIDEO", "视频"]]}
          onChange={setMediaType}
        />
      )}
      {!isOfficial && isAdmin && (
        <Segmented
          label="可见范围"
          value={adminsOnly ? "ADMINS" : "MEMBERS"}
          options={[["MEMBERS", "本群成员"], ["ADMINS", "仅管理员"]]}
          onChange={(next) => setAdminsOnly(next === "ADMINS")}
        />
      )}
    </CommunitySheet>
  );
}

export function EventComposer({
  busy,
  runAction,
  onClose,
}: {
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      setError("请选择正确的开始时间");
      return;
    }
    if (endAt && new Date(endAt) <= start) {
      setError("结束时间必须晚于开始时间");
      return;
    }
    const ok = await runAction({
      action: "CREATE_EVENT",
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startAt: start.toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      ...(capacity.trim() ? { capacity: Number(capacity) } : {}),
    });
    if (ok) onClose();
    else setError("创建失败，请检查内容后重试");
  }

  return (
    <CommunitySheet
      title="创建活动"
      hint="时间按本机时区填写"
      busy={busy}
      submitLabel="创建"
      canSubmit={Boolean(title.trim()) && Boolean(startAt)}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Field label="活动标题">
        <input value={title} maxLength={80} placeholder="例如：周五查经" onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="活动说明" hint="可留空">
        <textarea value={description} rows={3} placeholder="这次聚会的内容与准备事项…" onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="地点" hint="可留空">
        <input value={location} placeholder="例如：线上 Zoom / 教会二楼" onChange={(event) => setLocation(event.target.value)} />
      </Field>
      <Field label="开始时间">
        <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
      </Field>
      <Field label="结束时间" hint="可留空">
        <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
      </Field>
      <Field label="名额" hint="留空表示不限">
        <input type="number" min={1} value={capacity} placeholder="例如：20" onChange={(event) => setCapacity(event.target.value)} />
      </Field>
    </CommunitySheet>
  );
}

export function GroupComposer({
  busy,
  runAction,
  onClose,
}: {
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const COLORS = ["#FFD465", "#D9C2F0", "#F0C7B7", "#A8D8C4"];
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [description, setDescription] = useState("");
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);
  const [error, setError] = useState("");
  const abbreviationLength = Array.from(abbreviation.trim()).length;

  async function submit() {
    setError("");
    const ok = await runAction({
      action: "CREATE_GROUP",
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      description: description.trim() || undefined,
      avatarColor,
    });
    if (ok) onClose();
    else setError("创建失败，简称可能已被使用");
  }

  return (
    <CommunitySheet
      title="新建小组"
      hint="小组成员与内容独立于其他小组"
      busy={busy}
      submitLabel="创建"
      canSubmit={Boolean(name.trim()) && abbreviationLength >= 1 && abbreviationLength <= 2}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Field label="小组名称">
        <input value={name} maxLength={30} placeholder="例如：青年查经组" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="小组简称" hint="1 到 2 个字 · 全域唯一">
        <input
          value={abbreviation}
          placeholder="例如：青年"
          onChange={(event) => setAbbreviation(Array.from(event.target.value).slice(0, 2).join(""))}
        />
      </Field>
      <Field label="小组简介" hint="可留空">
        <textarea value={description} rows={3} placeholder="一句话介绍这个小组…" onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="community-sheet-field">
        <span>头像底色</span>
        <div className="community-sheet-colors">
          {COLORS.map((color) => (
            <button
              type="button"
              key={color}
              aria-label={`选择底色 ${color}`}
              aria-pressed={avatarColor === color}
              className={avatarColor === color ? "is-active" : ""}
              style={{ background: color }}
            onClick={() => setAvatarColor(color)}
            />
          ))}
        </div>
      </div>
    </CommunitySheet>
  );
}

export function ResourceComposer({
  busy,
  runAction,
  onUploadFile,
  onClose,
}: {
  busy: boolean;
  runAction: RunAction;
  onUploadFile: (input: {
    file: File;
    title: string;
    description?: string;
    visibility: "MEMBERS" | "ADMINS";
  }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"LINK" | "TEXT" | "FILE">("LINK");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [linkType, setLinkType] = useState<"LINK" | "DOCUMENT" | "AUDIO" | "VIDEO" | "IMAGE">("LINK");
  const [contentText, setContentText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = Boolean(title.trim())
    && (mode === "LINK" ? Boolean(url.trim()) : mode === "TEXT" ? Boolean(contentText.trim()) : Boolean(file));

  async function submit() {
    setError("");
    const visibility = adminsOnly ? "ADMINS" as const : "MEMBERS" as const;
    if (mode === "FILE") {
      if (!file) return;
      const ok = await onUploadFile({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (ok) onClose();
      else setError("上传失败，请检查文件后重试");
      return;
    }
    const ok = await runAction({
      action: "CREATE_RESOURCE",
      title: title.trim(),
      description: description.trim() || undefined,
      type: mode === "TEXT" ? "TEXT" : linkType,
      ...(mode === "TEXT" ? { contentText: contentText.trim() } : { url: url.trim() }),
      visibility,
    });
    if (ok) onClose();
    else setError("添加失败，请检查内容后重试");
  }

  return (
    <CommunitySheet
      title="添加资料"
      hint="已解析的资料可被本群助手检索"
      busy={busy}
      submitLabel={mode === "FILE" ? "上传" : "添加"}
      canSubmit={canSubmit}
      error={error}
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Segmented
        label="来源"
        value={mode}
        options={[["LINK", "链接"], ["TEXT", "文本"], ["FILE", "文件"]]}
        onChange={setMode}
      />
      <Field label="资料标题">
        <input value={title} maxLength={100} placeholder="例如：马太福音查经讲义" onChange={(event) => setTitle(event.target.value)} />
      </Field>
      {mode === "LINK" && (
        <>
          <Field label="链接地址">
            <input value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} />
          </Field>
          <Segmented
            label="链接类型"
            value={linkType}
            options={[["LINK", "网页"], ["DOCUMENT", "文档"], ["AUDIO", "音频"], ["VIDEO", "视频"], ["IMAGE", "图片"]]}
            onChange={setLinkType}
          />
        </>
      )}
      {mode === "TEXT" && (
        <Field label="文本内容" hint="将直接加入知识库">
          <textarea value={contentText} rows={7} placeholder="粘贴讲章、笔记或提纲…" onChange={(event) => setContentText(event.target.value)} />
        </Field>
      )}
      {mode === "FILE" && (
        <Field label="选择文件" hint="单个不超过 50 MB">
          <input
            type="file"
            className="community-sheet-file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
      )}
      <Field label="资料说明" hint={mode === "FILE" ? "同时作为检索文字" : "可留空"}>
        <textarea value={description} rows={3} placeholder="简单说明这份资料的用途…" onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Segmented
        label="可见范围"
        value={adminsOnly ? "ADMINS" : "MEMBERS"}
        options={[["MEMBERS", "全体成员"], ["ADMINS", "仅管理员"]]}
        onChange={(next) => setAdminsOnly(next === "ADMINS")}
      />
    </CommunitySheet>
  );
}
