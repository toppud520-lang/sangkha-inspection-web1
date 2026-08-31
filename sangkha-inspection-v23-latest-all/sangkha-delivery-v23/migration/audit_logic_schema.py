import csv
import io
import requests
from collections import Counter, defaultdict

SHEET_ID = "1X7Fm-y6N4pphGp1fL900gIG0RQqWMylJ1RuzIA9RZmQ"

def fetch(sheet):
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
    response = requests.get(url, params={"tqx": "out:csv", "sheet": sheet}, timeout=30)
    response.raise_for_status()
    return list(csv.reader(io.StringIO(response.text)))

users = fetch("Users")
locations = fetch("Locations")
settings = fetch("System_Settings")
print("USERS_ROWS", len(users))
print("USERS_HEAD")
for row in users[:3]:
    print(row[:12])
print("LOCATIONS_HEAD")
for row in locations[:3]:
    print(row)
print("LOCATIONS_ROWS", len(locations))
if locations:
    header = [x.strip() for x in locations[0]]
    idx = {name: i for i, name in enumerate(header)}
    data = locations[1:]
    def val(row, key):
        i = idx.get(key)
        return row[i].strip() if i is not None and i < len(row) else ""
    by_grade = defaultdict(list)
    for row in data:
        by_grade[val(row, "Grade_Level")].append(row)
    for grade in sorted(by_grade):
        rows = by_grade[grade]
        types = Counter(val(row, "Type") for row in rows)
        sme = [val(row, "Location_ID") for row in rows if val(row, "Is_SME").upper() in {"TRUE", "1", "YES", "ใช่"}]
        print("GRADE", grade, "COUNT", len(rows), "TYPES", dict(types), "SME", sme)
print("SETTINGS_ROWS", len(settings))
for row in settings[:3]:
    print(row)
