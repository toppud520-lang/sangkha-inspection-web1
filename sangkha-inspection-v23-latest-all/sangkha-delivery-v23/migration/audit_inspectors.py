import csv
import io
import requests
from collections import Counter, defaultdict

SHEET_ID = "1X7Fm-y6N4pphGp1fL900gIG0RQqWMylJ1RuzIA9RZmQ"
URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
rows = list(csv.reader(io.StringIO(requests.get(URL, params={"tqx": "out:csv", "sheet": "Users"}, timeout=30).text)))
header = [x.strip() for x in rows[0]]
print("HEADER", header[:12])
for i, row in enumerate(rows[1:], start=2):
    values = row + [""] * max(0, 7 - len(row))
    sid, pin, name, role, grade, typ, assigned = [str(values[j]).strip() for j in range(7)]
    if role.upper() == "INSPECTOR":
        print(i, sid, role, "grade=", grade, "type=", typ, "assigned=", assigned)
print("ROLE_COUNTS", Counter((str((r + [""]*7)[3]).strip().upper()) for r in rows[1:]))
print("INSPECTOR_GROUPS")
groups = defaultdict(list)
for row in rows[1:]:
    values = row + [""] * max(0, 7-len(row))
    role = str(values[3]).strip().upper()
    if role == "INSPECTOR":
        groups[(str(values[4]).strip(), str(values[5]).strip())].append(str(values[0]).strip())
for key, ids in sorted(groups.items()):
    print(key, len(ids), ids)
