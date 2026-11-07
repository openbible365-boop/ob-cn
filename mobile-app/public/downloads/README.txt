# 本目录只用于在构建产物 dist/ 里保留 downloads/ 挂载点。
# 生产环境的 app 容器把 dist 只读挂到 nginx 根目录，再把仓库 downloads/ 挂到 downloads/；
# 只读父目录里 Docker 无法自动创建子挂载点，缺这个目录容器会启动失败。
# 安装包本身不进版本库，见仓库根目录 downloads/README.md。
