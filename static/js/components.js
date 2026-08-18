import { escapeHtml, deepClone } from './utils.js';

// ==================== 命令树组件 ====================
export class CommandTree {
    constructor(containerId, onSelect) {
        this.container = document.getElementById(containerId);
        this.onSelect = onSelect;
        this.data = [];
        this.expanded = new Set();
        this.searchKeyword = '';
    }

    render(data) {
        this.data = data;
        this.container.innerHTML = this.buildTreeHtml(data);
        this.attachEvents();
    }

    buildTreeHtml(nodes, level = 0) {
        if (!nodes?.length) return '';
        
        return `<ul class="cmd-tree-level" style="padding-left:${level * 16}px">` +
            nodes.map(node => {
                const hasChildren = node.children?.length > 0;
                const isExpanded = this.expanded.has(node.name);
                const isMatch = this.searchKeyword && 
                    (node.name.includes(this.searchKeyword) || 
                     node.description?.includes(this.searchKeyword));
                
                return `
                <li class="cmd-tree-item ${isMatch ? 'highlight' : ''}" data-name="${escapeHtml(node.name)}">
                    <div class="cmd-node ${hasChildren ? 'has-children' : ''}" 
                         onclick="event.stopPropagation(); window.cmdTree.handleClick('${escapeHtml(node.name)}', ${hasChildren})">
                        ${hasChildren ? `<span class="toggle ${isExpanded ? 'expanded' : ''}">▶</span>` : '<span class="toggle-spacer"></span>'}
                        <span class="name">${escapeHtml(node.name)}</span>
                        <span class="desc">${escapeHtml(node.description || '')}</span>
                    </div>
                    ${hasChildren && isExpanded ? this.buildTreeHtml(node.children, level + 1) : ''}
                </li>`;
            }).join('') + '</ul>';
    }

    handleClick(name, hasChildren) {
        const node = this.findNode(this.data, name);
        if (!node) return;

        if (hasChildren) {
            if (this.expanded.has(name)) {
                this.expanded.delete(name);
            } else {
                this.expanded.add(name);
            }
            this.render(this.data); // 重新渲染
        } else {
            // 叶子节点：选中命令
            document.querySelectorAll('.cmd-node').forEach(n => n.classList.remove('active'));
            const el = this.container.querySelector(`[data-name="${CSS.escape(name)}"] > .cmd-node`);
            el?.classList.add('active');
            this.onSelect?.(node);
        }
    }

    findNode(nodes, name) {
        for (const node of nodes) {
            if (node.name === name) return node;
            if (node.children) {
                const found = this.findNode(node.children, name);
                if (found) return found;
            }
        }
        return null;
    }

    filter(keyword) {
        this.searchKeyword = keyword.toLowerCase();
        if (!this.searchKeyword) {
            this.render(this.data);
            return;
        }
        // 高亮匹配项，自动展开父级
        this.render(this.data);
    }

    attachEvents() {
        // 事件已内联在 onclick 中，此处可扩展键盘导航
    }
}

// ==================== 命令构建器组件 ====================
export class CommandBuilder {
    constructor(containerId, onChange) {
        this.container = document.getElementById(containerId);
        this.onChange = onChange;
        this.command = null;      // 当前选中的命令节点
        this.args = {};           // 参数值
        this.nbt = [];            // NBT 标签
    }

    loadCommand(cmdNode) {
        this.command = cmdNode;
        this.args = {};
        this.nbt = [];
        this.render();
        this.onChange?.(this.buildCommand());
    }

    render() {
        if (!this.command) {
            this.container.innerHTML = '<p class="placeholder">请从左侧选择一个命令开始构建</p>';
            return;
        }

        // 根据命令模板生成表单
        const template = this.command.template || '';
        const argMatches = template.match(/<(\w+)>/g) || [];
        
        let html = `<div class="builder-card">
            <h3>${escapeHtml(this.command.name)}</h3>
            <p class="cmd-desc">${escapeHtml(this.command.description || '')}</p>
        </div>`;

        // 参数表单（根据命令类型动态生成）
        html += this.buildArgForm(argMatches);
        
        // NBT 编辑器
        html += this.buildNbtEditor();
        
        this.container.innerHTML = html;
        this.attachFormListeners();
    }

    buildArgForm(argMatches) {
        // 简化示例：根据参数名推断输入类型
        return `<div class="form-section">
            <h4>参数</h4>
            ${argMatches.map(arg => {
                const name = arg.replace(/[<>]/g, '');
                const type = this.inferType(name);
                return `
                <div class="form-row">
                    <label>${escapeHtml(name)}</label>
                    ${this.renderInput(name, type)}
                </div>`;
            }).join('')}
        </div>`;
    }

    inferType(name) {
        const typeMap = {
            'player': 'player', 'target': 'player',
            'item': 'item', 'block': 'item',
            'enchantment': 'enchantment',
            'potion': 'potion',
            'x': 'number', 'y': 'number', 'z': 'number',
            'level': 'number', 'count': 'number'
        };
        return typeMap[name] || 'text';
    }

    renderInput(name, type) {
        const val = this.args[name] || '';
        switch(type) {
            case 'player':
                return `<select onchange="window.builder.setArg('${name}', this.value)">
                    <option value="">选择目标...</option>
                    <option value="@p" ${val==='@p'?'selected':''}>@p (最近玩家)</option>
                    <option value="@a" ${val==='@a'?'selected':''}>@a (所有玩家)</option>
                    <option value="@r" ${val==='@r'?'selected':''}>@r (随机玩家)</option>
                    <option value="@s" ${val==='@s'?'selected':''}>@s (执行者)</option>
                </select><input type="text" placeholder="或输入玩家名" value="${val.startsWith('@')?'':escapeHtml(val)}" onchange="window.builder.setArg('${name}', this.value)">`;
            case 'item':
                return `<input type="text" list="item-list" placeholder="minecraft:diamond" value="${escapeHtml(val)}" onchange="window.builder.setArg('${name}', this.value)">
                        <datalist id="item-list"></datalist>`;
            case 'number':
                return `<input type="number" value="${escapeHtml(val)}" onchange="window.builder.setArg('${name}', this.value)">`;
            default:
                return `<input type="text" value="${escapeHtml(val)}" onchange="window.builder.setArg('${name}', this.value)">`;
        }
    }

    buildNbtEditor() {
        return `<div class="nbt-section">
            <h4>NBT 标签 <button class="btn-sm" onclick="window.builder.addNbt()">+ 添加</button></h4>
            <div id="nbt-list">
                ${this.nbt.map((tag, i) => `
                    <div class="nbt-row">
                        <input type="text" placeholder="键" value="${escapeHtml(tag.key)}" onchange="window.builder.updateNbt(${i}, 'key', this.value)">
                        <select onchange="window.builder.updateNbt(${i}, 'type', this.value)">
                            <option value="string" ${tag.type==='string'?'selected':''}>字符串</option>
                            <option value="int" ${tag.type==='int'?'selected':''}>整数</option>
                            <option value="bool" ${tag.type==='bool'?'selected':''}>布尔</option>
                        </select>
                        <input type="text" placeholder="值" value="${escapeHtml(tag.value)}" onchange="window.builder.updateNbt(${i}, 'value', this.value)">
                        <button class="btn-danger btn-sm" onclick="window.builder.removeNbt(${i})">删除</button>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    setArg(key, value) {
        this.args[key] = value;
        this.onChange?.(this.buildCommand());
    }

    addNbt() {
        this.nbt.push({ key: '', type: 'string', value: '' });
        this.render();
    }

    updateNbt(index, field, value) {
        if (this.nbt[index]) {
            this.nbt[index][field] = value;
            this.onChange?.(this.buildCommand());
        }
    }

    removeNbt(index) {
        this.nbt.splice(index, 1);
        this.render();
        this.onChange?.(this.buildCommand());
    }

    buildCommand() {
        if (!this.command) return '/';
        let cmd = this.command.template || '';
        
        // 替换参数
        for (const [key, val] of Object.entries(this.args)) {
            if (val) cmd = cmd.replace(`<${key}>`, val);
        }
        
        // 附加 NBT
        if (this.nbt.length > 0) {
            const nbtStr = this.compileNbt();
            if (nbtStr) cmd += ` ${nbtStr}`;
        }
        
        return cmd;
    }

    compileNbt() {
        const pairs = this.nbt
            .filter(t => t.key && t.value)
            .map(t => {
                let v = t.value;
                if (t.type === 'string') v = `"${v}"`;
                return `${t.key}:${v}`;
            });
        return pairs.length ? `{${pairs.join(',')}}` : '';
    }

    attachFormListeners() {
        // 动态加载 datalist（物品列表等）
        this.loadCatalogs();
    }

    async loadCatalogs() {
        // 从后端获取物品/附魔/药水列表填充 datalist
        try {
            const res = await fetch('/api/catalogs');
            const data = await res.json();
            
            const itemList = document.getElementById('item-list');
            if (itemList && data.items) {
                itemList.innerHTML = data.items.map(i => 
                    `<option value="${escapeHtml(i.id || i)}">`
                ).join('');
            }
        } catch(e) {
            console.error('加载目录失败:', e);
        }
    }

    clear() {
        this.command = null;
        this.args = {};
        this.nbt = [];
        this.render();
        this.onChange?.('/');
    }
}