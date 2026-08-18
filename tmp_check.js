
        let commandTree = [];
        let selectedPath = [];
        let currentCommandString = '';
        let isConnected = false;
        let savedCommands = [];
        let commandGroups = [];
        let COMMAND_SPECS = {};
        let COMMON_COMMAND_PRIORITY = [];
        let HIDDEN_COMMANDS = new Set();

        const STORAGE_KEY = 'mccg_saved_commands';
        const GROUP_STORAGE_KEY = 'mccg_command_groups';
        const PLAYER_STORAGE_KEY = 'mccg_player_manager';
        let ITEM_OPTIONS = [];
        let ENCHANT_OPTIONS = [];
        let POTION_EFFECT_OPTIONS = [];
        let playerManager = [];

        function sortCommandTree(nodes) {
            if (!Array.isArray(nodes)) return [];
            const priority = new Map(COMMON_COMMAND_PRIORITY.map((name, idx) => [name, idx]));
            return [...nodes].sort((a, b) => {
                const aRank = priority.get(a.name) ?? Number.MAX_SAFE_INTEGER;
                const bRank = priority.get(b.name) ?? Number.MAX_SAFE_INTEGER;
                if (aRank !== bRank) return aRank - bRank;
                return String(a.name).localeCompare(String(b.name), 'zh-CN');
            });
        }

        function loadStoredState() {
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                const groups = JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || '[]');
                const players = JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY) || '[]');
                savedCommands = Array.isArray(saved) ? saved : [];
                commandGroups = Array.isArray(groups) ? groups : [];
                playerManager = Array.isArray(players) ? players : [];
            } catch (error) {
                savedCommands = [];
                commandGroups = [];
                playerManager = [];
            }
        }

        function saveStoredState() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCommands));
            localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(commandGroups));
            localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(playerManager));
        }

        function renderSavedCommands() {
            const list = document.getElementById('saved-command-list');
            const select = document.getElementById('command-group-select');
            const groupList = document.getElementById('command-group-list');
            const playerList = document.getElementById('player-manager-list');

            if (list) {
                if (!savedCommands.length) {
                    list.innerHTML = '<div class="saved-command-item"><span class="saved-command-text">暂无保存命令</span></div>';
                } else {
                    list.innerHTML = savedCommands.map((saved) => `
                        <div class="saved-command-item">
                            <span class="saved-command-text">${escapeHtml(saved.name || '未命名命令')}</span>
                            <div class="saved-command-action">
                                <button class="btn-secondary" onclick="executeSavedCommand('${saved.id}')">执行</button>
                                <button class="btn-secondary" onclick="removeSavedCommand('${saved.id}')">删除</button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            if (groupList) {
                if (!commandGroups.length) {
                    groupList.innerHTML = '<div class="group-item"><span class="group-item-name">暂无命令组</span></div>';
                } else {
                    groupList.innerHTML = commandGroups.map((group) => `
                        <div class="group-item">
                            <span class="group-item-name">${escapeHtml(group.name)}</span>
                            <div class="saved-command-action">
                                <button class="btn-secondary" onclick="selectGroup('${group.id}')">选择</button>
                                <button class="btn-secondary" onclick="deleteCommandGroup('${group.id}')">删除</button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            if (select) {
                const options = commandGroups.length
                    ? commandGroups.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join('')
                    : '<option value="">请选择命令组</option>';
                select.innerHTML = options;
            }

            if (playerList) {
                if (!playerManager.length) {
                    playerList.innerHTML = '<div class="player-item"><span class="name">暂无玩家</span></div>';
                } else {
                    playerList.innerHTML = playerManager.map((player) => `
                        <div class="player-item">
                            <span class="name">${escapeHtml(player.name)}</span>
                            <div class="saved-command-action">
                                <button class="btn-secondary" onclick="runPlayerCommand(${JSON.stringify(player.name)})">执行</button>
                                <button class="btn-secondary" onclick="removePlayerFromManager('${player.id}')">删除</button>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        function createUuid() {
            return 'cmd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        }

        function openCommandGroupWindow() {
            const modal = document.getElementById('command-group-window');
            if (!modal) return;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            renderSavedCommands();
        }

        function closeCommandGroupWindow() {
            const modal = document.getElementById('command-group-window');
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        function openPlayerManagerWindow() {
            const modal = document.getElementById('player-manager-window');
            if (!modal) return;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            renderSavedCommands();
        }

        function closePlayerManagerWindow() {
            const modal = document.getElementById('player-manager-window');
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        function toggleApplyPlayerGroup(checked) {
            const input = document.getElementById('player-name-input');
            const hint = document.getElementById('player-manager-hint');
            if (input) {
                input.disabled = checked;
                input.placeholder = checked ? '用户名已禁用，当前应用用户组' : '输入玩家名';
                if (checked) input.value = '';
            }
            if (hint) {
                hint.style.display = checked ? 'block' : 'none';
            }
            if (checked) {
                log('已应用用户组：命令将按玩家管理列表执行，用户名输入已禁用', 'info');
            }
        }

        function addPlayerToManager() {
            const input = document.getElementById('player-name-input');
            const name = (input?.value || '').trim();
            if (!name) {
                log('请输入玩家名', 'error');
                return;
            }
            if (!playerManager.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
                playerManager.push({ id: createUuid(), name });
                saveStoredState();
                renderSavedCommands();
                log('已添加玩家：' + name, 'info');
            } else {
                log('玩家已存在：' + name, 'info');
            }
            if (input) input.value = '';
        }

        function removePlayerFromManager(id) {
            playerManager = playerManager.filter((player) => player.id !== id);
            saveStoredState();
            renderSavedCommands();
            log('已删除玩家', 'info');
        }

        function buildPlayerCommandList(commandText) {
            const command = String(commandText || '').trim();
            if (!command) return [];
            const shouldApplyGroup = document.getElementById('apply-player-group')?.checked;
            const names = shouldApplyGroup
                ? (playerManager.length ? playerManager.map((player) => player.name) : [])
                : ['player_name'];
            if (!names.length) return [command];
            if (!/\{player\}|\bplayer_name\b/i.test(command)) {
                return [command];
            }
            return names.map((playerName) => command
                .replace(/\{player\}/gi, playerName)
                .replace(/\bplayer_name\b/gi, playerName));
        }

        function runPlayerCommand(playerName) {
            const command = (document.getElementById('player-command-input')?.value || '').trim();
            if (!command) {
                log('请先输入要发送给玩家的命令', 'error');
                return;
            }
            const shouldApplyGroup = document.getElementById('apply-player-group')?.checked;
            const commands = buildPlayerCommandList(command);
            const targetName = String(playerName || '').trim();
            if (!shouldApplyGroup && !targetName) {
                log('玩家名为空', 'error');
                return;
            }
            const resolved = shouldApplyGroup
                ? commands
                : commands.map((item) => item.replace(/\{player\}/gi, targetName).replace(/\bplayer_name\b/gi, targetName));
            resolved.forEach((item) => sendCommandRequest(item));
        }

        function executePlayerCommands() {
            const command = (document.getElementById('player-command-input')?.value || '').trim();
            if (!command) {
                log('请先输入批量命令', 'error');
                return;
            }
            const shouldApplyGroup = document.getElementById('apply-player-group')?.checked;
            if (shouldApplyGroup) {
                if (!playerManager.length) {
                    log('用户组为空，无法应用', 'info');
                    return;
                }
                log('已应用用户组执行：' + playerManager.map((player) => player.name).join(', '), 'info');
            }
            const generated = buildPlayerCommandList(command);
            if (!generated.length) {
                log('没有可执行的玩家目标', 'info');
                return;
            }
            generated.forEach((item) => sendCommandRequest(item));
        }

        function saveCurrentCommand() {
            const input = document.getElementById('saved-command-name');
            const backupInput = document.getElementById('saved-command-name-hidden');
            const name = (input?.value || backupInput?.value || '').trim() || prompt('请输入该命令的名称：', '快捷命令') || '快捷命令';
            const command = currentCommandString.trim();
            if (!command) {
                log('当前没有命令可保存', 'error');
                return;
            }
            const item = { id: createUuid(), name, command, createdAt: Date.now() };
            savedCommands.unshift(item);
            saveStoredState();
            renderSavedCommands();
            if (input) input.value = '';
            if (backupInput) backupInput.value = '';
            log('已保存命令：' + name, 'info');
        }

        function removeSavedCommand(id) {
            savedCommands = savedCommands.filter((item) => item.id !== id);
            commandGroups = commandGroups.map((group) => ({
                ...group,
                commands: (group.commands || []).filter((cmdId) => cmdId !== id)
            }));
            saveStoredState();
            renderSavedCommands();
            log('已删除保存命令', 'info');
        }

        function createCommandGroup() {
            const input = document.getElementById('new-group-name');
            const name = (input?.value || '').trim() || prompt('请输入命令组名称：', '默认组') || '默认组';
            const group = { id: createUuid(), name, commands: [] };
            commandGroups.push(group);
            saveStoredState();
            renderSavedCommands();
            if (input) input.value = '';
            log('已创建命令组：' + name, 'info');
        }

        function selectGroup(groupId) {
            const select = document.getElementById('command-group-select');
            if (!select) return;
            select.value = groupId;
            log('已选择命令组：' + (commandGroups.find((group) => group.id === groupId)?.name || '未知组'), 'info');
        }

        function deleteCommandGroup(groupId) {
            const group = commandGroups.find((item) => item.id === groupId);
            if (!group) {
                log('未找到命令组', 'error');
                return;
            }
            commandGroups = commandGroups.filter((item) => item.id !== groupId);
            const select = document.getElementById('command-group-select');
            if (select && select.value === groupId) select.value = '';
            saveStoredState();
            renderSavedCommands();
            log('已删除命令组：' + group.name, 'info');
        }

        function addCurrentCommandToGroup() {
            const select = document.getElementById('command-group-select');
            const groupId = select?.value;
            const command = currentCommandString.trim();
            if (!groupId) {
                log('请先选择一个命令组', 'error');
                return;
            }
            if (!command) {
                log('当前没有命令可加入组', 'error');
                return;
            }
            const group = commandGroups.find((item) => item.id === groupId);
            if (!group) {
                log('命令组不存在', 'error');
                return;
            }
            const existing = savedCommands.find((item) => item.command === command);
            const saved = existing || { id: createUuid(), name: '临时命令', command, createdAt: Date.now() };
            if (!existing) savedCommands.unshift(saved);
            if (!group.commands.includes(saved.id)) group.commands.push(saved.id);
            saveStoredState();
            renderSavedCommands();
            log('已加入组：' + group.name, 'info');
        }

        async function executeSavedCommand(id) {
            const saved = savedCommands.find((item) => item.id === id);
            if (!saved) {
                log('未找到保存的命令', 'error');
                return;
            }
            await sendCommandRequest(saved.command);
        }

        async function executeSelectedGroup() {
            const select = document.getElementById('command-group-select');
            const groupId = select?.value;
            const group = commandGroups.find((item) => item.id === groupId);
            if (!group) {
                log('请先选择命令组', 'error');
                return;
            }
            const commands = (group.commands || [])
                .map((id) => savedCommands.find((entry) => entry.id === id))
                .filter(Boolean)
                .map((entry) => entry.command)
                .filter(Boolean);
            if (!commands.length) {
                log('命令组为空，无法执行', 'info');
                return;
            }
            log('开始执行命令组：' + group.name, 'info');
            for (const command of commands) {
                await sendCommandRequest(command);
            }
            log('命令组执行完成：' + group.name, 'info');
        }

        function getItemCategory(itemValue) {
            const value = String(itemValue || '').toLowerCase();
            if (!value) return 'general';
            if (value.includes('sword')) return 'sword';
            if (value.includes('helmet') || value.includes('chestplate') || value.includes('leggings') || value.includes('boots')) return 'armor';
            if (value.includes('pickaxe') || value.includes('axe') || value.includes('shovel') || value.includes('hoe')) return 'tool';
            if (value.includes('bow') || value.includes('crossbow') || value.includes('trident')) return 'ranged';
            if (value.includes('potion')) return 'potion';
            return 'general';
        }

        function getAllowedEnchantmentsForItem(itemValue) {
            const category = getItemCategory(itemValue);
            const map = {
                sword: ['minecraft:sharpness', 'minecraft:smite', 'minecraft:bane_of_arthropods', 'minecraft:looting', 'minecraft:knockback', 'minecraft:fire_aspect', 'minecraft:sweeping', 'minecraft:unbreaking', 'minecraft:mending'],
                armor: ['minecraft:protection', 'minecraft:fire_protection', 'minecraft:blast_protection', 'minecraft:projectile_protection', 'minecraft:thorns', 'minecraft:respiration', 'minecraft:aqua_affinity', 'minecraft:unbreaking', 'minecraft:mending'],
                tool: ['minecraft:efficiency', 'minecraft:unbreaking', 'minecraft:silkence', 'minecraft:looting', 'minecraft:fortune', 'minecraft:luck_of_the_sea'],
                ranged: ['minecraft:power', 'minecraft:punch', 'minecraft:flame', 'minecraft:infinity', 'minecraft:quick_charge', 'minecraft:multishot', 'minecraft:piercing', 'minecraft:unbreaking'],
                general: Array.from(new Set(ENCHANT_OPTIONS.map(([value]) => value)))
            };
            return new Set(map[category] || map.general);
        }

        function shouldShowPotionSection(itemValue) {
            const value = String(itemValue || '').toLowerCase();
            return value.includes('potion') || value.includes('splash_potion') || value.includes('lingering_potion');
        }

        function refreshGiveFormState() {
            const itemSelect = document.getElementById('give-item');
            const itemValue = itemSelect ? itemSelect.value : 'minecraft:diamond_sword';
            const potionSection = document.getElementById('potion-list')?.closest('.nbt-section');
            const enchantSection = document.getElementById('enchant-list')?.closest('.nbt-section');

            if (potionSection) {
                potionSection.style.display = shouldShowPotionSection(itemValue) ? '' : 'none';
            }
            if (enchantSection) {
                const allowed = getAllowedEnchantmentsForItem(itemValue);
                enchantSection.style.display = allowed.size ? '' : 'none';
            }

            document.querySelectorAll('#enchant-list .ench-id').forEach((select) => {
                const options = Array.from(select.options);
                const validSet = getAllowedEnchantmentsForItem(itemValue);
                let firstVisible = null;
                options.forEach((option) => {
                    const allowed = validSet.has(option.value);
                    option.hidden = !allowed;
                    option.disabled = !allowed;
                    if (allowed && !firstVisible) firstVisible = option;
                });
                if (!options.some((option) => !option.hidden && option.value === select.value)) {
                    select.value = firstVisible ? firstVisible.value : options[0]?.value || '';
                }
            });
        }

        function renderSelectOptions(options, value, className, extra = '') {
            const list = Array.isArray(options) ? options : [];
            const selected = value || (list[0] ? list[0][0] : '');
            const html = list.length
                ? list.map(([optionValue, label]) => `<option value="${optionValue}" ${optionValue === selected ? 'selected' : ''}>${label}</option>`).join('')
                : '<option value="">无可用选项</option>';
            return `<select class="${className}" ${extra}>${html}</select>`;
        }

        function filterCatalogSelect(searchInput) {
            const select = searchInput.parentElement.querySelector('select');
            if (!select) return;
            const query = (searchInput.value || '').trim().toLowerCase();
            Array.from(select.options).forEach((option) => {
                const text = `${option.value} ${option.textContent}`.toLowerCase();
                const show = !query || text.includes(query);
                option.hidden = !show;
                option.disabled = !show;
            });
            if (query && !Array.from(select.options).some((option) => !option.hidden)) {
                select.selectedIndex = -1;
            } else if (select.selectedIndex < 0) {
                const firstVisible = Array.from(select.options).find((option) => !option.hidden);
                if (firstVisible) select.value = firstVisible.value;
            }
        }

        function loadCommandMetadata() {
            return fetch('/api/command-specs')
                .then((res) => res.json())
                .then((data) => {
                    COMMON_COMMAND_PRIORITY = Array.isArray(data.priority) ? data.priority : [];
                    HIDDEN_COMMANDS = new Set(Array.isArray(data.hidden_commands) ? data.hidden_commands : []);
                    COMMAND_SPECS = data.specs || {};
                })
                .catch((error) => {
                    console.error('加载命令元数据失败', error);
                    COMMON_COMMAND_PRIORITY = [];
                    HIDDEN_COMMANDS = new Set();
                    COMMAND_SPECS = {};
                });
        }

        function resolveCommandSpec(path) {
            if (!path || path.length === 0) {
                return { label: '通用命令', fields: [{ name: 'args', type: 'text', label: '参数', default: '' }], build: (values) => values.args ? `${values.args}` : '' };
            }

            const root = COMMAND_SPECS[path[0]];
            if (!root) {
                return {
                    label: path[path.length - 1],
                    fields: [{ name: 'args', type: 'text', label: '参数', default: '' }],
                    build: (values) => values.args ? `${path.join(' ')} ${values.args}` : `${path.join(' ')}`
                };
            }

            if (path.length === 1) return root;
            if (root.subcommands && root.subcommands[path[1]]) {
                const second = root.subcommands[path[1]];
                if (path.length === 2) return second;
                if (second.subcommands && second.subcommands[path[2]]) {
                    return second.subcommands[path[2]];
                }
            }

            return root;
        }

        function buildCommandFromFields(basePath, values) {
            const parts = [basePath.trim()];
            Object.keys(values || {}).forEach((key) => {
                const value = values[key];
                if (value === undefined || value === null || value === '') return;
                if (key === 'json' && typeof value === 'string') {
                    parts.push(value.trim());
                    return;
                }
                parts.push(String(value).trim());
            });
            return parts.join(' ');
        }

        function buildGiveCommand(values) {
            const target = values.target || 'player_name';
            const item = values.item || 'minecraft:diamond_sword';
            const count = values.count || 1;
            const itemComponents = buildGiveComponents();
            return itemComponents ? `give ${target} ${item}[${itemComponents}] ${count}` : `give ${target} ${item} ${count}`;
        }

        function buildGiveComponents() {
            const components = [];
            const enchRows = document.querySelectorAll('#enchant-list .nbt-row');
            if (enchRows.length > 0) {
                const levels = {};
                enchRows.forEach((row) => {
                    const id = row.querySelector('.ench-id')?.value.trim();
                    const lvl = Number(row.querySelector('.ench-lvl')?.value || 1);
                    if (id) levels[id] = lvl;
                });
                if (Object.keys(levels).length) {
                    const levelsText = Object.entries(levels)
                        .map(([key, value]) => `"${escapeNbtString(key)}":${Number(value)}`)
                        .join(',');
                    components.push(`minecraft:enchantments={levels:{${levelsText}}}`);
                }
            }

            const attrRows = document.querySelectorAll('#attr-list .nbt-row');
            if (attrRows.length > 0) {
                const attributes = [];
                attrRows.forEach((row) => {
                    const name = row.querySelector('.attr-name')?.value.trim();
                    const amount = row.querySelector('.attr-amount')?.value;
                    const op = row.querySelector('.attr-op')?.value;
                    const uuid = row.querySelector('.attr-uuid')?.value.trim();
                    if (!name || !uuid) return;
                    const uuidInts = uuid.split(',').map(v => Number(v.trim())).filter(v => !Number.isNaN(v));
                    if (uuidInts.length !== 4) return;
                    attributes.push(`{attribute:"${escapeNbtString(name)}",amount:${amount},operation:${op},uuid:[I;${uuidInts.join(',')}]}`);
                });
                if (attributes.length) components.push(`minecraft:attribute_modifiers={modifiers:[${attributes.join(',')}]}`);
            }

            const potionRows = document.querySelectorAll('#potion-list .nbt-row');
            if (potionRows.length > 0) {
                const effects = [];
                potionRows.forEach((row) => {
                    const id = row.querySelector('.potion-id')?.value;
                    const amp = row.querySelector('.potion-amp')?.value;
                    const dur = row.querySelector('.potion-dur')?.value;
                    if (id !== undefined && id !== '') effects.push(`{id:"${escapeNbtString(id)}",amplifier:${amp},duration:${dur}}`);
                });
                if (effects.length) components.push(`minecraft:potion_contents={custom_effects:[${effects.join(',')}]}`);
            }

            if (document.getElementById('give-unbreakable')?.checked) {
                components.push('minecraft:unbreakable={}');
            }

            const customName = document.getElementById('give-custom-name')?.value.trim();
            if (customName) {
                components.push(`minecraft:custom_name='{"text":"${escapeNbtString(customName)}"}'`);
            }

            const loreLines = (document.getElementById('give-lore')?.value || '').split('\n').filter(line => line.trim());
            if (loreLines.length) {
                const loreJson = loreLines.map(line => `"${escapeNbtString(line)}"`).join(',');
                components.push(`minecraft:lore=[${loreJson}]`);
            }

            const extraNbt = document.getElementById('give-extra-nbt')?.value.trim();
            if (extraNbt) {
                components.push(extraNbt.replace(/^\{|\}$/g, '').trim());
            }

            return components.join(',');
        }

        function escapeNbtString(value) {
            return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        }

        function readFormValues(spec) {
            const values = {};
            if (!spec || !spec.fields) return values;
            spec.fields.forEach((field) => {
                const el = document.querySelector(`[data-field="${field.name}"]`);
                if (!el) return;
                values[field.name] = el.value;
            });
            return values;
        }

        function hasAtSelector(value) {
            return typeof value === 'string' && /(?:^|\s)@(?:a|e|p|r|s)\b/.test(value.trim());
        }

        function validateCommand(path, values) {
            const issues = [];
            const last = path[path.length - 1] || '';
            const isNameLike = (value) => typeof value === 'string' && !hasAtSelector(value) && value.trim().length > 0;

            if (last === 'give') {
                if (!values.target || !isNameLike(values.target)) issues.push('RCON 不接受 @ 选择器，请填写具体玩家名');
                if (!values.item || !/^([a-z0-9_\-.]+:)?[a-z0-9_\-.]+$/.test(values.item.trim())) issues.push('物品 ID 格式不正确');
            }

            if (last === 'teleport' && (!values.targets || !isNameLike(values.targets))) {
                issues.push('RCON 不接受 @ 选择器，请填写具体目标名');
            }

            if (last === 'time' && !values.time) {
                issues.push('时间值不能为空');
            }

            if (last === 'summon' && (!values.entity || !/^([a-z0-9_\-.]+:)?[a-z0-9_\-.]+$/.test(values.entity.trim()))) {
                issues.push('实体 ID 格式不正确');
            }

            return issues;
        }

        function renderField(field) {
            const common = `data-field="${field.name}" ${field.required ? 'required' : ''}`;

            switch (field.type) {
                case 'selector':
                    return `<div class="form-row"><label>${field.label}</label><input type="text" ${common} value="${field.default || 'player_name'}" oninput="updatePreview()" placeholder="请输入玩家名"></div>`;
                case 'item':
                    return `
                        <div class="form-row">
                            <label>${field.label}</label>
                            <div style="display:flex;flex:1;flex-direction:column;gap:6px;min-width:200px;">
                                <input type="text" class="catalog-search" placeholder="搜索物品..." oninput="filterCatalogSelect(this)" style="min-width:0;" />
                                ${renderSelectOptions(ITEM_OPTIONS, field.default || 'minecraft:diamond_sword', 'item-select catalog-select', `data-field="${field.name}" id="give-item" onchange="updatePreview()"`)}
                            </div>
                        </div>
                    `;
                case 'effect':
                    return `<div class="form-row"><label>${field.label}</label>${renderSelectOptions(POTION_EFFECT_OPTIONS, field.default || 'minecraft:speed', 'effect-select', `data-field="${field.name}" onchange="updatePreview()"`)}</div>`;
                case 'int':
                    return `<div class="form-row"><label>${field.label}</label><input type="number" ${common} value="${field.default || 0}" min="${field.min || 0}" max="${field.max || 999999}" oninput="updatePreview()"></div>`;
                case 'number':
                    return `<div class="form-row"><label>${field.label}</label><input type="number" step="0.1" ${common} value="${field.default || 0}" oninput="updatePreview()"></div>`;
                case 'pos':
                    return `<div class="form-row"><label>${field.label}</label><input type="text" ${common} value="${field.default || '~ ~1 ~'}" oninput="updatePreview()"></div>`;
                case 'json':
                    return `<div class="form-row"><label>${field.label}</label><textarea ${common} rows="2" oninput="updatePreview()">${field.default || '{"text":""}'}</textarea></div>`;
                case 'text':
                    return `<div class="form-row"><label>${field.label}</label><input type="text" ${common} value="${field.default || ''}" oninput="updatePreview()"></div>`;
                case 'enum': {
                    const opts = (field.options || []).map((opt) => `<option value="${opt}" ${opt === field.default ? 'selected' : ''}>${opt}</option>`).join('');
                    return `<div class="form-row"><label>${field.label}</label><select ${common} onchange="updatePreview()">${opts}</select></div>`;
                }
                case 'custom':
                    return `<div class="form-row"><label>${field.label}</label><input type="text" ${common} value="${field.default || ''}" oninput="updatePreview()"></div>`;
                default:
                    return `<div class="form-row"><label>${field.label}</label><input type="text" ${common} value="${field.default || ''}" oninput="updatePreview()"></div>`;
            }
        }

        function renderSchemaFields(spec, path) {
            if (!spec || (!spec.fields && !spec.subcommands)) {
                return `
                    <div class="nbt-section">
                        <h4>${path[path.length - 1] || '通用命令'}</h4>
                        <div class="form-row"><label>命令前缀</label><input type="text" value="${path.join(' ')}" readonly style="opacity:0.7;"></div>
                        <div class="form-row"><label>参数</label><input type="text" id="generic-args" oninput="updatePreview()" placeholder="用空格分隔的参数..."></div>
                        <div class="form-row"><label>自定义输入</label><input type="text" id="custom-command-tail" oninput="updatePreview()" placeholder="可追加自定义参数"></div>
                    </div>
                `;
            }

            const fieldsHtml = spec.fields ? spec.fields.map((field) => renderField(field)).join('') : '';
            return `
                <div class="nbt-section">
                    <h4>${spec.label || path[path.length - 1] || '命令'}</h4>
                    <div class="form-row"><label>命令前缀</label><input type="text" value="${path.join(' ')}" readonly style="opacity:0.7;"></div>
                    ${fieldsHtml}
                    <div class="form-row"><label>自定义输入</label><input type="text" id="custom-command-tail" oninput="updatePreview()" placeholder="额外参数 / 备注 / 兜底输入"></div>
                    <div id="command-validation" style="display:none; margin-top:12px; font-size:0.8rem; color:#f39c12;"></div>
                </div>
            `;
        }

        function buildGiveForm() {
            return `
                <div class="nbt-section">
                    <h4>基本信息</h4>
                    <div class="form-row"><label>目标</label><input type="text" id="give-target" value="player_name" oninput="updatePreview()" placeholder="请输入玩家名"></div>
                    <div class="form-row">
                        <label>物品ID</label>
                        <div style="display:flex;flex:1;flex-direction:column;gap:6px;min-width:200px;">
                            <input type="text" class="catalog-search" placeholder="搜索物品..." oninput="filterCatalogSelect(this)" style="min-width:0;" />
                            ${renderSelectOptions(ITEM_OPTIONS, 'minecraft:diamond_sword', 'give-item catalog-select', 'id="give-item" onchange="updatePreview()"')}
                        </div>
                    </div>
                    <div class="form-row"><label>数量</label><input type="number" id="give-count" value="1" min="1" max="99" oninput="updatePreview()"></div>
                    <div class="checkbox-group"><label><input type="checkbox" id="give-unbreakable" onchange="updatePreview()"> 不可破坏</label></div>
                </div>

                <div class="nbt-section">
                    <h4>附魔</h4>
                    <div id="enchant-list"></div>
                    <div class="btn-group"><button class="btn-secondary" onclick="addEnchantRow()">+ 添加附魔</button><button class="btn-secondary" onclick="removeLastRow('enchant-list')">- 删除最后一行</button></div>
                </div>

                <div class="nbt-section">
                    <h4>属性修饰符</h4>
                    <div id="attr-list"></div>
                    <div class="btn-group"><button class="btn-secondary" onclick="addAttrRow()">+ 添加属性</button><button class="btn-secondary" onclick="removeLastRow('attr-list')">- 删除最后一行</button></div>
                </div>

                <div class="nbt-section">
                    <h4>药水效果</h4>
                    <div id="potion-list"></div>
                    <div class="btn-group"><button class="btn-secondary" onclick="addPotionRow()">+ 添加效果</button><button class="btn-secondary" onclick="removeLastRow('potion-list')">- 删除最后一行</button></div>
                </div>

                <div class="nbt-section">
                    <h4>显示与隐藏</h4>
                    <div class="form-row"><label>自定义名称</label><input type="text" id="give-custom-name" oninput="updatePreview()" placeholder='{"text":"神剑"}'></div>
                    <div class="form-row"><label>描述</label><textarea id="give-lore" rows="3" oninput="updatePreview()" placeholder="每行一条"></textarea></div>
                    <div class="checkbox-group"><label><input type="checkbox" class="hide-flag" value="1" onchange="updatePreview()"> 隐藏附魔</label><label><input type="checkbox" class="hide-flag" value="2" onchange="updatePreview()"> 隐藏属性</label><label><input type="checkbox" class="hide-flag" value="4" onchange="updatePreview()"> 隐藏不可破坏</label><label><input type="checkbox" class="hide-flag" value="32" onchange="updatePreview()"> 隐藏药水效果</label><label><input type="checkbox" class="hide-flag" value="16" onchange="updatePreview()"> 隐藏其他</label></div>
                </div>

                <div class="nbt-section">
                    <h4>额外 NBT</h4>
                    <div class="form-row"><label>原始 NBT</label><input type="text" id="give-extra-nbt" oninput="updatePreview()" placeholder='不含外层大括号'></div>
                </div>
            `;
        }

        function addEnchantRow() {
            const div = document.createElement('div');
            div.className = 'nbt-row';
            div.innerHTML = `
                ${renderSelectOptions(ENCHANT_OPTIONS, 'minecraft:sharpness', 'ench-id', 'onchange="updatePreview()"')}
                <input type="number" class="ench-lvl" value="1" min="0" max="255" oninput="updatePreview()" placeholder="等级">
                <button onclick="this.parentElement.remove(); updatePreview();">删除</button>
            `;
            document.getElementById('enchant-list').appendChild(div);
            updatePreview();
        }

        function addAttrRow() {
            const div = document.createElement('div');
            div.className = 'nbt-row';
            div.innerHTML = `
                <input type="text" class="attr-name" value="generic.attack_damage" oninput="updatePreview()" placeholder="属性名">
                <input type="number" class="attr-amount" value="1.0" step="0.1" oninput="updatePreview()" placeholder="数值">
                <select class="attr-op" onchange="updatePreview()"><option value="0">加法</option><option value="1">乘法</option><option value="2">乘方</option></select>
                <input type="text" class="attr-uuid" value="1,2,3,4" oninput="updatePreview()" placeholder="UUID">
                <button onclick="this.parentElement.remove(); updatePreview();">删除</button>
            `;
            document.getElementById('attr-list').appendChild(div);
            updatePreview();
        }

        function addPotionRow() {
            const div = document.createElement('div');
            div.className = 'nbt-row';
            div.innerHTML = `
                ${renderSelectOptions(POTION_EFFECT_OPTIONS, 'minecraft:speed', 'potion-id', 'onchange="updatePreview()"')}
                <input type="number" class="potion-amp" value="0" min="0" max="255" oninput="updatePreview()" placeholder="等级">
                <input type="number" class="potion-dur" value="600" min="0" oninput="updatePreview()" placeholder="持续时间">
                <button onclick="this.parentElement.remove(); updatePreview();">删除</button>
            `;
            document.getElementById('potion-list').appendChild(div);
            updatePreview();
        }

        function removeLastRow(listId) {
            const list = document.getElementById(listId);
            if (list.lastChild) {
                list.removeChild(list.lastChild);
                updatePreview();
            }
        }

        function updateBuilder() {
            const builderArea = document.getElementById('builder-area');
            const cmdName = selectedPath[selectedPath.length - 1] || '';
            if (cmdName === 'give') {
                builderArea.innerHTML = buildGiveForm();
                return;
            }
            const spec = resolveCommandSpec(selectedPath);
            builderArea.innerHTML = renderSchemaFields(spec, selectedPath);
        }

        function updatePreview() {
            const cmdName = selectedPath[selectedPath.length - 1] || '';
            let finalCommand = '';

            if (cmdName === 'give') {
                const values = {
                    target: document.getElementById('give-target')?.value || 'player_name',
                    item: document.getElementById('give-item')?.value || 'minecraft:diamond_sword',
                    count: document.getElementById('give-count')?.value || 1
                };
                finalCommand = buildGiveCommand(values);
            } else {
                const spec = resolveCommandSpec(selectedPath);
                const values = readFormValues(spec);
                const genericArgs = document.getElementById('generic-args');
                if (genericArgs && genericArgs.value.trim()) values.args = genericArgs.value.trim();
                finalCommand = spec && typeof spec.build === 'function' ? spec.build(values, selectedPath) : selectedPath.join(' ');
            }

            const customTail = document.getElementById('custom-command-tail')?.value.trim();
            if (customTail) {
                finalCommand = [finalCommand.trim(), customTail.trim()].filter(Boolean).join(' ');
            }

            const spec = resolveCommandSpec(selectedPath);
            const validationBox = document.getElementById('command-validation');
            if (validationBox) {
                const issues = validateCommand(selectedPath, readFormValues(spec));
                if (issues.length > 0) {
                    validationBox.style.display = 'block';
                    validationBox.textContent = '校验警告：' + issues.join('；');
                } else {
                    validationBox.style.display = 'none';
                    validationBox.textContent = '';
                }
            }

            currentCommandString = finalCommand;
            document.getElementById('command-preview').textContent = currentCommandString;
        }

        async function loadCatalogs() {
            try {
                const res = await fetch('/api/catalogs');
                const data = await res.json();
                if (Array.isArray(data.items) && data.items.length) ITEM_OPTIONS = data.items;
                if (Array.isArray(data.enchantments) && data.enchantments.length) ENCHANT_OPTIONS = data.enchantments;
                if (Array.isArray(data.potions) && data.potions.length) POTION_EFFECT_OPTIONS = data.potions;
                log('已加载物品/附魔/药水目录', 'info');
            } catch (error) {
                log('目录加载失败：' + error.message, 'error');
            }
        }

        async function refreshCatalogs() {
            try {
                const res = await fetch('/api/catalogs/refresh', {method: 'POST'});
                const data = await res.json();
                if (Array.isArray(data.items) && data.items.length) ITEM_OPTIONS = data.items;
                if (Array.isArray(data.enchantments) && data.enchantments.length) ENCHANT_OPTIONS = data.enchantments;
                if (Array.isArray(data.potions) && data.potions.length) POTION_EFFECT_OPTIONS = data.potions;
                log(data.message || '目录已刷新', 'info');
                if (selectedPath[selectedPath.length - 1] === 'give') {
                    updateBuilder();
                    updatePreview();
                }
            } catch (error) {
                log('刷新目录失败：' + error.message, 'error');
            }
        }

        function togglePanel(panel) {
            if (!panel) return;
            const body = panel.querySelector('.panel-body');
            const button = panel.querySelector('.collapse-toggle');
            if (!body || !button) return;
            const isCollapsed = body.style.display === 'none';
            body.style.display = isCollapsed ? '' : 'none';
            button.textContent = isCollapsed ? '收起' : '展开';
        }

        async function init() {
            loadStoredState();
            renderSavedCommands();
            await loadCommandMetadata();
            await loadCatalogs();
            const res = await fetch('/api/commands');
            commandTree = sortCommandTree(await res.json());
            renderTree(commandTree, document.getElementById('command-tree'));
            selectCommand(['give']);
        }

        function renderTree(nodes, container, level = 0, parentPath = []) {
            container.innerHTML = '';
            const ul = document.createElement('ul');
            ul.className = 'cmd-tree';
            ul.style.paddingLeft = level === 0 ? '0' : '16px';

            sortCommandTree(nodes)
                .filter(node => !HIDDEN_COMMANDS.has(node.name))
                .forEach(node => {
                const nodePath = parentPath.concat(node.name);
                const li = document.createElement('li');
                const div = document.createElement('div');
                div.className = 'cmd-node';
                div.dataset.name = node.name;

                const hasChildren = node.children && node.children.length > 0;
                const toggle = document.createElement('span');
                toggle.className = 'toggle' + (hasChildren ? '' : ' hidden');
                toggle.textContent = hasChildren ? '▶' : '';
                if (hasChildren) {
                    toggle.onclick = (e) => {
                        e.stopPropagation();
                        const childUl = li.querySelector('ul');
                        if (childUl) {
                            childUl.classList.toggle('collapsed');
                            toggle.classList.toggle('expanded');
                        }
                    };
                }

                const name = document.createElement('span');
                name.className = 'name';
                name.textContent = node.name;

                const desc = document.createElement('span');
                desc.className = 'desc';
                desc.textContent = node.description || '';

                div.appendChild(toggle);
                div.appendChild(name);
                div.appendChild(desc);

                div.onclick = (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.cmd-node').forEach(n => n.classList.remove('active'));
                    div.classList.add('active');
                    selectCommand(nodePath);
                };

                li.appendChild(div);

                if (hasChildren) {
                    const childContainer = document.createElement('div');
                    renderTree(node.children, childContainer, level + 1, nodePath);
                    const childUl = childContainer.querySelector('ul');
                    if (level >= 1) childUl.classList.add('collapsed');
                    li.appendChild(childUl);
                }

                ul.appendChild(li);
            });

            container.appendChild(ul);
        }

        function selectCommand(path) {
            selectedPath = path;
            updateBuilder();
            updatePreview();
        }

        async function connectRCON() {
            const host = document.getElementById('host').value;
            const port = parseInt(document.getElementById('port').value);
            const password = document.getElementById('password').value;
            try {
                const res = await fetch('/api/connect', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({host, port, password})
                });
                const data = await res.json();
                if (data.success) {
                    isConnected = true;
                    updateStatus(true);
                }
                log(data.message || (data.success ? '连接成功' : '连接失败'), data.success ? 'info' : 'error');
            } catch (e) {
                log('连接异常: ' + e.message, 'error');
            }
        }

        async function disconnectRCON() {
            const res = await fetch('/api/disconnect', {method: 'POST'});
            const data = await res.json();
            isConnected = false;
            updateStatus(false);
            log(data.message || '已断开', 'info');
        }

        function toggleConnectionInputs(visible) {
            const inputs = Array.from(document.querySelectorAll('#host, #port, #password'));
            inputs.forEach((input) => {
                input.style.display = visible ? '' : 'none';
            });
        }

        function updateStatus(connected) {
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');
            if (connected) {
                dot.classList.add('connected');
                text.textContent = '已连接';
                text.style.color = 'var(--md-success)';
                toggleConnectionInputs(false);
            } else {
                dot.classList.remove('connected');
                text.textContent = '未连接';
                text.style.color = 'var(--md-text-soft)';
                toggleConnectionInputs(true);
            }
        }

        async function sendCommandRequest(rawCommand) {
            let commandText = String(rawCommand || '').trim();
            if (!commandText) {
                log('命令为空', 'error');
                return { success: false };
            }
            if (commandText.startsWith('/')) commandText = commandText.slice(1);
            if (hasAtSelector(commandText)) {
                log('RCON 不接受 @ 系列选择器，请改为具体玩家名或坐标', 'error');
                return { success: false };
            }
            try {
                const res = await fetch('/api/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({command: commandText})
                });
                const data = await res.json();
                if (data.success) {
                    log('>>> ' + commandText, 'send');
                    log('<<< ' + data.response, 'recv');
                    return { success: true, response: data.response };
                }
                log('发送失败: ' + data.message, 'error');
                return { success: false, message: data.message };
            } catch (e) {
                log('发送异常: ' + e.message, 'error');
                return { success: false, message: e.message };
            }
        }

        async function sendCommand() {
            const commands = buildPlayerCommandList(currentCommandString);
            for (const command of commands) {
                await sendCommandRequest(command);
            }
        }

        function buildCopyCommand() {
            let value = currentCommandString.trim();
            const useSlash = document.getElementById('copy-leading-slash')?.checked;
            const useAtSelector = document.getElementById('copy-at-selector')?.checked;
            if (useSlash && !value.startsWith('/')) value = '/' + value;
            if (useAtSelector) {
                value = value.replace(/\bplayer_name\b/g, '@p');
            }
            return value;
        }

        function copyCommand() {
            const copyValue = buildCopyCommand();
            navigator.clipboard.writeText(copyValue).then(() => log('命令已复制到剪贴板（按格式选项处理）', 'info'));
        }

        function clearLog() {
            document.getElementById('log').innerHTML = '';
        }

        function toggleLogPanel() {
            const section = document.getElementById('log-section');
            const toggleButton = document.getElementById('toggle-log');
            if (!section || !toggleButton) return;

            const isCollapsed = section.classList.toggle('collapsed');
            toggleButton.textContent = isCollapsed ? '展开' : '折叠';
            toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
            section.setAttribute('aria-expanded', String(!isCollapsed));
        }

        function log(msg, type = 'info') {
            const logDiv = document.getElementById('log');
            const time = new Date().toLocaleTimeString('zh-CN', {hour12: false});
            const entry = document.createElement('div');
            entry.className = `log-entry log-${type}`;
            entry.innerHTML = `<span class=\"log-time\">[${time}]</span>${escapeHtml(msg)}`;
            logDiv.appendChild(entry);
            logDiv.scrollTop = logDiv.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function filterCommands() {
            const input = document.getElementById('cmd-search');
            const query = (input?.value || '').trim().toLowerCase();
            const treeUls = document.querySelectorAll('.cmd-tree ul');
            const allNodes = Array.from(document.querySelectorAll('.cmd-node'));

            if (!query) {
                allNodes.forEach((node) => { node.style.display = 'flex'; });
                treeUls.forEach((ul) => ul.classList.remove('collapsed'));
                return;
            }

            const matches = new Set();
            allNodes.forEach((node) => {
                const name = (node.dataset.name || '').toLowerCase();
                const desc = (node.querySelector('.desc')?.textContent || '').toLowerCase();
                if (name.includes(query) || desc.includes(query)) {
                    matches.add(node);
                }
            });

            allNodes.forEach((node) => {
                const nodeLi = node.closest('li');
                const childNodes = Array.from(nodeLi?.querySelectorAll(':scope ul .cmd-node') || []);
                const hasMatchedChild = childNodes.some((child) => matches.has(child));
                const hasMatchedAncestor = (() => {
                    let current = node;
                    while (current) {
                        const parentLi = current.closest('li')?.parentElement?.closest('li');
                        if (!parentLi) return false;
                        const parentNode = parentLi.querySelector(':scope > .cmd-node');
                        if (parentNode && matches.has(parentNode)) return true;
                        current = parentNode;
                    }
                    return false;
                })();

                const visible = matches.has(node) || hasMatchedChild || hasMatchedAncestor;
                node.style.display = visible ? 'flex' : 'none';
            });

            treeUls.forEach((ul) => {
                const hasVisible = Array.from(ul.querySelectorAll('.cmd-node')).some((node) => node.style.display !== 'none');
                ul.classList.toggle('collapsed', !hasVisible);
            });
        }

        init();
    