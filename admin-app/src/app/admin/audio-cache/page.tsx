import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { purgeAudioCache, toggleAudioCache } from "@/lib/actions/audio-cache";
import { audioCacheStats, getAudioCacheSettings } from "@/lib/audio-cache";
import { Badge, Grid, PageHeader, Section, Stat } from "@/components/ui/Primitives";
import { EmptyState } from "@/components/ui/States";

function readableBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const VOICE_LABEL: Record<string, string> = {
  female: "知性女声",
  male: "开朗学长",
  unknown: "未归类",
};

export default async function AudioCachePage() {
  // 与侧边栏一致：仅超级管理员（操作本身也只允许超级管理员）
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/admin/dashboard");
  const [settings, stats] = await Promise.all([
    getAudioCacheSettings(),
    audioCacheStats(),
  ]);

  return (
    <>
      <PageHeader
        title="音频缓存"
        meta="App 端整卷语音缓存下载经由服务端转发；这里管理服务端的磁盘缓存"
        actions={(
          <Badge tone={settings.enabled ? "ok" : "warn"}>
            {settings.enabled ? "缓存已开启" : "缓存已关闭"}
          </Badge>
        )}
      />

      <Section
        title="缓存占用"
        hint="用户第一次请求某章音频时回源拉取并落盘，之后同章直接本地出"
      >
        <Grid min="180px">
          <Stat label="缓存文件" value={stats.files} hint="按 章 × 音色 计" />
          <Stat label="磁盘占用" value={readableBytes(stats.bytes)} />
          {Object.entries(stats.byVoice).map(([voice, item]) => (
            <Stat
              key={voice}
              label={`${VOICE_LABEL[voice] ?? voice} 音色`}
              value={item.files}
              hint={readableBytes(item.bytes)}
            />
          ))}
        </Grid>
        {stats.files === 0 && (
          <EmptyState
            title="还没有缓存任何音频"
            hint="用户在 App 语音圣经里播放或整卷下载后，这里会出现对应章节的缓存文件。"
          />
        )}
      </Section>

      <Section
        title="缓存管理"
        hint="关闭后每次请求都回源上游；清空只删磁盘文件，不影响用户设备上已下载的整卷缓存"
      >
        <div style={{ display: "flex", gap: 10 }}>
          <form action={toggleAudioCache}>
            <button type="submit" className="action-body">
              {settings.enabled ? "关闭服务端缓存" : "开启服务端缓存"}
            </button>
          </form>
          <form action={purgeAudioCache}>
            <button
              type="submit"
              className="action-purple"
              title="删除服务端已落盘的全部音频文件"
            >
              清空缓存（{readableBytes(stats.bytes)}）
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}
