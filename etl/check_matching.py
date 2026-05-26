import csv
from collections import Counter

import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICORE_CSV   = os.path.join(BASE, "icore26_data", "iCore26_KilledColumnsForLoading.csv")
INPROC_CSV  = os.path.join(BASE, "dblp_dataset", "input_inproceedings.csv")

# Build acronym set from iCore26
acronyms = set()
with open(ICORE_CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        acr = row.get("Acronym", "").strip()
        if acr:
            acronyms.add(acr.upper())

print(f"iCore26 acronyms loaded: {len(acronyms)}")
print(f"Sample: {sorted(list(acronyms))[:15]}\n")

# Scan inproceedings booktitles
booktitle_counts = Counter()
matched = 0
total   = 0

with open(INPROC_CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f, delimiter=";"):
        bt = row.get("booktitle", "").strip()
        if not bt:
            continue
        total += 1
        booktitle_counts[bt.upper()] += 1
        if bt.upper() in acronyms:
            matched += 1

print(f"Total inproceedings with booktitle: {total}")
print(f"Matched to iCore26 acronym:         {matched}  ({100*matched/total:.1f}%)")
print(f"Unique booktitle values:             {len(booktitle_counts)}\n")

# Top 20 most common booktitles that DID match
print("=== TOP 20 MATCHED booktitles ===")
for bt, count in booktitle_counts.most_common():
    if bt in acronyms:
        print(f"  {count:>6}  {bt}")
    if sum(1 for b,_ in booktitle_counts.most_common() if b in acronyms and booktitle_counts[b] >= count) >= 20:
        break

print()

# Top 30 most common booktitles that did NOT match
print("=== TOP 30 UNMATCHED booktitles (most frequent) ===")
count = 0
for bt, n in booktitle_counts.most_common():
    if bt not in acronyms:
        print(f"  {n:>6}  {bt}")
        count += 1
        if count >= 30:
            break
