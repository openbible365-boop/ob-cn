// 后台功能开关：以 App 端实际开放的功能为标准，对应功能未上线的管理模块先藏起来（页面与接口保留）。
//   社群管理 / 活动监管 / 内容审核（审核对象是社群帖子）—— App 端 SHOW_COMMUNITY=false
//   音频缓存 —— App 端整卷音频缓存功能已下线
// App 端恢复对应功能时翻回 true 即可。侧边栏和各页面（如用户管理的「所属群组」列）共用这里的开关。
export const SHOW_COMMUNITY_ADMIN = false;
export const SHOW_AUDIO_CACHE_ADMIN = false;
