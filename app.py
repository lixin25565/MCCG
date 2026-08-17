import json
import os
import re
import threading
import yaml
from flask import Flask, request, jsonify, render_template
from mcrcon import MCRcon

app = Flask(__name__)

# ==================== 命令表加载 ====================
COMMAND_FILE = 'commands.yaml'
if not os.path.exists(COMMAND_FILE):
    raise FileNotFoundError(f"未找到 {COMMAND_FILE}，请将命令表 YAML 文件放在当前目录")

with open(COMMAND_FILE, 'r', encoding='utf-8') as f:
    COMMAND_DATA = yaml.safe_load(f)

DEFAULT_COMMAND_TEMPLATES = {
    'advancement': 'advancement <grant|revoke> <targets> <advancement> [criterion]',
    'attribute': 'attribute <get|set|modifier> <target> <attribute> [value] [modifier]',
    'bossbar': 'bossbar <add|get|list|remove|set> ...',
    'clear': 'clear <targets> [item] [maxCount] [data]',
    'clone': 'clone <begin> <end> <destination> [maskMode] [cloneMode]',
    'damage': 'damage <targets> <amount> [source]',
    'datapack': 'datapack <enable|disable|list> ...',
    'data': 'data <get|merge|modify|remove> ...',
    'difficulty': 'difficulty [difficulty]',
    'effect': 'effect <give|clear> <targets> [effect] [seconds] [amplifier] [hideParticles]',
    'enchant': 'enchant <targets> <enchantment> [level]',
    'execute': 'execute <as|at|if|unless|run|store|facing|positioned|rotated> ...',
    'experience': 'experience <add|set|query> <targets> <amount|level>',
    'fill': 'fill <from> <to> <block> [replace] [dataValue]',
    'forceload': 'forceload <add|remove|list> ...',
    'function': 'function <name> [arguments] [if|unless]',
    'gamemode': 'gamemode <mode> <target>',
    'gamerule': 'gamerule <rule> [value]',
    'give': 'give <targets> <item> [count] [data] [components]',
    'help': 'help [command|page]',
    'item': 'item <modify|replace> ...',
    'jfr': 'jfr <start|stop> ...',
    'kick': 'kick <targets> [reason]',
    'kill': 'kill <targets>',
    'list': 'list [uuids]',
    'locate': 'locate <structure|biome|poi> <name>',
    'loot': 'loot <give|replace|insert|spawn|drop> ...',
    'me': 'me <message>',
    'msg': 'msg <targets> <message>',
    'particle': 'particle <name> <pos> [speed] [count] [mode] [params]',
    'place': 'place <feature|jigsaw|structure|template> ...',
    'playsound': 'playsound <sound> <targets> [source] [volume] [pitch] [minVolume]',
    'predicate': 'predicate <list|remove> ...',
    'random': 'random <value> ...',
    'recipe': 'recipe <give|take> <targets> [recipe]',
    'reload': 'reload',
    'return': 'return <run> ...',
    'say': 'say <message>',
    'schedule': 'schedule <function|clear> ...',
    'scoreboard': 'scoreboard <objectives|players> ...',
    'seed': 'seed',
    'setblock': 'setblock <pos> <block> [replace|destroy] [dataValue]',
    'setworldspawn': 'setworldspawn [pos] [angle]',
    'spawnpoint': 'spawnpoint [targets] [pos] [angle]',
    'spectate': 'spectate <target> [viewer]',
    'spreadplayers': 'spreadplayers <center> <spreadDistance> <maxRange> <respectTeams> <targets>',
    'stop': 'stop',
    'summon': 'summon <entity> [pos] [nbt]',
    'tag': 'tag <targets> <add|remove|list> [value]',
    'team': 'team <add|empty|join|leave|list|modify|remove> ...',
    'teammsg': 'teammsg <message>',
    'teleport': 'teleport <targets> <destination> [rotation]',
    'tell': 'tell <targets> <message>',
    'tellraw': 'tellraw <targets> <message>',
    'time': 'time <add|query|set> ...',
    'title': 'title <targets> <clear|reset|times|title|subtitle|actionbar> ...',
    'tm': 'tm <message>',
    'tp': 'tp <targets> <destination> [rotation]',
    'trigger': 'trigger <objective> [add|set] [value]',
    'weather': 'weather <clear|rain|thunder> [duration]',
    'worldborder': 'worldborder <add|center|damage|get|set|warning> ...',
    'xp': 'xp <add|set|query> <targets> <amount|level>'
}

DEFAULT_ITEM_OPTIONS = [
    ['minecraft:diamond_sword', '钻石剑'], ['minecraft:diamond_pickaxe', '钻石镐'], ['minecraft:diamond_axe', '钻石斧'],
    ['minecraft:diamond_shovel', '钻石铲'], ['minecraft:diamond_hoe', '钻石锄'], ['minecraft:diamond_helmet', '钻石头盔'],
    ['minecraft:diamond_chestplate', '钻石胸甲'], ['minecraft:diamond_leggings', '钻石护腿'], ['minecraft:diamond_boots', '钻石靴子'],
    ['minecraft:bow', '弓'], ['minecraft:crossbow', '十字弓'], ['minecraft:trident', '三叉戟'], ['minecraft:shield', '盾牌'],
    ['minecraft:elytra', '鞘翅'], ['minecraft:golden_apple', '金苹果'], ['minecraft:enchanted_golden_apple', '附魔金苹果'],
    ['minecraft:stick', '木棍'], ['minecraft:stone', '石头'], ['minecraft:glass', '玻璃'], ['minecraft:obsidian', '黑曜石'],
    ['minecraft:diamond', '钻石'], ['minecraft:emerald', '绿宝石'], ['minecraft:iron_ingot', '铁锭'], ['minecraft:gold_ingot', '金锭'],
    ['minecraft:iron_sword', '铁剑'], ['minecraft:iron_pickaxe', '铁镐'], ['minecraft:golden_sword', '金剑'], ['minecraft:netherite_sword', '下界合金剑'],
    ['minecraft:netherite_pickaxe', '下界合金镐'], ['minecraft:netherite_helmet', '下界合金头盔'], ['minecraft:diamond_ore', '钻石矿石'],
    ['minecraft:bucket', '桶'], ['minecraft:water_bucket', '水桶'], ['minecraft:lava_bucket', '熔岩桶'], ['minecraft:saddle', '鞍'],
    ['minecraft:ender_pearl', '末影珍珠'], ['minecraft:totem_of_undying', '不死图腾'], ['minecraft:firework_rocket', '烟花火箭'],
    ['minecraft:apple', '苹果'], ['minecraft:melon_slice', '西瓜片'], ['minecraft:bread', '面包'], ['minecraft:cooked_beef', '熟牛肉'],
    ['minecraft:beef', '生牛肉'], ['minecraft:carrot', '胡萝卜'], ['minecraft:potato', '马铃薯'], ['minecraft:golden_carrot', '金胡萝卜']
]

DEFAULT_ENCHANT_OPTIONS = [
    ['minecraft:sharpness', '锋利'], ['minecraft:smite', '亡灵杀手'], ['minecraft:bane_of_arthropods', '节肢杀手'],
    ['minecraft:efficiency', '效率'], ['minecraft:unbreaking', '耐久'], ['minecraft:looting', '掠夺'],
    ['minecraft:protection', '保护'], ['minecraft:fire_protection', '火焰保护'], ['minecraft:blast_protection', '爆炸保护'],
    ['minecraft:projectile_protection', '弹射物保护'], ['minecraft:respiration', '水下呼吸'], ['minecraft:aqua_affinity', '水下速掘'],
    ['minecraft:thorns', '荆棘'], ['minecraft:power', '力量'], ['minecraft:punch', '冲击'], ['minecraft:flame', '火矢'],
    ['minecraft:infinity', '无限'], ['minecraft:luck_of_the_sea', '海之眷顾'], ['minecraft:lure', '饵钓'], ['minecraft:channeling', '引雷'],
    ['minecraft:multishot', '多重射击'], ['minecraft:quick_charge', '快速装填'], ['minecraft:piercing', '穿透'], ['minecraft:silkence', '沉默']
]

DEFAULT_POTION_EFFECT_OPTIONS = [
    ['minecraft:speed', '速度'], ['minecraft:slowness', '缓慢'], ['minecraft:haste', '急迫'], ['minecraft:mining_fatigue', '挖掘疲劳'],
    ['minecraft:strength', '力量'], ['minecraft:instant_health', '瞬间治疗'], ['minecraft:instant_damage', '瞬间伤害'], ['minecraft:jump_boost', '跳跃提升'],
    ['minecraft:nausea', '反胃'], ['minecraft:regeneration', '再生'], ['minecraft:resistance', '抗性提升'], ['minecraft:fire_resistance', '抗火'],
    ['minecraft:water_breathing', '水下呼吸'], ['minecraft:invisibility', '隐身'], ['minecraft:blindness', '失明'], ['minecraft:night_vision', '夜视'],
    ['minecraft:hunger', '饥饿'], ['minecraft:weakness', '虚弱'], ['minecraft:poison', '中毒'], ['minecraft:wither', '凋零'], ['minecraft:health_boost', '生命提升']
]

CATALOG_DIRECTORY = os.path.join(os.path.dirname(__file__), 'catalogs')


def load_catalog_json(filename, default):
    path = os.path.join(CATALOG_DIRECTORY, filename)
    try:
        with open(path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        return data if isinstance(data, list) else default
    except Exception:
        return default


CATALOG_ITEMS = load_catalog_json('items.json', DEFAULT_ITEM_OPTIONS)
CATALOG_ENCHANTMENTS = load_catalog_json('enchantments.json', DEFAULT_ENCHANT_OPTIONS)
CATALOG_POTIONS = load_catalog_json('potions.json', DEFAULT_POTION_EFFECT_OPTIONS)

COMMON_COMMAND_PRIORITY = ['effect', 'give', 'gamemode', 'op', 'deop', 'stop', 'time', 'weather', 'teleport', 'summon', 'title', 'say', 'msg', 'tellraw']


def build_tree(data):
    """将 YAML 数据转换为前端需要的树结构"""
    tree = []
    for cmd_name, cmd_info in data['commands'].items():
        node = {
            'name': cmd_name,
            'description': cmd_info.get('description', ''),
            'template': DEFAULT_COMMAND_TEMPLATES.get(cmd_name, f'{cmd_name} <args>'),
            'children': []
        }
        if 'subcommands' in cmd_info:
            for sub_name, sub_info in cmd_info['subcommands'].items():
                sub_node = {
                    'name': sub_name,
                    'description': sub_info.get('description', ''),
                    'template': DEFAULT_COMMAND_TEMPLATES.get(f'{cmd_name} {sub_name}', f'{cmd_name} {sub_name} <args>'),
                    'children': []
                }
                if 'subcommands' in sub_info:
                    for subsub_name, subsub_info in sub_info['subcommands'].items():
                        subsub_node = {
                            'name': subsub_name,
                            'description': subsub_info.get('description', ''),
                            'template': DEFAULT_COMMAND_TEMPLATES.get(f'{cmd_name} {sub_name} {subsub_name}', f'{cmd_name} {sub_name} {subsub_name} <args>'),
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

@app.route('/api/catalogs')
def api_catalogs():
    return jsonify({
        'items': load_catalog_json('items.json', DEFAULT_ITEM_OPTIONS),
        'enchantments': load_catalog_json('enchantments.json', DEFAULT_ENCHANT_OPTIONS),
        'potions': load_catalog_json('potions.json', DEFAULT_POTION_EFFECT_OPTIONS),
        'source': 'local'
    })


@app.route('/api/catalogs/refresh', methods=['POST'])
def api_catalogs_refresh():
    return jsonify({
        'items': load_catalog_json('items.json', DEFAULT_ITEM_OPTIONS),
        'enchantments': load_catalog_json('enchantments.json', DEFAULT_ENCHANT_OPTIONS),
        'potions': load_catalog_json('potions.json', DEFAULT_POTION_EFFECT_OPTIONS),
        'source': 'local',
        'message': '已刷新本地物品/附魔目录'
    })


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