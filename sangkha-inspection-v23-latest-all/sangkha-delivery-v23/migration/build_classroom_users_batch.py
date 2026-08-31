import json
from pathlib import Path

rows = json.loads(Path('/tmp/users_realdata_rows.json').read_text())
rows = [rows[0]] + [row for row in rows[1:] if row[3] == 'INSPECTOR' and row[5] == 'CLASSROOM']
request_rows = [{'values': [{'userEnteredValue': {'stringValue': str(value)}} for value in row]} for row in rows]
# Clear the previous draft range first, then write only classroom inspectors.
body = {
    'requests': [
        {'updateCells': {
            'range': {'sheetId': 1610908371, 'startRowIndex': 0, 'endRowIndex': 1000, 'startColumnIndex': 0, 'endColumnIndex': 7},
            'rows': [{'values': []} for _ in range(1000)],
            'fields': 'userEnteredValue'
        }},
        {'updateCells': {
            'start': {'sheetId': 1610908371, 'rowIndex': 0, 'columnIndex': 0},
            'rows': request_rows,
            'fields': 'userEnteredValue'
        }}
    ]
}
Path('/tmp/classroom_users_batch_request.json').write_text(json.dumps(body, ensure_ascii=False))
print('ROWS', len(rows), 'INSPECTORS', len(rows)-1, 'BYTES', Path('/tmp/classroom_users_batch_request.json').stat().st_size)
for grade in '123456':
    group = [row for row in rows[1:] if row[4] == grade]
    print('GRADE', grade, 'COUNT', len(group), 'PAIRS', len(group)//2, 'ODD', len(group)%2)
