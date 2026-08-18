import json
import os
import re
import threading
import yaml
from flask import Flask, request, jsonify, render_template
from mcrcon import MCRcon

app = Flask(__name__)

# ==================== 命令表加载 ====================
COMMAND_FILE = 'catalogs/commands.yaml'
if not os.path.exists(COMMAND_FILE):
    raise FileNotFoundError(f"未找到 {COMMAND_FILE}，请将命令表 YAML 文件放在当前目录")

with open(COMMAND_FILE, 'r', encoding='utf-8') as f:
    COMMAND_DATA = yaml.safe_load(f)

CATALOG_DIRECTORY = os.path.join(os.path.dirname(__file__), 'catalogs')


def load_catalog_json(filename, default=None, expected_type=None):
    path = os.path.join(CATALOG_DIRECTORY, filename)
    try:
        with open(path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        if expected_type is None:
            return data if isinstance(data, (list, dict)) else default
        if isinstance(data, expected_type):
            return data
        return default
    except Exception:
        return default


CATALOG_ITEMS = load_catalog_json('items.json', [], list)
CATALOG_ENCHANTMENTS = load_catalog_json('enchantments.json', [], list)
CATALOG_POTIONS = load_catalog_json('potions.json', [], list)


def get_catalog_payload():
    return {
        'items': load_catalog_json('items.json', [], list),
        'enchantments': load_catalog_json('enchantments.json', [], list),
        'potions': load_catalog_json('potions.json', [], list),
        'source': 'local'
    }


COMMAND_METADATA = load_catalog_json(
    'command-metadata.json',
    {'priority': [], 'hidden_commands': [], 'specs': {}},
    dict,
)
COMMON_COMMAND_PRIORITY = COMMAND_METADATA.get('priority', [])


def build_tree(data):
    """将 YAML 数据转换为前端需要的树结构"""

    def command_template(path):
        if not path:
            return '<args>'
        return ' '.join(path) + ' <args>'

    tree = []
    for cmd_name, cmd_info in data['commands'].items():
        node = {
            'name': cmd_name,
            'description': cmd_info.get('description', ''),
            'template': command_template([cmd_name]),
            'children': []
        }
        if 'subcommands' in cmd_info:
            for sub_name, sub_info in cmd_info['subcommands'].items():
                sub_node = {
                    'name': sub_name,
                    'description': sub_info.get('description', ''),
                    'template': command_template([cmd_name, sub_name]),
                    'children': []
                }
                if 'subcommands' in sub_info:
                    for subsub_name, subsub_info in sub_info['subcommands'].items():
                        subsub_node = {
                            'name': subsub_name,
                            'description': subsub_info.get('description', ''),
                            'template': command_template([cmd_name, sub_name, subsub_name]),
                            'children': []
                        }
                        sub_node['children'].append(subsub_node)
                node['children'].append(sub_node)
        tree.append(node)

    priority = {name: idx for idx, name in enumerate(COMMON_COMMAND_PRIORITY)}
    tree.sort(key=lambda node: (priority.get(node['name'], len(priority)), node['name']))
    for node in tree:
        node['children'].sort(key=lambda child: (priority.get(child['name'], len(priority)), child['name']))
    return tree

COMMAND_TREE = build_tree(COMMAND_DATA)

# ==================== RCON 全局连接 ====================
rcon_conn = None          # 保存 MCRcon 实例
rcon_lock = threading.Lock()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/commands')
def api_commands():
    return jsonify(COMMAND_TREE)

@app.route('/api/command-specs')
def api_command_specs():
    return jsonify(COMMAND_METADATA)

@app.route('/api/catalogs')
def api_catalogs():
    return jsonify(get_catalog_payload())


@app.route('/api/catalogs/refresh', methods=['POST'])
def api_catalogs_refresh():
    payload = get_catalog_payload()
    payload['message'] = '已刷新本地物品/附魔目录'
    return jsonify(payload)


@app.route('/api/connect', methods=['POST'])
def api_connect():
    global rcon_conn
    data = request.json
    host = data.get('host', '127.0.0.1')
    port = data.get('port', 25575)
    password = data.get('password', '')
    try:
        with rcon_lock:
            # 如果已有连接，先断开
            if rcon_conn:
                try:
                    rcon_conn.disconnect()
                except:
                    pass
                rcon_conn = None
            # 建立新连接
            rcon_conn = MCRcon(host, password, port=port)
            rcon_conn.connect()
        return jsonify({'success': True, 'message': '连接成功'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/disconnect', methods=['POST'])
def api_disconnect():
    global rcon_conn
    with rcon_lock:
        if rcon_conn:
            try:
                rcon_conn.disconnect()
            except:
                pass
            rcon_conn = None
    return jsonify({'success': True, 'message': '已断开'})

@app.route('/api/send', methods=['POST'])
def api_send():
    data = request.json
    command = data.get('command', '')
    if not command:
        return jsonify({'success': False, 'message': '命令为空'})
    if re.search(r'(?<!\\)@(?:a|e|p|r|s)\b', command):
        return jsonify({'success': False, 'message': 'RCON 不接受 @ 系列选择器，请改为具体玩家名或坐标'})
    try:
        with rcon_lock:
            if not rcon_conn:
                return jsonify({'success': False, 'message': '未连接 RCON'})
            response = rcon_conn.command(command)
        return jsonify({'success': True, 'response': response})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)