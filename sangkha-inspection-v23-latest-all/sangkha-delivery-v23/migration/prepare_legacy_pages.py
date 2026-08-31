from pathlib import Path

root = Path('/home/ubuntu/sangkha-inspection/migration/frontend')
insert = '  <script src="app-config.js"></script>\n  <script src="api-client.js"></script>\n'
for name in ('index.html', 'login.html', 'inspector.html', 'supervisor.html'):
    path = root / name
    text = path.read_text(encoding='utf-8')
    if 'api-client.js' not in text:
        text = text.replace('</head>', insert + '</head>', 1)
        path.write_text(text, encoding='utf-8')
print('legacy pages prepared')
