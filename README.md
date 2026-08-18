# MCCG — Minecraft Command Generator & RCON Tool

**MCCG** 是一个基于 Flask 的轻量级 Web 工具，用于可视化生成 Minecraft 命令，并可通过 RCON 协议直接发送至游戏服务器。适用于服务器管理员、地图制作者和命令初学者。

## ✨ 主要功能

- 🖱️ **可视化命令构造** – 通过树形结构选择命令、子命令及参数，实时生成标准 Minecraft 指令。
- 📚 **内置数据目录** – 集成物品、附魔、药水等 JSON 数据，提供自动补全与校验。
- 🛠️ **RCON 远程执行** – 连接至开启 RCON 的 Minecraft 服务器，一键发送命令。
- 🌐 **RESTful API** – 前后端分离设计，提供 `/api/commands`、`/api/catalogs` 等接口，便于集成。
- 🔄 **易于扩展** – 通过修改 `catalogs/commands.yaml` 即可添加新命令或自定义参数。

## 🚀 快速开始

### 环境要求
- Python 3.7+
- pip

### 安装步骤
```bash
# 克隆仓库
git clone https://github.com/lixin25565/MCCG.git
cd MCCG

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt