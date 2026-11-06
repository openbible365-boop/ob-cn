# App 安装包下载目录

线上由 App 端 nginx 容器挂载为 `https://app.openbible.live/downloads/`
（见 `deploy/docker-compose.yml` 与 `deploy/app-nginx.conf`）。
网页版「App 下载」页与 App「推荐朋友」页都指向这里的同一个文件：

- 安卓：`openbible-android.apk` → https://app.openbible.live/downloads/openbible-android.apk

## 发布新版本

APK 不进版本库（`.gitignore` 的 `*.apk`），需单独上传到服务器的同一目录，
文件名保持 `openbible-android.apk` 不变（链接与二维码就不用改）：

```bash
scp -i ~/.ssh/id_ed25519 openbible-android.apk root@43.99.101.9:<服务器仓库路径>/downloads/
```

上传后同步更新网页版 `web-app/js/app.js` 的 `APP_DOWNLOADS.android`（版本号、大小）。

## 签名（2026-11-05 定案）

所有版本必须用**同一把签名密钥**，否则已安装的用户无法覆盖升级。

正式发布统一使用 **Joshua 的发布密钥**：

- 证书：`CN=Joshua`
- SHA-256：`bf9b217330d79926eaf7ed115a644c5dcf2a5d4e6bf93a2d97a433b9b77b1980`

发布前用 `apksigner verify --print-certs <apk>` 核对指纹一致。
仓库里 `mobile-app/android/keystore.properties` 指向的本地 OpenBible 密钥库（CN=OpenBible，
SHA-256 `baa0d4a7…96c1`）**已停用**，不要用它签任何对外发布的包。
