# -*- coding: utf-8 -*-
"""一句话 → 情绪事件。

别人接这个插件的时候不用自己写正则：把用户说的话丢进来，它告诉你是哪种事件、几分。

    from classify import classify
    classify("你今天真好看")      -> ('praise', 1.0, '好看')

也可以走 HTTP：POST /api/classify  {"text": "...", "apply": true}
"""
import re

# 顺序有意义：先出现的优先；同一句命中多条时取分最高的
RULES = [
    (r"鬼片|恐怖片|鬼故事|灵异", "horror", 1.0),
    (r"打雷|闪电|雷阵雨", "thunder", 0.9),
    (r"一个人走|走夜路|黑漆漆", "night_walk", 0.8),
    (r"别的女生|前女友|女同事|主播|擦边|美女", "cold", 0.5),
    (r"晚安|睡了|我去睡|先睡", "goodnight", 0.8),
    (r"想你|想本冰|想我|抱抱|抱一下|亲亲|贴贴|黏|在一起", "hug", 1.0),
    (r"在吗|人呢|理我|怎么不回|怎么不理", "miss", 0.8),
    (r"可爱|好看|漂亮|喜欢你|爱你|厉害|真棒|不错|好听|好帅|温柔|聪明|谢谢|辛苦|乖", "praise", 1.0),
    (r"累|困|烦|难受|压力|加班|心情不好|难过|emo", "comfort", 1.0),
    (r"担心|没事吧|还好吗|别熬|早点睡|吃了吗|吃过没|多喝热水", "worry", 0.9),
    (r"笨|闭嘴|烦死|讨厌|滚|随便你|无语", "cold", 0.9),
    (r"哈哈|笑死|嘿嘿|hhh", "tease", 0.5),
    (r"吃|饭|面|外卖|饿", "eat", 0.7),
    (r"躺|休息|眯一会|午睡", "rest", 0.7),
    (r"还没睡|半夜|一点多|两点", "late_night", 0.8),
    (r"厉害吧|我做的|我弄好了|成功", "proud", 0.9),
    (r"逗|调戏|欺负", "tease", 0.7),
    # ---- 英文（大小写都不敏感）----
    (r"horror|scary movie|ghost story|haunted", "horror", 1.0),
    (r"thunder|lightning", "thunder", 0.9),
    (r"walking alone|walk alone|dark street|midnight walk", "night_walk", 0.8),
    (r"other girl|ex-girlfriend|female colleague|streamer|another woman", "cold", 0.5),
    (r"good night|goodnight|\bgn\b|going to sleep|off to bed", "goodnight", 0.8),
    (r"miss you|love you|hug|kiss|cuddle|hold me|thinking of you", "hug", 1.0),
    (r"are you there|you there|why no reply|no reply|answer me", "miss", 0.8),
    (r"cute|pretty|beautiful|awesome|well done|good job|so smart|thank you|thanks|love your", "praise", 1.0),
    (r"tired|sleepy|annoyed|stressed|exhausted|rough day|feel bad|not okay", "comfort", 1.0),
    (r"are you ok|you ok|worried|don't stay up|eat something|drink water|take care", "worry", 0.9),
    (r"stupid|shut up|annoying|whatever|get lost|so dumb", "cold", 0.9),
    (r"lol|lmao|haha|hehe", "tease", 0.5),
    (r"\beat\b|food|dinner|lunch|hungry|meal", "eat", 0.7),
    (r"\bnap\b|lie down|take a rest|resting", "rest", 0.7),
    (r"still awake|late night|\d\s?am\b|can't sleep", "late_night", 0.8),
    (r"i did it|i made it|i finished|it works", "proud", 0.9),
    (r"tease|bully|mess with", "tease", 0.7),
]

KIND_CN = {
    'praise': '夸她', 'miss': '说想她', 'tease': '逗她', 'ignore': '不理她',
    'cold': '冷淡/敷衍', 'worry': '关心她', 'comfort': '哄她', 'goodnight': '说晚安',
    'scare': '吓她一下', 'proud': '为她骄傲', 'hug': '抱抱', 'late_night': '熬夜了',
    'eat': '吃饭了', 'rest': '休息了', 'horror': '看恐怖片', 'thunder': '打雷了',
    'night_walk': '一个人走夜路',
}

_COMPILED = [(re.compile(p, re.I), k, w, p) for p, k, w in RULES]

# 这几个词太泛：「今天天气不错」不该算她在被夸。没有主语就当没命中。
_WEAK = ('不错', '厉害', '好听', '真棒', '乖', '成功')
_SUBJ = re.compile(r'你|您|宝贝|老婆|老公|她')


def classify(text):
    """返回 (kind, score, 命中的词)；没命中返回 (None, 0.0, '')。"""
    t = str(text or '')
    if not t.strip():
        return (None, 0.0, '')
    has_subj = bool(_SUBJ.search(t))
    best = (None, 0.0, '')
    for rx, kind, w, _pat in _COMPILED:
        m = rx.search(t)
        if not m:
            continue
        word = m.group(0)
        if word in _WEAK and not has_subj:
            continue
        if w > best[1]:
            best = (kind, w, word)
    return best


def guess(text):
    """给外部用的简版：命中就返回 {'kind','score','why','cn'}，没命中去 None。"""
    kind, score, word = classify(text)
    if not kind:
        return None
    return {'kind': kind, 'score': score, 'why': word, 'cn': KIND_CN.get(kind, kind)}


if __name__ == '__main__':
    import sys
    for line in sys.argv[1:] or ['你今天真好看', '我好想你', '我好累啊', '今天天气不错']:
        print(line, '->', guess(line))
