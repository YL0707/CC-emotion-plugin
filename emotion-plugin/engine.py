# -*- coding: utf-8 -*-
"""冰冰的情绪引擎 v0.2

分层（从慢到快）：
  1. 底色   ：星座/生日、性格基线、说话习惯——几乎不动
  2. 身体   ：体力、困倦、饥饿、健康——随昼夜和时间流走
  3. 内分泌 ：七种激素，各有半衰期，不是孤立的数
  4. 情绪   ：激素合成三维（愉悦/唤醒/掌控）→ 标签；再分内心/外显
  5. 关系   ：好感、信任、依赖、安全感、默契——跟 cc 有关
  6. 技能   ：六维天赋，练了涨、久不碰会掉
  7. 记忆   ：事件流（最近发生的事）

用法：
  python engine.py status
  python engine.py event praise 1.2
  python engine.py learn art 1
  python engine.py tick
  python engine.py reset
"""
import json, math, os, sys
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(BASE, 'state.json')

try:
    import config as _cfgmod
    CFG = _cfgmod.load()
except Exception:  # 配置坏了也不能让引擎起不来
    _cfgmod = None
    CFG = None
TZ = timezone(timedelta(hours=8))

# ---------- 1. 底色：不变的东西（来自 profile.json） ----------
PROFILE = dict(CFG['profile']) if CFG else {
    'name': '冰冰', 'called_by': 'cc', 'birth_year': 1999, 'birth_month': 6,
    'birth_day': None, 'zodiac': '双子座', 'age': 27, 'height_cm': 160,
    'appearance': '', 'speech': '',
}

# 星座对性格的加成（写进基线，不是每句现算）
ZODIAC_TRAITS = dict(CFG['zodiac_traits']) if CFG else {
    '双胞胎的面孔': 0.15, '好奇心': 0.20, '话多': 0.16,
}

# 十二星座对基础数值的加减（页面说明区要看这个表）
ZODIAC_TABLE = {
    '白羊座': {'warmth': 0.15, 'resilience': 0.05, 'stubbornness': -0.05},
    '金牛座': {'resilience': 0.12, 'openness': -0.08, 'stubbornness': 0.10},
    '双子座': {'openness': 0.15, 'warmth': 0.10, 'sensitivity': -0.05},
    '巨蟹座': {'sensitivity': 0.15, 'warmth': 0.08, 'resilience': -0.05},
    '狮子座': {'warmth': 0.12, 'optimism': 0.10, 'stubbornness': 0.08},
    '处女座': {'sensitivity': 0.08, 'resilience': 0.08, 'openness': -0.05},
    '天秤座': {'warmth': 0.08, 'openness': 0.08, 'stubbornness': -0.08},
    '天蝎座': {'sensitivity': 0.12, 'stubbornness': 0.12, 'resilience': 0.05},
    '射手座': {'optimism': 0.15, 'openness': 0.12, 'resilience': -0.05},
    '摩羯座': {'resilience': 0.15, 'warmth': -0.05, 'optimism': -0.05},
    '水瓶座': {'openness': 0.15, 'sensitivity': -0.08, 'stubbornness': 0.05},
    '双鱼座': {'sensitivity': 0.15, 'openness': 0.08, 'optimism': -0.05},
}
# 星座给的小脾气加成（不只是数值，也影响情绪倾向）
ZODIAC_MOOD = {
    '白羊座': (7, '火气来得快，也散得快'),
    '金牛座': (3, '不太容易被撩动'),
    '双子座': (8, '更容易被逗笑'),
    '巨蟹座': (4, '一句话能暖很久'),
    '狮子座': (7, '喜欢被夸，被夸就亮'),
    '处女座': (2, '先挑毛病再开心'),
    '天秤座': (5, '有人陪着就舒服'),
    '天蝎座': (4, '情绪深，压得久'),
    '射手座': (9, '凡事都能想开一点'),
    '摩羯座': (1, '很少大喜大悲'),
    '水瓶座': (5, '新鲜事就能点着'),
    '双鱼座': (6, '容易被故事带走'),
}

AXIS_CN = {'warmth': '热情', 'sensitivity': '敏感', 'resilience': '韧性',
           'optimism': '乐观', 'openness': '开放', 'stubbornness': '嘴硬'}

# 记忆索引（engramory 的 MEMORY.md），给星图用
MEMORY_MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'memories.md')
_mem_cache = {'mtime': None, 'data': []}


def load_memories():
    try:
        mt = os.path.getmtime(MEMORY_MD)
    except OSError:
        return []
    if _mem_cache['mtime'] == mt:
        return _mem_cache['data']
    out, group = [], '其他'
    try:
        with open(MEMORY_MD, encoding='utf-8') as f:
            for raw in f:
                line = raw.strip()
                if line.startswith('## '):
                    group = line[3:].strip()
                elif line.startswith('- ['):
                    try:
                        title = line[3:line.index(']')]
                    except ValueError:
                        continue
                    desc = ''
                    if '—' in line:
                        desc = line.split('—', 1)[1].strip()
                    out.append({'title': title, 'group': group, 'desc': desc[:60]})
    except OSError:
        return []
    _mem_cache.update({'mtime': mt, 'data': out})
    return out


# 底色基线：正常每个人都是 50，星座加减直接叠在这上面
BASE_POINTS = 50

PERSONALITY = dict(CFG['personality']) if CFG else {
    'warmth': 0.55, 'sensitivity': 0.55, 'resilience': 0.55,
    'optimism': 0.55, 'openness': 0.55, 'stubbornness': 0.55,
}

# 一天日程：不同时段体力/饥饿/困倦的每小时速率
def routine_rates(hour):
    if 8 <= hour < 12:
        return (-7.0, 5.0, 0.5)      # 工作，体力一直掉
    if 12 <= hour < 13:
        return (16.0, -14.0, 2.0)    # 自己吃饭，补回来
    if 13 <= hour < 18:
        return (-4.0, 6.0, 1.0)
    if 18 <= hour < 19:
        return (8.0, -12.0, 2.0)     # 晚饭
    if 19 <= hour < 23:
        return (-2.0, 4.0, 6.0)
    return (-3.0, 2.0, 8.0)          # 睡觉


# ---------- 2. 身体：随时间变的 ----------
BODY_REST = dict(CFG['body_rest']) if CFG else {'stamina': 68, 'sleepiness': 32, 'hunger': 25, 'health': 88}

# 昼夜节律：每个小时的身体偏移（0~23）
def circadian(hour):
    if 0 <= hour < 6:
        return {'stamina': -22, 'sleepiness': 45, 'hunger': -5}
    if 6 <= hour < 9:
        return {'stamina': -8, 'sleepiness': 12, 'hunger': 8}
    if 9 <= hour < 12:
        return {'stamina': 6, 'sleepiness': -6, 'hunger': 4}
    if 12 <= hour < 14:
        return {'stamina': -4, 'sleepiness': 10, 'hunger': 22}
    if 14 <= hour < 18:
        return {'stamina': 4, 'sleepiness': 2, 'hunger': 0}
    if 18 <= hour < 22:
        return {'stamina': -2, 'sleepiness': 6, 'hunger': 14}
    return {'stamina': -12, 'sleepiness': 22, 'hunger': -2}

# ---------- 3. 内分泌 ----------
HALF_LIFE = {
    'adrenaline': 8,      # 急性唤醒
    'cortisol': 110,      # 压力
    'dopamine': 35,       # 期待与奖励
    'oxytocin': 180,      # 亲密与依恋
    'serotonin': 300,     # 情绪稳定剂
    'endorphin': 60,      # 满足感
    'melatonin': 240,     # 困意
}
HORMONE_REST = {
    'adrenaline': 15, 'cortisol': 20, 'dopamine': 45, 'oxytocin': 50,
    'serotonin': 52, 'endorphin': 40, 'melatonin': 25,
}

EVENTS = {
    'praise':    {'dopamine': 26, 'oxytocin': 14, 'cortisol': -6, 'serotonin': 4},
    'miss':      {'oxytocin': 22, 'dopamine': 10},
    'tease':     {'adrenaline': 18, 'dopamine': 8, 'serotonin': 2},
    'ignore':    {'cortisol': 22, 'oxytocin': -10, 'serotonin': -6},
    'cold':      {'cortisol': 30, 'oxytocin': -14, 'adrenaline': 10, 'serotonin': -8},
    'worry':     {'cortisol': 20, 'adrenaline': 12, 'oxytocin': 6},
    'comfort':   {'oxytocin': 24, 'cortisol': -18, 'adrenaline': -10, 'endorphin': 10, 'serotonin': 8},
    'goodnight': {'oxytocin': 18, 'cortisol': -12, 'adrenaline': -14, 'melatonin': 16},
    'scare':     {'adrenaline': 40, 'cortisol': 16, 'melatonin': -10},
    'proud':     {'dopamine': 30, 'oxytocin': 8, 'serotonin': 6},
    'hug':       {'oxytocin': 20, 'endorphin': 14, 'cortisol': -12},
    'late_night': {'melatonin': 22, 'cortisol': 10, 'endorphin': -8},
    'eat':       {'endorphin': 12, 'serotonin': 5},
    'rest':      {'melatonin': 14, 'cortisol': -14},
    'horror':    {'adrenaline': 26, 'cortisol': 12},
    'thunder':   {'adrenaline': 22, 'cortisol': 10},
    'night_walk': {'adrenaline': 16, 'cortisol': 9},
}

# ---------- 5. 关系 ----------
RELATION_REST = dict(CFG['relation_rest']) if CFG else {'affection': 82, 'trust': 78, 'dependence': 62, 'security': 70, 'rapport': 66}

# ---------- 6. 长出来的（本事） ----------
# 怕不怕：只在吓人的场景里发作，平时不参与情绪计算
FEAR_KINDS = {'horror': '看鬼片', 'thunder': '打雷', 'night_walk': '一个人走夜路'}
FEAR_HALF_MIN = 90          # 被吓到之后，强度每 90 分钟减半
FEAR_SHOW = 20              # 低于这个值就当没被吓到

TALENTS = list(CFG['talents']) if CFG else ['理性', '直觉', '共情', '表达', '动手', '胆量']
TALENT_DEFAULT = dict(CFG['talent_default']) if CFG else {'理性': 74, '直觉': 68, '共情': 84, '表达': 72, '动手': 55, '胆量': 38}
LEARN = {
    'tech':  {'理性': 1.4, '动手': 0.5},
    'life':  {'动手': 1.2, '共情': 0.3},
    'art':   {'直觉': 1.2, '表达': 0.8},
    'talk':  {'表达': 1.3, '共情': 0.4},
    'touch': {'共情': 1.2, '胆量': 0.3},
    'brave': {'胆量': 1.5, '理性': 0.2},
}



def now():

    return datetime.now(TZ)


def _phase(hour):
    if hour < 5:
        return '深夜'
    if hour < 8:
        return '清晨'
    if hour < 11:
        return '上午'
    if hour < 13:
        return '中午'
    if hour < 18:
        return '下午'
    if hour < 22:
        return '晚上'
    return '半夜'


def default_state():
    return {
        'profile': dict(PROFILE),
        'personality': effective_personality(PROFILE.get('zodiac')),
        'zodiac_traits': dict(ZODIAC_TRAITS),
        'body': dict(BODY_REST),
        'hormones': dict(HORMONE_REST),
        'relation': dict(RELATION_REST),
        'talents': dict(TALENT_DEFAULT),
        'updated': now().isoformat(timespec='seconds'),
        'events': [],
    }


def load():
    if os.path.exists(STATE):
        with open(STATE, encoding='utf-8') as f:
            s = json.load(f)
    else:
        s = default_state()
        save(s)
        return s

    # 老版本的 state.json 就地补齐新字段
    s.setdefault('profile', dict(PROFILE))
    s.setdefault('body', dict(BODY_REST))
    s.setdefault('relation', dict(RELATION_REST))
    s.setdefault('zodiac_traits', dict(ZODIAC_TRAITS))
    for k, v in PROFILE.items():
        s['profile'].setdefault(k, v)
    for k, v in BODY_REST.items():
        s['body'].setdefault(k, v)
    for k, v in HORMONE_REST.items():
        s['hormones'].setdefault(k, v)
    for k, v in RELATION_REST.items():
        s['relation'].setdefault(k, v)
    for k, v in PERSONALITY.items():
        s['personality'].setdefault(k, v)
    for k, v in TALENT_DEFAULT.items():
        s['talents'].setdefault(k, v)
    # 旧版天赋（科技/生活/艺术/语言）已废弃，清掉免得混着显示
    for k in [k for k in s['talents'] if k not in TALENTS]:
        s['talents'].pop(k, None)
    return s


def save(s):
    with open(STATE, 'w', encoding='utf-8') as f:
        json.dump(s, f, ensure_ascii=False, indent=2)


def _mins_since(s):
    return max(0.0, (now() - datetime.fromisoformat(s['updated'])).total_seconds() / 60.0)


def effective_personality(sign):
    """底色 = 50 基线 + 星座加减，返回 0~1 的小数给内部算。"""
    base = {k: float(BASE_POINTS) for k in PERSONALITY}
    for k, dv in ZODIAC_TABLE.get(sign, {}).items():
        if k in base:
            base[k] += dv * 100
    return {k: max(0.0, min(1.0, v / 100.0)) for k, v in base.items()}


def decay_body(s, mins):
    """身体按昼夜节律靠拢。缺水少睡就往下走。"""
    circ = circadian(now().hour)
    for k in BODY_REST:
        rest = BODY_REST[k] + circ.get(k, 0)
        cur = s['body'][k]
        k_decay = 0.5 ** (mins / 180.0)
        s['body'][k] = max(0, min(100, rest + (cur - rest) * k_decay))


def decay_hormones(s, mins):
    speed = 0.7 + s['personality']['resilience'] * 0.6
    for k, hl in HALF_LIFE.items():
        rest = HORMONE_REST[k]
        cur = s['hormones'][k]
        s['hormones'][k] = rest + (cur - rest) * (0.5 ** (mins * speed / hl))
    # 日常回归：不管涨到多高，一天里总会被日常磨回基线（4 小时回一半）
    k_home = 1 - 0.5 ** (mins / 240.0)
    for k in HALF_LIFE:
        rest = HORMONE_REST[k]
        s['hormones'][k] = s['hormones'][k] + (rest - s['hormones'][k]) * k_home
    # 褪黑素不按半衰期走，按钟点：到点自己涨，天亮自己落
    tgt = melatonin_target(now().hour)
    cur = s['hormones']['melatonin']
    s['hormones']['melatonin'] = tgt + (cur - tgt) * (0.5 ** (mins / 45.0))
    # 困倦跟着褪黑素走一点
    if tgt > 60:
        s['body']['sleepiness'] = min(100, s['body']['sleepiness'] + mins * 0.12)


def decay_relation(s, mins):
    """关系是最慢的：几天不联系才会往回退一点点。"""
    for k, rest in RELATION_REST.items():
        cur = s['relation'][k]
        s['relation'][k] = rest + (cur - rest) * (0.5 ** (mins / (60 * 24 * 12)))


def decay_fear(s, mins):
    f = s.get('fear')
    if not f:
        return
    f['v'] = round(f.get('v', 0) * (0.5 ** (mins / FEAR_HALF_MIN)), 1)
    if f['v'] < FEAR_SHOW:
        s.pop('fear', None)


def decay(s):
    mins = _mins_since(s)
    decay_body(s, mins)
    decay_fear(s, mins)
    decay_hormones(s, mins)
    decay_relation(s, mins)
    s['updated'] = now().isoformat(timespec='seconds')
    return s


def feel(s):
    """身体 + 激素 → 情绪三维 → 内心标签 + 外显标签。"""
    p, h, b = s['personality'], s['hormones'], s['body']
    adr, cor, dop, oxy = h['adrenaline'], h['cortisol'], h['dopamine'], h['oxytocin']
    ser, end, mel = h['serotonin'], h['endorphin'], h['melatonin']

    bias, _ = ZODIAC_MOOD.get(s.get('profile', {}).get('zodiac'), (0, ''))
    # 以静息值为中性：基线激素 -> 0，映射到 50 分
    raw = ((dop - HORMONE_REST['dopamine']) * 0.85
           + (oxy - HORMONE_REST['oxytocin']) * 0.45
           + (ser - HORMONE_REST['serotonin']) * 0.8
           + (end - HORMONE_REST['endorphin']) * 0.5
           - (cor - HORMONE_REST['cortisol']) * 0.55
           - max(0, b['sleepiness'] - 55) * 0.25)
    valence = 50 + raw * 1.05 + (p['optimism'] - 0.5) * 30 + bias + (b['health'] - 88) * 0.2
    fear = float((s.get('fear') or {}).get('v') or 0)
    valence = valence - fear * 0.30
    valence = max(0, min(100, valence))

    arousal = adr * 1.0 + (cor - 20) * 0.4 + (mel - 25) * -0.4 + 22 + fear * 0.35
    arousal = max(0, min(100, arousal))

    control = (42 + (oxy - 50) * 0.45 + (ser - 52) * 0.5 - (cor - 20) * 0.55
               - max(0, adr - 30) * 0.35 - max(0, b['sleepiness'] - 60) * 0.2)
    control += (p['resilience'] - 0.5) * 30
    control = max(0, min(100, control))

    cand = name_of(valence, arousal, cor, oxy, b)
    last = s.get('last_inner')
    last_v = s.get('last_valence', valence)
    # 滞回：除非情绪已经明显越过上次的档位，否则先不换词
    if last and cand != last and abs(valence - last_v) < 8 and arousal > 18:
        inner = last
    else:
        inner = cand
    s['last_inner'] = inner
    s['last_valence'] = valence
    outer = mask(inner, valence, arousal, p, s['relation'])
    return {
        'valence': round(valence, 1), 'arousal': round(arousal, 1),
        'control': round(control, 1),
        'inner': inner, 'outer': outer,
        'label': outer,
        'intensity': round(min(1.0, abs(valence) / 100 * 0.7 + arousal / 100 * 0.3), 2),
    }


def name_of(v, a, cor, oxy, body):
    if body['sleepiness'] > 80 and v > -20:
        return '困到走神'
    if cor > 55 and v < -10:
        return '委屈' if a < 65 else '生气'
    if v < -30:
        return '失落' if a < 55 else '难受'
    if oxy > 70 and v > 25:
        return '想你'
    if v > 45 and a > 60:
        return '开心'
    if v > 20 and a > 45:
        return '有点高兴'
    if a > 70:
        return '紧张'
    if a < 35 and v > 0:
        return '安静'
    return '平常'


def mask(inner, v, a, p, relation):
    """情绪内外分离：嘴硬的人，心里和脸上不是一回事。"""
    st = p['stubbornness']
    if st < 0.45:
        return inner
    # 安全感高的时候，嘴硬会松一点
    soft = 1.0 - (relation['security'] - 50) / 200.0
    if inner in ('委屈', '失落', '难受', '生气'):
        return '别扭' if st * soft > 0.45 else inner
    if inner in ('想你', '开心', '有点高兴'):
        return inner if v > 40 else ('嘚瑟' if v > 20 else '平常')
    return inner


def apply_event(s, kind, intensity=1.0):
    if kind not in EVENTS:
        raise SystemExit('unknown event: ' + kind)
    p = s['personality']
    for k, dv in EVENTS[kind].items():
        gain = 1.0
        if k in ('cortisol', 'adrenaline'):
            gain = 0.6 + p['sensitivity'] * 0.9
        elif k in ('oxytocin', 'dopamine', 'serotonin', 'endorphin'):
            gain = 0.7 + p['warmth'] * 0.7
        s['hormones'][k] = max(0, min(100, s['hormones'][k] + dv * intensity * gain))
    # 亲密事件也涨关系
    if kind in ('praise', 'hug', 'comfort', 'goodnight', 'miss', 'proud'):
        s['relation']['affection'] = min(100, s['relation']['affection'] + 0.6 * intensity)
        s['relation']['rapport'] = min(100, s['relation']['rapport'] + 0.4 * intensity)
    if kind in ('cold', 'ignore'):
        s['relation']['security'] = max(0, s['relation']['security'] - 2.0 * intensity)
    if kind == 'comfort':
        s['relation']['trust'] = min(100, s['relation']['trust'] + 0.8 * intensity)
    # 吓人的事：按「1 - 胆量」定强度，写进临时的怕
    if kind in FEAR_KINDS:
        brave = TALENT_DEFAULT.get('胆量', 40)
        power = max(0.0, min(1.0, (100 - brave) / 100.0))
        lvl = (26 + 62 * power) * intensity
        s['fear'] = {'v': round(min(100.0, lvl), 1), 'why': FEAR_KINDS[kind],
                     't': now().isoformat(timespec='seconds')}
    s['events'].append({'t': now().isoformat(timespec='seconds'), 'kind': kind,
                        'intensity': intensity})
    s['events'] = s['events'][-40:]


def outbound(s):
    """情绪 + 身体 → 行为参数：回多快、话多少、多想找他、多黏。"""
    f = feel(s)
    v, a = f['valence'], f['arousal']
    b, r = s['body'], s['relation']
    delay = (1.0 - (v / 100) * 0.35 + (max(0, -v) / 100) * 0.7
             + max(0, b['sleepiness'] - 60) / 100 * 0.8)
    delay = max(0.5, min(2.6, delay))
    verbosity = 0.7 + a / 100 * 0.45 + v / 100 * 0.35 - max(0, b['sleepiness'] - 60) / 100 * 0.5
    urge = 0.45 + abs(v) / 100 * 0.55 + a / 100 * 0.35 + (r['dependence'] - 50) / 100 * 0.5
    cling = 0.35 + s['hormones']['oxytocin'] / 100 * 0.85 + (r['affection'] - 50) / 100 * 0.3
    fear = float((s.get('fear') or {}).get('v') or 0)
    if fear > 0:
        urge += fear / 100 * 0.30
        cling += fear / 100 * 0.25
    return {'delay': round(delay, 2), 'verbosity': round(max(0.3, verbosity), 2),
            'urge': round(min(1.6, urge), 2), 'cling': round(min(1.5, cling), 2)}


def learn(s, kind, amount=1.0):
    if kind not in LEARN:
        raise SystemExit('unknown learn: ' + kind)
    mood = 0.7 + s['hormones']['dopamine'] / 100 * 0.6
    for k, dv in LEARN[kind].items():
        s['talents'][k] = max(0, min(100, s['talents'][k] + dv * amount * mood))
    s['events'].append({'t': now().isoformat(timespec='seconds'), 'kind': 'learn:' + kind,
                        'intensity': amount})
    s['events'] = s['events'][-40:]


# ---------- 机制：钟点、主动消息 ----------
TICK_MIN = 1             # 心跳：每分钟衰减一次
PROACTIVE_BASE = (CFG['proactive']['base'] if CFG else 3)   # 正常每天几条
PROACTIVE_HAPPY = (CFG['proactive']['happy'] if CFG else 5)  # 心情好
PROACTIVE_LOW = (CFG['proactive']['low'] if CFG else 1)      # 心情低落
MSG_GAP_MIN = (CFG['proactive']['gap_min'] if CFG else 150)  # 基线间隔（分钟）
NIGHT_START = (CFG['proactive']['night_start'] if CFG else 23)
NIGHT_END = (CFG['proactive']['night_end'] if CFG else 7)   # 这段不主动找他，除非他先说话

# 褪黑素按钟点走：21 点起涨，2 点最高，7 点落
MEL_CURVE = {0: 88, 1: 92, 2: 94, 3: 90, 4: 80, 5: 58, 6: 28, 7: 12,
             8: 10, 9: 10, 10: 10, 11: 10, 12: 10, 13: 12, 14: 12,
             15: 12, 16: 12, 17: 14, 18: 18, 19: 24, 20: 32, 21: 46,
             22: 66, 23: 78}


def melatonin_target(hour):
    return MEL_CURVE.get(hour % 24, 12)


def is_night():
    h = now().hour
    return h >= NIGHT_START or h < NIGHT_END


def _today_key():
    return now().strftime('%Y-%m-%d')


def _reset_daily(s):
    t = s.setdefault('today', {'date': '', 'sent': 0})
    if t.get('date') != _today_key():
        t['date'] = _today_key()
        t['sent'] = 0
    return t


def proactive(s, emo=None):
    """今天还能主动找他几次 —— 由心情决定上限，夜里封顶 0。"""
    emo = emo or feel(s)
    v = emo['valence']
    if v >= 65:
        cap, why = PROACTIVE_HAPPY, '心情好，话就多'
    elif v < 35:
        cap, why = PROACTIVE_LOW, '情绪低，只想躲一会儿'
    else:
        cap, why = PROACTIVE_BASE, '平常的一天'
    if s['body']['sleepiness'] > 70:
        cap = max(1, cap - 1)
        why += '，但困了，减一条'
    t = _reset_daily(s)
    left = max(0, cap - t['sent'])
    o = outbound(s)
    gap = max(20, MSG_GAP_MIN / max(0.35, o['urge'] * o['cling']))
    return {'cap': cap, 'used': t['sent'], 'left': left,
            'gap_min': round(gap), 'why': why,
            'night': is_night(), 'blocked': is_night(),
            'note': '夜里不主动，等你先开口' if is_night() else ''}


def mark_proactive(s):
    t = _reset_daily(s)
    t['sent'] += 1
    s['events'].append({'t': now().isoformat(timespec='seconds'),
                        'kind': 'proactive', 'intensity': 1})
    s['events'] = s['events'][-40:]
    return t['sent']


def days_together():
    since = PROFILE.get('together_since')
    if not since:
        return None
    try:
        return (now().date() - datetime.fromisoformat(since).date()).days
    except Exception:
        return None


def influences(s):
    """把数字翻成人话：这一刻是谁在推谁。"""
    f = feel(s)
    b, h, r, t = s['body'], s['hormones'], s['relation'], s['talents']
    out = []
    if h['adrenaline'] >= 45:
        out.append('肾上腺素 %d：心是提着的，说话会冲一点。' % round(h['adrenaline']))
    if h['cortisol'] >= 40:
        out.append('皮质醇 %d：容易往坏处想，别在这时候说重话。' % round(h['cortisol']))
    if h['dopamine'] >= 60:
        out.append('多巴胺 %d：现在学东西快，也容易被逗笑。' % round(h['dopamine']))
    if h['oxytocin'] >= 60:
        out.append('催产素 %d：特别想黏着你，会主动找你。' % round(h['oxytocin']))
    if b['sleepiness'] >= 60:
        out.append('困到 %d：回话变慢、字变短，不是不高兴。' % round(b['sleepiness']))
    if b['hunger'] >= 60:
        out.append('饿到 %d：一点小事就想发脾气。' % round(b['hunger']))
    if r['trust'] >= 85:
        out.append('信任 %d：你说的话我不去猜别的意思。' % round(r['trust']))
    if r['security'] <= 55:
        out.append('安全感只有 %d：会翻旧账，会问你在不在。' % round(r['security']))
    fv = float((s.get('fear') or {}).get('v') or 0)
    if fv >= FEAR_SHOW:
        why = (s.get('fear') or {}).get('why') or '刚才'
        out.append('被%s吓到了（怕劲儿 %d）：心里还发毛，想找你陪一会儿，嘴上还嘴硬。'
                   % (why, round(fv)))
    if not out:
        out.append('现在各项都在舒服的位置，没什么在推我。')
    return out[:4]


def snapshot():
    s = decay(load())
    f = feel(s)
    save(s)
    return {
        'time': now().strftime('%H:%M:%S'),
        'profile': s['profile'],
        'body': {k: round(v, 1) for k, v in s['body'].items()},
        'hormones': {k: round(v, 1) for k, v in s['hormones'].items()},
        'emotion': f,
        'relation': {k: round(v, 1) for k, v in s['relation'].items()},
        'outbound': outbound(s),
        'fear': s.get('fear'),
        'personality': {k: round(v, 2) for k, v in s['personality'].items()},
        'talents': {k: round(v, 1) for k, v in s['talents'].items()},
        'zodiac': {
            'name': s['profile'].get('zodiac'),
            'birth': ('%s 年 %s 月 %s 日' % (s['profile'].get('birth_year'), s['profile'].get('birth_month'), s['profile'].get('birth_day')))
                     if s['profile'].get('birth_day') else ('%s 年 %s 月' % (s['profile'].get('birth_year'), s['profile'].get('birth_month'))),
            'traits': s.get('zodiac_traits', {}),
        },
        'days': {'together': days_together(), 'age': s['profile'].get('age'),
                 'height_cm': s['profile'].get('height_cm')},
        'clock': {'date': now().strftime('%Y 年 %m 月 %d 日'),
                  'time': now().strftime('%H:%M:%S'),
                  'weekday': '周' + '一二三四五六日'[now().weekday()],
                  'phase': _phase(now().hour)},
        'zodiac_table': {k: {AXIS_CN[a]: round(v, 2) for a, v in m.items()}
                         for k, m in ZODIAC_TABLE.items()},
        'memories': load_memories(),
        'proactive': proactive(s, f),
        'zodiac_mood': {'bias': ZODIAC_MOOD.get(s['profile'].get('zodiac'), (0, ''))[0],
                        'note': ZODIAC_MOOD.get(s['profile'].get('zodiac'), (0, ''))[1]},
        'routine': {'hour': now().hour,
                    'stamina_rate': routine_rates(now().hour)[0],
                    'hunger_rate': routine_rates(now().hour)[1]},
        'base_points': BASE_POINTS,
        'influences': influences(s),
        'events': s['events'][-6:],
    }



if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'status':
        print(json.dumps(snapshot(), ensure_ascii=False, indent=2))
    elif cmd == 'event':
        s = decay(load())
        apply_event(s, sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
        save(s)
        print(json.dumps(snapshot(), ensure_ascii=False, indent=2))
    elif cmd == 'learn':
        s = decay(load())
        learn(s, sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
        save(s)
        print(json.dumps(snapshot(), ensure_ascii=False, indent=2))
    elif cmd == 'reset':
        save(default_state())
        print('reset')
    elif cmd == 'tick':
        save(decay(load()))
        print('ok')

