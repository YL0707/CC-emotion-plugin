把自己要用的 Live2D 模型放在这个目录里。

1. 建一个子目录，例如 model/我的角色/，把 .model3.json、.moc3、贴图、physics 等都放进去。
2. 复制 model.json.example 为 model.json，把 path 改成你的 .model3.json 的相对路径，例如：
   { "path": "model/我的角色/我的角色.model3.json" }
3. 刷新页面。

不放模型也能用，人物区会显示一段占位提示，其他面板照常工作。
注意模型版权：请使用自己有权的模型，官方样例（Haru / Hiyori / Mao 等）可用于测试。
