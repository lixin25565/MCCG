import { api } from './api.js';
import { storage, debounce } from './utils.js';
import { CommandTree, CommandBuilder } from './components.js';

// ==================== 应用主类 ====================
class App {
    constructor() {
        this.connected = false;
        this.commandTree = null;
        this.builder = null;
        this.savedCommands = storage.get('savedCommands', []);
        this.logLines = [];
        this.maxLogLines = 500;
        
        this.init();
    }

    async init() {
        // 初始化命令树
        this.commandTree = new CommandTree('cmd-tree', (node) => {
            this.builder.loadCommand(node);
        });
        window.cmdTree = this.commandTree;

        // 初始化构建器
        this.builder = new CommandBuilder('builder', (cmd) => {
            this.updatePreview(cmd);
        });
        window.builder = this.builder;

        // 加载命令数据
        try {
            const [commands, specs] = await Promise.all([
                api.getCommands(),
                api.getCommandSpecs()
            ]);
            this.commandTree.render(commands);
            this.commandSpecs = specs;
        } catch(e) {
            this.log('加载命令数据失败: ' + e.message, 'error');
        }

        // 恢复连接信息
        const connInfo = storage.get('rconConnection');
        if (connInfo) {
            document.getElementById('host').value = connInfo.host || '127.0.0.1';
            document.getElementById('port').value = connInfo.port || 25575;
        }

        // 搜索防抖
        this.debouncedSearch = debounce((k) => this.commandTree.filter(k), 150);
    }

    // ========== RCON 连接 ==========
    async connect() {
        const host = document.getElementById('host').value.trim() || '127.0.0.1';
        const port = parseInt(document.getElementById('port').value) || 25575;
        const password = document.getElementById('password').value;

        this.setStatus('connecting', '连接中...');
        
        try {
            const res = await api.connect(host, port, password);
            if (res.success) {
                this.connected = true;
                this.setStatus('connected', '已连接');
                storage.set('rconConnection', { host, port });
                this.log(`RCON 连接成功: ${host}:${port}`, 'success');
            } else {
                throw new Error(res.message);
            }
        } catch(e) {
            this.connected = false;
            this.setStatus('error', '连接失败');
            this.log('连接失败: ' + e.message, 'error');
        }
    }

    async disconnect() {
        try {
            await api.disconnect();
            this.connected = false;
            this.setStatus('disconnected', '未连接');
            this.log('RCON 已断开', 'info');
        } catch(e) {
            this.log('断开失败: ' + e.message, 'error');
        }
    }

    setStatus(state, text) {
        const dot = document.getElementById('status-dot');
        const label = document.getElementById('status-text');
        dot.className = 'status-dot ' + state;
        label.textContent = text;
    }

    // ========== 命令操作 ==========
    updatePreview(cmd) {
        document.getElementById('command-preview').textContent = cmd;
    }

    async sendCommand() {
        const cmd = document.getElementById('command-preview').textContent.trim();
        if (!cmd || cmd === '/') {
            this.log('命令为空', 'warning');
            return;
        }

        this.log(`> ${cmd}`, 'send');
        
        if (!this.connected) {
            this.log('未连接到服务器', 'error');
            return;
        }

        try {
            const res = await api.sendCommand(cmd);
            if (res.success) {
                this.log(res.response || '执行成功', 'recv');
            } else {
                this.log('错误: ' + res.message, 'error');
            }
        } catch(e) {
            this.log('发送失败: ' + e.message, 'error');
        }
    }

    copyCommand() {
        const cmd = document.getElementById('command-preview').textContent;
        navigator.clipboard.writeText(cmd).then(() => {
            this.log('命令已复制到剪贴板', 'info');
        });
    }

    saveCommand() {
        const cmd = document.getElementById('command-preview').textContent;
        if (cmd === '/') return;
        
        this.savedCommands.unshift({
            id: Date.now(),
            command: cmd,
            time: new Date().toLocaleString()
        });
        storage.set('savedCommands', this.savedCommands);
        this.log('命令已保存', 'info');
    }

    clearBuilder() {
        this.builder.clear();
        document.querySelectorAll('.cmd-node').forEach(n => n.classList.remove('active'));
    }

    // ========== 搜索 ==========
    searchCommands(keyword) {
        this.debouncedSearch(keyword);
    }

    // ========== 日志 ==========
    log(message, type = 'info') {
        const logEl = document.getElementById('log');
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
        
        logEl.appendChild(entry);
        this.logLines.push(entry);
        
        // 限制行数
        while (this.logLines.length > this.maxLogLines) {
            this.logLines.shift().remove();
        }
        
        logEl.scrollTop = logEl.scrollHeight;
    }

    clearLog() {
        document.getElementById('log').innerHTML = '';
        this.logLines = [];
    }
}

// 挂载到全局供内联事件调用
window.App = new App();