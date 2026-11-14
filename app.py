# -*- coding: utf-8 -*-
"""情绪插件 3.0 —— 本地情绪引擎 + 网页面板。

    python app.py            # 默认 0.0.0.0:8188
    python app.py 9000       # 换端口

装完就能用：浏览器打开 http://127.0.0.1:8188/ ，填一页资料，她就有心跳和情绪了。
"""
import base64
import json
import mimetypes
import os
import socket
import sys
import threading
import time
import traceback
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE = os.path.dirname(os.path.abspath(__file__))
FROZEN = bool(getattr(sys, 'frozen', False))
# 打包成 exe 后：资源（网页）在解压目录里，数据（配置/状态/立绘）放在 exe 旁边
RES = getattr(sys, '_MEIPASS', BASE) if FROZEN else BASE
ROOT = os.path.dirname(sys.executable) if FROZEN else BASE
WEB = os.path.join(RES, 'web')
ASSETS = os.path.join(ROOT, 'assets')
DATA = os.path.join(ROOT, 'data')
for _p in (DATA, ASSETS):
    os.makedirs(_p, exist_ok=True)

# 默认形象（那条大肥鱼）：打包时带一份，运行时缺就补到 assets 里，用户能直接覆盖
_SRC = os.path.join(RES, 'assets', 'default.png')
_DST = os.path.join(ASSETS, 'default.png')
if os.path.exists(_SRC) and not os.path.exists(_DST):
    try:
        import shutil
        shutil.copyfile(_SRC, _DST)
    except OSError:
        pass
os.environ.setdefault('EMOTION_DATA', DATA)
os.environ.setdefault('EMOTION_CONFIG', os.path.join(ROOT, 'config.json'))
sys.path.insert(0, BASE)

import config  # noqa: E402
import engine  # noqa: E402
import classify  # noqa: E402


def bind_paths():
    """把数据路径钉在 ROOT 上（exe 模式下 __file__ 在临时解压目录，不能信）。"""
    config.PROFILE_JSON = os.path.join(ROOT, 'config.json')
    engine.STATE = os.path.join(DATA, 'state.json')
    engine.MEMORY_MD = ((config.load().get('memory') or {}).get('path') or '').strip()


bind_paths()

VERSION = '3.0.0'
PORT = 8188

# 事件的中文名，前端打卡用
KIND_CN = {
    'praise': '夸她', 'miss': '说想她', 'tease': '逗她', 'ignore': '不理她',
    'cold': '冷淡/敷衍', 'worry': '关心她', 'comfort': '哄她', 'goodnight': '说晚安',
    'scare': '吓她一下', 'proud': '为她骄傲', 'hug': '抱抱', 'late_night': '熬夜了',
    'eat': '吃饭了', 'rest': '休息了', 'horror': '看恐怖片', 'thunder': '打雷了',
    'night_walk': '一个人走夜路',
}

KIND_EN = {
    'praise': 'Praise', 'miss': 'Miss her', 'tease': 'Tease', 'ignore': 'Ignore',
    'cold': 'Cold reply', 'worry': 'Care', 'comfort': 'Soothe', 'goodnight': 'Good night',
    'scare': 'Scare her', 'proud': 'Proud of her', 'hug': 'Hug', 'late_night': 'Late night',
    'eat': 'Meal', 'rest': 'Rest', 'horror': 'Horror movie', 'thunder': 'Thunder',
    'night_walk': 'Night walk alone',
}


def cfg():
    return config.load()


def save_cfg(patch):
    cur = config.load()
    config.save(_merge(cur, patch))
    return config.load()


def _merge(base, patch):
    out = dict(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def heartbeat():
    """一分钟一次：衰减 + 曲线 + 落盘。"""
    while True:
        try:
            engine.tick()
        except Exception:
            traceback.print_exc()
        time.sleep(60)


class H(SimpleHTTPRequestHandler):
    server_version = 'EmotionCore/' + VERSION

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    # ---------- 小工具 ----------
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path):
        if not os.path.isfile(path):
            self.send_error(404)
            return
        ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        with open(path, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def log_message(self, fmt, *a):
        # --noconsole 打包后 sys.stderr 是 None，写就崩，所以什么都不能假设
        try:
            if sys.stderr:
                sys.stderr.write('[http] ' + (fmt % a) + '\n')
        except Exception:
            pass

    # ---------- 路由 ----------
    def do_GET(self):
        try:
            return self._get()
        except Exception:
            self._oops()

    def _oops(self):
        msg = traceback.format_exc()
        try:
            with open(os.path.join(ROOT, 'error.log'), 'a', encoding='utf-8') as f:
                f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + msg + '\n')
        except OSError:
            pass
        try:
            if sys.stderr:
                sys.stderr.write(msg)
        except Exception:
            pass
        try:
            self._json(500, {'ok': False, 'error': msg.splitlines()[-1]})
        except Exception:
            pass

    def _get(self):
        p = self.path.split('?')[0]
        # 她的那张脸是主界面；设置/自检/导出导入在 /setup
        if p in ('/', '/index.html', '/live2d.html', '/mine', '/mine.html'):
            return self._file(os.path.join(WEB, 'live2d.html'))
        if p in ('/setup', '/setup.html'):
            return self._file(os.path.join(WEB, 'index.html'))
        if p == '/state':
            return self._json(200, engine.snapshot())
        if p.startswith('/model/'):
            rel = p[len('/model/'):].replace('..', '')
            return self._file(os.path.join(ROOT, 'model', rel))
        if p == '/api/state':
            return self._json(200, engine.snapshot())
        if p == '/api/config':
            return self._json(200, cfg())
        if p == '/api/kinds':
            return self._json(200, {k: {'cn': v, 'en': KIND_EN.get(k, '')} for k, v in KIND_CN.items()})
        if p == '/api/version':
            return self._json(200, {'version': VERSION})
        if p == '/api/where':
            return self._json(200, {'root': ROOT, 'data': DATA, 'assets': ASSETS,
                                    'web': WEB, 'config': config.PROFILE_JSON,
                                    'state': engine.STATE, 'frozen': FROZEN})
        if p == '/api/selfcheck':
            return self._json(200, selfcheck())
        if p == '/api/autostart':
            return self._json(200, autostart_state())
        if p == '/api/export':
            return self._json(200, {'version': VERSION, 'config': cfg(),
                                    'state': engine.load()})
        if p == '/avatar':
            name = (cfg()['profile'].get('avatar') or '').strip()
            if name:
                return self._file(os.path.join(ASSETS, name))
            self.send_error(404)
        if p.startswith('/assets/'):
            return self._file(os.path.join(ASSETS, os.path.basename(p)))
        return self._file(os.path.join(WEB, os.path.basename(p) or 'index.html'))

    def do_POST(self):
        p = self.path.split('?')[0]
        d = self._body()
        try:
            if p == '/api/config':
                out = save_cfg(d)
                # 配置变了要让引擎重新读一遍（周期、性格、上限都从配置来），顺手走一次心跳
                reload_core()
                try:
                    engine.tick()
                except Exception:
                    traceback.print_exc()
                return self._json(200, {'ok': True, 'config': out})
            if p in ('/api/event', '/event'):
                kind = str(d.get('kind') or '').strip()
                if kind not in engine.EVENTS:
                    return self._json(400, {'ok': False, 'error': '没有这个事件：%s' % kind})
                s = engine.decay(engine.load())
                engine.apply_event(s, kind, float(d.get('intensity') or 1.0),
                                   str(d.get('why') or KIND_CN.get(kind, kind)))
                engine.save(s)
                # 私人页要的是 state 本体，别的接口要 {ok, state}，两边都照顾到
                snap = engine.snapshot()
                if p == '/event':
                    return self._json(200, snap)
                return self._json(200, {'ok': True, 'state': snap})
            if p == '/profile':
                # 私人页的老接口：直接给 profile 那一坨
                save_cfg({'profile': d})
                reload_core()
                try:
                    engine.tick()
                except Exception:
                    traceback.print_exc()
                return self._json(200, {'ok': True})
            if p == '/api/mark-proactive':
                s = engine.load()
                engine.mark_proactive(s)
                engine.save(s)
                return self._json(200, {'ok': True})
            if p == '/api/avatar':
                raw = str(d.get('data') or '')
                if ',' in raw and raw.startswith('data:'):
                    raw = raw.split(',', 1)[1]
                if not raw:
                    return self._json(400, {'ok': False, 'error': '没有图片'})
                blob = base64.b64decode(raw)
                if len(blob) > 8 * 1024 * 1024:
                    return self._json(400, {'ok': False, 'error': '图片太大了（限 8MB）'})
                ext = '.png'
                if blob[:3] == b'\xff\xd8\xff':
                    ext = '.jpg'
                elif blob[:6] in (b'GIF87a', b'GIF89a'):
                    ext = '.gif'
                elif blob[:4] == b'RIFF':
                    ext = '.webp'
                for old in ('avatar.png', 'avatar.jpg', 'avatar.gif', 'avatar.webp'):
                    try:
                        os.remove(os.path.join(ASSETS, old))
                    except OSError:
                        pass
                name = 'avatar' + ext
                with open(os.path.join(ASSETS, name), 'wb') as f:
                    f.write(blob)
                save_cfg({'profile': {'avatar': name}})
                return self._json(200, {'ok': True, 'avatar': name})
            if p == '/api/quit':
                def _bye():
                    time.sleep(0.4)
                    try:
                        self.server.shutdown()
                    except Exception:
                        pass
                    time.sleep(0.4)
                    os._exit(0)
                threading.Thread(target=_bye, daemon=True).start()
                return self._json(200, {'ok': True})
            if p == '/api/autostart':
                on = bool(d.get('on'))
                autostart(on)
                install_watchdog(on)
                st = autostart_state()
                st['ok'] = True
                return self._json(200, st)
            if p == '/api/classify':
                # 一句话 → 事件；apply=true 时顺手推进去
                g = classify.guess(d.get('text'))
                if not g:
                    return self._json(200, {'ok': True, 'hit': None})
                if d.get('apply'):
                    s = engine.decay(engine.load())
                    engine.apply_event(s, g['kind'], float(d.get('intensity') or g['score']),
                                       str(d.get('why') or g['why']))
                    engine.save(s)
                    return self._json(200, {'ok': True, 'hit': g, 'state': engine.snapshot()})
                return self._json(200, {'ok': True, 'hit': g})
            if p == '/api/import':
                st = d.get('state')
                if not isinstance(st, dict) or 'hormones' not in st:
                    return self._json(400, {'ok': False, 'error': '这个不像状态文件'})
                engine.save(st)
                if isinstance(d.get('config'), dict):
                    save_cfg(d['config'])
                    reload_core()
                return self._json(200, {'ok': True})
            if p == '/api/reset':
                s = engine.default_state()
                engine.save(s)
                return self._json(200, {'ok': True, 'state': engine.snapshot()})
        except Exception as e:
            traceback.print_exc()
            return self._json(500, {'ok': False, 'error': '%s: %s' % (type(e).__name__, e)})
        self.send_error(404)


def _writable(path):
    try:
        t = os.path.join(path, '.w')
        with open(t, 'w') as f:
            f.write('1')
        os.remove(t)
        return True
    except OSError:
        return False


def selfcheck():
    """给「装完就上手」用：一眼看出哪儿没通。"""
    out = {'ok': True, 'items': [], 'version': VERSION, 'root': ROOT}

    def add(name, ok, note=''):
        out['items'].append({'name': name, 'ok': bool(ok), 'note': note})
        if not ok:
            out['ok'] = False

    c = cfg()
    s = engine.load()
    add('数据目录可写', _writable(DATA), DATA)
    add('程序目录可写', _writable(ROOT), ROOT)
    add('网页文件齐全', os.path.exists(os.path.join(WEB, 'index.html')), WEB)
    add('状态文件', os.path.exists(engine.STATE), engine.STATE)
    add('心情事件表', bool(engine.EVENTS), '%d 种' % len(engine.EVENTS))
    add('判定词表', bool(classify.RULES), '%d 条' % len(classify.RULES))
    add('资料填了没', bool((c['profile'].get('name') or '').strip()),
        (c['profile'].get('name') or '还没填'))
    add('心跳在跑', bool(s.get('last_tick')), '上次 %s' % (s.get('last_tick') or '还没跑过'))
    return out


def _alive(port):
    s = socket.socket()
    s.settimeout(0.6)
    try:
        s.connect(('127.0.0.1', port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def _ours(port):
    """这个端口上的是不是我们自己（别把别人的程序当成自己）。"""
    try:
        import urllib.request
        with urllib.request.urlopen('http://127.0.0.1:%d/api/version' % port, timeout=1.2) as r:
            d = json.loads(r.read().decode('utf-8'))
        return str(d.get('version') or '').startswith('3.')
    except Exception:
        return False


def _pick_port(start, tries=12):
    """从 start 开始找一个能用的：自己已经占了就返回它，被别人占就往后挪。"""
    for p in range(start, start + tries):
        if _ours(p):
            return p, True
        if not _alive(p):
            return p, False
    return start, False


RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
APP_NAME = '情绪引擎3'
TASK_NAME = 'EmotionEngine3'


def _task_cmd():
    """守护任务要跑的命令行（安静模式，不弹浏览器）。"""
    if FROZEN:
        return '"%s" --quiet' % sys.executable
    pyw = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
    exe = pyw if os.path.exists(pyw) else sys.executable
    return '"%s" "%s" --quiet' % (exe, os.path.join(BASE, 'app.py'))


def install_watchdog(enable):
    """每 5 分钟看一眼，进程没了就拉起来。建在当前用户下，不需要管理员。"""
    if os.name != 'nt':
        return False
    import subprocess
    try:
        if enable:
            r = subprocess.run(['schtasks', '/Create', '/F', '/SC', 'MINUTE', '/MO', '5',
                                '/TN', TASK_NAME, '/TR', _task_cmd()],
                               capture_output=True, text=True, timeout=25)
        else:
            r = subprocess.run(['schtasks', '/Delete', '/F', '/TN', TASK_NAME],
                               capture_output=True, text=True, timeout=25)
        return r.returncode == 0
    except Exception:
        return False


def autostart(enable):
    """开机自启：写 HKCU 的 Run 键，不碰系统目录、不要管理员。"""
    if os.name != 'nt':
        return False
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_ALL_ACCESS)
    except OSError:
        return False
    try:
        if enable:
            if FROZEN:
                target = '"%s"' % sys.executable
            else:
                target = '"%s" "%s"' % (sys.executable, os.path.join(BASE, 'app.py'))
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, target)
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass
    except OSError:
        return False
    finally:
        try:
            winreg.CloseKey(key)
        except Exception:
            pass
    return True


def autostart_state():
    """自启和守护现在是什么状态。"""
    on = wd = False
    if os.name == 'nt':
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY)
            try:
                winreg.QueryValueEx(key, APP_NAME)
                on = True
            finally:
                winreg.CloseKey(key)
        except OSError:
            on = False
        try:
            import subprocess
            r = subprocess.run(['schtasks', '/Query', '/TN', TASK_NAME],
                               capture_output=True, text=True, timeout=12)
            wd = r.returncode == 0
        except Exception:
            wd = False
    return {'autostart': on, 'watchdog': wd}


def reload_core():
    """配置改完后重载引擎里的模块级常量（周期起点、主动开口上限等）。

    顺序要紧：先把 config 的路径钉到 ROOT，再 reload engine——
    否则 engine 重载时读的是解压目录里的空配置，重新变成默认值。
    """
    import importlib
    importlib.reload(config)
    config.PROFILE_JSON = os.path.join(ROOT, 'config.json')
    engine.STATE = os.path.join(DATA, 'state.json')
    importlib.reload(engine)
    bind_paths()
    # 兜底：把新配置直接塞进重载后的引擎模块，别指望模块级常量一定重算
    fresh = config.load()
    engine.CFG = fresh
    engine.PROFILE = dict(fresh.get('profile') or {})
    engine.PERSONALITY = dict(fresh.get('personality') or {})
    engine.MEMORY_MD = ((fresh.get('memory') or {}).get('path') or '').strip()
    cy = fresh.get('cycle') or {}
    if hasattr(engine, 'CYCLE_START'):
        engine.CYCLE_START = cy.get('start') or ''


def main():
    argv = sys.argv[1:]
    quiet = '--quiet' in argv
    if '--install' in argv:
        a = autostart(True)
        w = install_watchdog(True)
        print('开机自启：%s；崩溃守护：%s' % ('好' if a else '失败', '好' if w else '失败'))
        return 0
    if '--uninstall' in argv:
        a = autostart(False)
        w = install_watchdog(False)
        print('开机自启：%s；崩溃守护：%s' % ('已关' if a else '没找到', '已关' if w else '没找到'))
        return 0
    port = PORT
    for a in argv:
        if a.isdigit():
            port = int(a)
    port, running = _pick_port(port)
    url = 'http://127.0.0.1:%d/' % port

    # 已经有一个在跑：别起第二个，直接把页面打开
    if running:
        if not quiet:
            print('已经跑着了：%s' % url, flush=True)
        if '--no-browser' not in argv and not quiet:
            webbrowser.open(url)
        return 0

    # 一条龙：第一次跑（还没有配置）就顺手把开机自启和守护装好，用户什么都不用设
    if os.name == 'nt' and '--no-autostart' not in argv and not quiet:
        if not os.path.exists(config.PROFILE_JSON):
            autostart(True)
            install_watchdog(True)

    threading.Thread(target=heartbeat, daemon=True).start()
    srv = ThreadingHTTPServer(('0.0.0.0', port), H)
    if not quiet:
        print('情绪插件 %s 已启动：%s' % (VERSION, url), flush=True)
        print('数据目录：%s' % DATA, flush=True)
    if '--no-browser' not in argv and not quiet:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        if not quiet:
            print('\n收到 Ctrl+C，退出。')
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
