import json
import re
from pathlib import Path

source = json.loads(Path('/tmp/real_values.json').read_text())['values']
header = ['Student_ID', 'PIN', 'Full_Name', 'Role', 'Assigned_Grade', 'Assigned_Type', 'Assigned_Locations']
rows = [header]

for i, row in enumerate(source):
    first = str(row[0]).strip() if row else ''
    supervisor = re.match(r'พี่กำกับดูแลม\.(\d)\s+(.+?)\s*\n?(\d{4,6})\s*$', first, re.S)
    if not supervisor:
        continue
    grade, name, school_id = supervisor.groups()
    rows.append([f'Super{grade}', f'S{school_id}', name.strip(), 'SUPERVISOR', grade, 'CLASSROOM', ''])
    # Next row is the source header, followed by the ordered student list until the next section.
    j = i + 2
    while j < len(source):
        current = source[j]
        if current and re.match(r'พี่กำกับดูแลม\.', str(current[0]).strip()):
            break
        if len(current) >= 3 and str(current[0]).strip().isdigit() and '/' in str(current[2]).strip():
            student_id = str(current[0]).strip().zfill(5)
            full_name = str(current[1]).strip()
            rows.append([f'Ins{student_id}', f'Ins00{student_id}', full_name, 'INSPECTOR', grade, 'CLASSROOM', ''])
        j += 1

# Remove accidental duplicates while preserving source order; duplicate IDs are flagged in the report.
seen = {}
unique = [header]
duplicates = []
for row in rows[1:]:
    sid = row[0]
    if sid in seen:
        duplicates.append((sid, seen[sid], row))
        continue
    seen[sid] = len(unique)
    unique.append(row)

Path('/tmp/users_realdata_rows.json').write_text(json.dumps(unique, ensure_ascii=False, indent=2))
Path('/tmp/users_realdata.tsv').write_text('\n'.join('\t'.join(row) for row in unique) + '\n')
print('ROWS', len(unique))
print('SUPERVISORS', sum(1 for row in unique[1:] if row[3] == 'SUPERVISOR'))
print('INSPECTORS', sum(1 for row in unique[1:] if row[3] == 'INSPECTOR'))
print('DUPLICATES', len(duplicates))
for dup in duplicates:
    print('DUPLICATE', dup[0], 'first=', dup[1], 'later=', dup[2])
for grade in '123456':
    group = [row for row in unique[1:] if row[3] == 'INSPECTOR' and row[4] == grade]
    print('GRADE', grade, 'INSPECTORS', len(group), 'PAIRS', len(group)//2, 'ODD', len(group)%2)
print('PREVIEW')
for row in unique[:8]:
    print(row)
