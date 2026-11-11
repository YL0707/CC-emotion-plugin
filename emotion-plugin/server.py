# -*- coding: utf-8 -*-
"""冰冰情绪页的本地小服务：静态页 + 状态接口 + 事件触发。"""
import json, os, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
import engine  # noqa: E402


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    def do_GET(self):
        if self.path.startswith('/state'):
            body = json.dumps(engine.snapshot(), ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/proactive'):
            s = engine.decay(engine.load())
            emo = s.get('emotion', {})
            info = engine.proactive(s, emo)
            engine.save(s)
            body = json.dumps(info, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/':
            self.path = '/live2d.html'
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/event'):
            n = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(n) or b'{}')
            s = engine.decay(engine.load())
            engine.apply_event(s, data.get('kind', 'praise'), float(data.get('intensity', 1.0)))
            engine.save(s)
            body = json.dumps(engine.snapshot(), ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/profile'):
            n = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(n) or b'{}')
            import config as cfgmod
            cfg = cfgmod.load()
            prof = cfg.setdefault('profile', {})
            for k in ('name', 'called_by', 'birth_year', 'birth_month', 'birth_day', 'height_cm'):
                v = data.get(k)
                if v in ('', None):
                    continue
                prof[k] = int(v) if k in ('birth_year', 'birth_month', 'birth_day', 'height_cm') else str(v)
            pro = cfg.setdefault('proactive', {})
            for k in ('base', 'happy', 'low', 'gap_min'):
                v = data.get(k)
                if v in ('', None):
                    continue
                pro[k] = int(v)
            cfgmod.save(cfg)
            import importlib
            importlib.reload(engine)
            body = json.dumps({'ok': True, 'profile': cfg.get('profile', {}),
                               'proactive': cfg.get('proactive', {})}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/proactive/used'):
            s = engine.decay(engine.load())
            engine.mark_proactive(s)
            engine.save(s)
            body = json.dumps({'ok': True}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    print('http://127.0.0.1:%d' % port)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
