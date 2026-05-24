"""
ETL Script — Academic Publications Database
Loads all source files into MySQL in dependency order.

Run: python etl.py
Requires: pip install mysql-connector-python openpyxl
"""

import csv
import re
import sys
import difflib
import openpyxl
import mysql.connector
from datetime import datetime, date

# =============================================================
# CONFIG — adjust to your MySQL setup
# =============================================================
DB_CONFIG = {
    "host":     "localhost",
    "port":     3306,
    "user":     "root",
    "password": "root",   # <-- change this
    "database": "academic_db",
    "charset":  "utf8mb4",
}

import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ICORE_CSV        = os.path.join(BASE, "icore26_data", "iCore26_KilledColumnsForLoading.csv")
ICORE_CATS_XLSX  = os.path.join(BASE, "icore26_data", "icoreCategories.xlsx")
JOURNAL_RANK_CSV = os.path.join(BASE, "journal_ranking_data_raw", "journal_ranking_data_raw.csv")
SUBJECT_AREA_CSV = os.path.join(BASE, "journal_ranking_data_raw", "bestSubjectArea.csv")
INPROC_CSV       = os.path.join(BASE, "dblp_dataset", "input_inproceedings.csv")
ARTICLE_CSV      = os.path.join(BASE, "dblp_dataset", "input_article.csv")

BATCH_SIZE = 500   # rows per INSERT batch

# =============================================================
# HELPERS
# =============================================================

def connect():
    return mysql.connector.connect(**DB_CONFIG)

def normalize(s):
    """Lowercase, remove punctuation, collapse whitespace — for fuzzy matching."""
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def safe_int(v):
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return None

def safe_float(v):
    try:
        return float(str(v).strip().replace(",", "."))
    except (ValueError, TypeError):
        return None

def safe_date(v):
    if not v or not str(v).strip():
        return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def batch_insert(cursor, sql, rows):
    """Execute many rows in batches to avoid memory issues."""
    for i in range(0, len(rows), BATCH_SIZE):
        cursor.executemany(sql, rows[i:i + BATCH_SIZE])

# =============================================================
# PHASE 1 — primary_for  (icoreCategories.xlsx)
# =============================================================

def load_primary_for(conn):
    print("[1/6] Loading primary_for ...")
    wb = openpyxl.load_workbook(ICORE_CATS_XLSX)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        for_id = safe_int(row[0])
        desc   = str(row[1]).strip() if row[1] else None
        if for_id is not None and desc:
            rows.append((for_id, desc))

    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE primary_for")
    batch_insert(cur,
        "INSERT IGNORE INTO primary_for (for_id, description) VALUES (%s, %s)",
        rows)
    conn.commit()
    cur.close()
    print(f"    -> {len(rows)} rows inserted.")

# =============================================================
# PHASE 2 — best_subject_area  (bestSubjectArea.csv)
# =============================================================

def load_subject_areas(conn):
    print("[2/6] Loading best_subject_area ...")
    areas = []
    with open(SUBJECT_AREA_CSV, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # skip header "BestSubjectArea"
        for row in reader:
            name = row[0].strip() if row else ""
            if name:
                areas.append((name,))

    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE best_subject_area")
    batch_insert(cur,
        "INSERT IGNORE INTO best_subject_area (name) VALUES (%s)",
        areas)
    conn.commit()

    # Build name → area_id map for later use
    cur.execute("SELECT area_id, name FROM best_subject_area")
    area_map = {name: aid for aid, name in cur.fetchall()}
    cur.close()
    print(f"    -> {len(areas)} rows inserted.")
    return area_map

# =============================================================
# PHASE 3 — conferences  (iCore26_KilledColumnsForLoading.csv)
# =============================================================

def load_conferences(conn):
    print("[3/6] Loading conferences ...")
    rows = []
    with open(ICORE_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            icore_id  = safe_int(row.get("ID", ""))
            title     = row.get(" Title", row.get("Title", "")).strip()
            acronym   = row.get("Acronym", "").strip() or None
            rank      = row.get("Rank", "").strip() or None
            dblp_val  = row.get("DBLP", "").strip().lower()
            dblp_avail= 1 if dblp_val == "yes" else 0
            for_id    = safe_int(row.get("PrimaryFoR", ""))
            if not title:
                continue
            rows.append((icore_id, title, acronym, rank, dblp_avail, for_id))

    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE conferences")
    batch_insert(cur,
        """INSERT INTO conferences
               (icore_id, title, acronym, `rank`, dblp_available, primary_for_id)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        rows)
    conn.commit()

    # Build acronym → conference_id lookup (uppercase for matching)
    cur.execute("SELECT conference_id, acronym FROM conferences WHERE acronym IS NOT NULL")
    conf_map = {acr.upper(): cid for cid, acr in cur.fetchall()}
    cur.close()
    print(f"    -> {len(rows)} conferences inserted. {len(conf_map)} with acronyms.")
    return conf_map

def match_conference(booktitle_upper, conf_map):
    """
    Try exact match first, then first-word match.
    E.g. 'SIGMOD CONFERENCE' → try 'SIGMOD CONFERENCE', then 'SIGMOD'.
    """
    if booktitle_upper in conf_map:
        return conf_map[booktitle_upper]
    first_word = booktitle_upper.split()[0] if booktitle_upper else ""
    if len(first_word) >= 2 and first_word in conf_map:
        return conf_map[first_word]
    return None

# =============================================================
# PHASE 4 — journals  (journal_ranking_data_raw.csv)
# =============================================================

def load_journals(conn, area_map):
    print("[4/6] Loading journals ...")
    rows = []
    with open(JOURNAL_RANK_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title    = row.get("Title", "").strip()
            if not title:
                continue
            oa       = 1 if str(row.get("OA","")).strip().upper() == "TRUE" else 0
            country  = row.get("Country", "").strip() or None
            sjr_rank = safe_int(row.get("Rank", ""))
            sjr      = safe_float(row.get("SJR-index", ""))
            cite_s   = safe_float(row.get("CiteScore", ""))
            h_idx    = safe_int(row.get("H-index", ""))
            bq       = row.get("Best Quartile", "").strip() or None
            bsa_name = row.get("Best Subject Area", "").strip()
            area_id  = area_map.get(bsa_name)
            tot_docs       = safe_int(row.get("Total Docs.", ""))
            tot_docs_3y    = safe_int(row.get("Total Docs. 3y", ""))
            tot_refs       = safe_int(row.get("Total Refs.", ""))
            tot_cites_3y   = safe_int(row.get("Total Cites 3y", ""))
            citable_3y     = safe_int(row.get("Citable Docs. 3y", ""))
            cites_doc_2y   = safe_float(row.get("Cites/Doc. 2y", ""))
            refs_doc       = safe_float(row.get("Refs./Doc.", ""))
            publisher      = row.get("Publisher", "").strip() or None

            rows.append((sjr_rank, title, oa, country, sjr, cite_s, h_idx, bq,
                         area_id, tot_docs, tot_docs_3y, tot_refs, tot_cites_3y,
                         citable_3y, cites_doc_2y, refs_doc, publisher))

    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE journals")
    batch_insert(cur,
        """INSERT INTO journals
               (sjr_rank, title, oa, country, sjr, cite_score, h_index,
                best_quartile, best_subject_area_id, total_docs, total_docs_3y,
                total_refs, total_cites_3y, citable_docs_3y,
                cites_per_doc_2y, refs_per_doc, publisher)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        rows)
    conn.commit()

    cur.execute("SELECT journal_id, title FROM journals")
    journal_id_map = {title: jid for jid, title in cur.fetchall()}
    cur.close()
    print(f"    -> {len(rows)} journals inserted.")
    return journal_id_map

# =============================================================
# JOURNAL MATCHING  (dblp abbreviated → Kaggle full title)
# =============================================================

def build_journal_matcher(journal_id_map):
    """
    Returns a function: dblp_journal_name -> journal_id or None.

    Strategy (in order):
      1. Exact match (normalized)
      2. difflib close match against all normalized Kaggle titles (cutoff 0.6)
    """
    norm_map = {normalize(title): jid for title, jid in journal_id_map.items()}
    norm_keys = list(norm_map.keys())
    cache = {}

    def match(dblp_name):
        if not dblp_name:
            return None
        if dblp_name in cache:
            return cache[dblp_name]

        norm = normalize(dblp_name)

        # Exact match
        if norm in norm_map:
            cache[dblp_name] = norm_map[norm]
            return norm_map[norm]

        # Fuzzy match
        close = difflib.get_close_matches(norm, norm_keys, n=1, cutoff=0.6)
        result = norm_map[close[0]] if close else None
        cache[dblp_name] = result
        return result

    return match

# =============================================================
# PHASE 5 — conference papers  (input_inproceedings.csv)
# =============================================================

def load_conference_papers(conn, conf_map):
    print("[5/6] Loading conference papers ...")
    cur = conn.cursor()
    cur.execute("DELETE FROM paper_authors WHERE paper_id IN (SELECT paper_id FROM papers WHERE paper_type='conference')")
    cur.execute("DELETE FROM papers WHERE paper_type='conference'")
    conn.commit()

    author_cache = {}

    def get_or_create_author(name):
        if name in author_cache:
            return author_cache[name]
        cur.execute("INSERT IGNORE INTO authors (name) VALUES (%s)", (name,))
        cur.execute("SELECT author_id FROM authors WHERE name = %s", (name,))
        row = cur.fetchone()
        aid = row[0] if row else None
        author_cache[name] = aid
        return aid

    pa_buf       = []
    total_papers = 0
    skipped      = 0

    with open(INPROC_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            title    = row.get("title", "").strip()
            year_raw = row.get("year", "").strip()
            booktitle= row.get("booktitle", "").strip().upper()
            author_s = row.get("author", "").strip()

            if not title or not year_raw or not author_s:
                skipped += 1
                continue
            conf_id = match_conference(booktitle, conf_map)
            if conf_id is None:
                skipped += 1
                continue

            dblp_id  = safe_int(row.get("id", ""))
            dblp_key = row.get("key", "").strip() or None
            pages    = row.get("pages", "").strip() or None
            url      = row.get("url", "").strip() or None
            mdate    = safe_date(row.get("mdate", ""))
            year     = safe_int(year_raw)

            cur.execute(
                """INSERT INTO papers
                       (dblp_id, dblp_key, title, year, pages, url, mdate,
                        paper_type, conference_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,'conference',%s)""",
                (dblp_id, dblp_key, title, year, pages, url, mdate, conf_id))
            paper_id = cur.lastrowid
            total_papers += 1

            for pos, name in enumerate(
                    (a.strip() for a in author_s.split("|") if a.strip()), start=1):
                aid = get_or_create_author(name)
                if aid:
                    pa_buf.append((paper_id, aid, pos))

            if len(pa_buf) >= BATCH_SIZE:
                cur.executemany(
                    "INSERT IGNORE INTO paper_authors VALUES (%s,%s,%s)", pa_buf)
                conn.commit()
                pa_buf.clear()
                if total_papers % 10000 == 0:
                    print(f"    ... {total_papers} papers loaded so far")

    if pa_buf:
        cur.executemany("INSERT IGNORE INTO paper_authors VALUES (%s,%s,%s)", pa_buf)
    conn.commit()
    cur.close()
    print(f"    -> {total_papers} conference papers inserted. {skipped} skipped.")

# =============================================================
# PHASE 6 — journal papers  (input_article.csv)
# =============================================================

def load_journal_papers(conn, journal_matcher):
    print("[6/6] Loading journal papers ...")
    cur = conn.cursor()
    cur.execute("DELETE FROM paper_authors WHERE paper_id IN (SELECT paper_id FROM papers WHERE paper_type='journal')")
    cur.execute("DELETE FROM papers WHERE paper_type='journal'")
    conn.commit()

    author_cache = {}

    def get_or_create_author(name):
        name = name.strip()
        if not name:
            return None
        if name in author_cache:
            return author_cache[name]
        cur.execute("INSERT IGNORE INTO authors (name) VALUES (%s)", (name,))
        cur.execute("SELECT author_id FROM authors WHERE name = %s", (name,))
        row = cur.fetchone()
        aid = row[0] if row else None
        author_cache[name] = aid
        return aid

    pa_buf       = []
    total_papers = 0
    skipped      = 0

    with open(ARTICLE_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            title    = row.get("title", "").strip()
            year_raw = row.get("year", "").strip()
            author_s = row.get("author", "").strip()
            jname    = row.get("journal", "").strip()

            if not title or not year_raw or not author_s:
                skipped += 1
                continue
            journal_id = journal_matcher(jname)
            if journal_id is None:
                skipped += 1
                continue

            dblp_id  = safe_int(row.get("id", ""))
            dblp_key = row.get("key", "").strip() or None
            pages    = row.get("pages", "").strip() or None
            url      = (row.get("url","").strip() or row.get("ee","").strip()) or None
            mdate    = safe_date(row.get("mdate", ""))
            year     = safe_int(year_raw)
            volume   = row.get("volume", "").strip() or None
            number   = row.get("number", "").strip() or None

            cur.execute(
                """INSERT INTO papers
                       (dblp_id, dblp_key, title, year, pages, url, mdate,
                        paper_type, journal_id, volume, number)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,'journal',%s,%s,%s)""",
                (dblp_id, dblp_key, title, year, pages, url, mdate,
                 journal_id, volume, number))
            paper_id = cur.lastrowid

            authors = [a.strip() for a in author_s.split("|") if a.strip()]
            for pos, name in enumerate(authors, start=1):
                aid = get_or_create_author(name)
                if aid:
                    pa_buf.append((paper_id, aid, pos))

            if len(pa_buf) >= BATCH_SIZE:
                cur.executemany(
                    "INSERT IGNORE INTO paper_authors (paper_id, author_id, author_position) VALUES (%s,%s,%s)",
                    pa_buf)
                conn.commit()
                pa_buf.clear()
                total_papers += 1
                if total_papers % 10000 == 0:
                    print(f"    ... {total_papers} papers loaded so far")

    if pa_buf:
        cur.executemany(
            "INSERT IGNORE INTO paper_authors (paper_id, author_id, author_position) VALUES (%s,%s,%s)",
            pa_buf)
        conn.commit()
    cur.close()
    print(f"    -> {total_papers} journal papers inserted. {skipped} skipped.")

# =============================================================
# MAIN
# =============================================================

def main():
    print("=" * 60)
    print("ETL START:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)

    conn = connect()

    # Disable FK checks during bulk load for speed; re-enable after
    cur = conn.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")
    cur.close()

    load_primary_for(conn)
    area_map       = load_subject_areas(conn)
    conf_map       = load_conferences(conn)
    journal_id_map = load_journals(conn, area_map)
    matcher        = build_journal_matcher(journal_id_map)

    load_conference_papers(conn, conf_map)
    load_journal_papers(conn, matcher)

    cur = conn.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    cur.close()

    conn.close()
    print("=" * 60)
    print("ETL DONE:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)

if __name__ == "__main__":
    main()
