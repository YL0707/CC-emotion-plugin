# -*- coding: utf-8 -*-
"""配置层：把角色设定从代码里挪出来。

用法：
  cfg = config.load()            # 读 profile.json，缺的字段用默认值补
  config.save(cfg)               # 写回 profile.json
  config.zodiac_of(6, 15)        # -> '双子座'
  config.age_of(1999, 6, 15)     # -> 27（按今天算）

别人要用这套插件，只需要改 profile.json，不用动代码。
"""
import json
import os
from datetime import date, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
PROFILE_JSON = os.path.join(BASE, 'profile.json')

# 十二星座的日期边界（月, 日）
ZODIAC_SPANS = [
    ((3, 21), (4, 19), '白羊座'),
    ((4, 20), (5, 20), '金牛座'),
    ((5, 21), (6, 21), '双子座'),
    ((6, 22), (7, 22), '巨蟹座'),
    ((7, 23), (8, 22), '狮子座'),
    ((8, 23), (9, 22), '处女座'),
    ((9, 23), (10, 23), '天秤座'),
    ((10, 24), (11, 22), '天蝎座'),
    ((11, 23), (12, 21), '射手座'),
    ((12, 22), (1, 19), '摩羯座'),
    ((1, 20), (2, 18), '水瓶座'),
    ((2, 19), (3, 20), '双鱼座'),
]

DEFAULTS = {
    'profile': {
        'name': '',
        'called_by': '',
        'birth_year': None,
        'birth_month': None,
        'birth_day': None,
        'height_cm': None,
        'appearance': '',
        'speech': '',
    },
    'personality': {
        'warmth': 0.55,
        'sensitivity': 0.55,
        'resilience': 0.55,
        'optimism': 0.55,
        'openness': 0.55,
        'stubbornness': 0.55,
    },
    'zodiac_traits': {},
    'body_rest': {'stamina': 65, 'sleepiness': 32, 'hunger': 26, 'health': 85},
    'relation_rest': {'affection': 60, 'trust': 60, 'dependence': 50, 'security': 55, 'rapport': 50},
    'talents': ['理性', '直觉', '共情', '表达', '动手', '胆量'],
    'talent_default': {'理性': 60, '直觉': 60, '共情': 60, '表达': 60, '动手': 55, '胆量': 50},
    'proactive': {'base': 3, 'happy': 5, 'low': 1, 'night_start': 23, 'night_end': 7, 'gap_min': 150},
}


def zodiac_of(month, day):
    """按生日算星座。算不出就返回 None。"""
    try:
        m, d = int(month), int(day)
    except (TypeError, ValueError):
        return None
    if not (1 <= m <= 12 and 1 <= d <= 31):
        return None
    for (m1, d1), (m2, d2), name in ZODIAC_SPANS:
        if (m1, d1) <= (m2, d2):
            if (m, d) >= (m1, d1) and (m, d) <= (m2, d2):
                return name
        else:  # 跨年那一个（摩羯）
            if (m, d) >= (m1, d1) or (m, d) <= (m2, d2):
                return name
    return None


def age_of(year, month=None, day=None, today=None):
    """按生日算年龄；没给月份就用 7 月 1 日做个中点。"""
    try:
        y = int(year)
    except (TypeError, ValueError):
        return None
    today = today or date.today()
    m = int(month) if month else 7
    d = int(day) if day else 1
    try:
        had = (today.month, today.day) >= (m, d)
    except ValueError:
        had = True
    return today.year - y - (0 if had else 1)


def _merge(base, patch):
    out = dict(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def load(path=None):
    """读配置；文件不在就用默认值，并且把算出来的星座/年龄写进 profile。"""
    path = path or PROFILE_JSON
    raw = {}
    try:
        with open(path, encoding='utf-8') as f:
            raw = json.load(f) or {}
    except (OSError, ValueError):
        raw = {}
    cfg = _merge(DEFAULTS, raw)
    p = cfg['profile']
    p['zodiac'] = zodiac_of(p.get('birth_month'), p.get('birth_day'))
    p['age'] = age_of(p.get('birth_year'), p.get('birth_month'), p.get('birth_day'))
    return cfg


def save(cfg, path=None):
    path = path or PROFILE_JSON
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return path


if __name__ == '__main__':
    c = load()
    print(json.dumps(c, ensure_ascii=False, indent=2))
