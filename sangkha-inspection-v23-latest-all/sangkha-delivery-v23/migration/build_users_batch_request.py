import json
from pathlib import Path

rows = json.loads(Path('/tmp/users_realdata_rows.json').read_text())
request_rows = []
for row in rows:
    request_rows.append({
        'values': [
            {'userEnteredValue': {'stringValue': str(value)}}
            for value in row
        ]
    })
body = {
    'requests': [{
        'updateCells': {
            'start': {'sheetId': 1610908371, 'rowIndex': 0, 'columnIndex': 0},
            'rows': request_rows,
            'fields': 'userEnteredValue'
        }
    }]
}
Path('/tmp/users_batch_request.json').write_text(json.dumps(body, ensure_ascii=False))
print('REQUEST_ROWS', len(request_rows), 'BYTES', Path('/tmp/users_batch_request.json').stat().st_size)
