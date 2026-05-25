# ΠΑΝΕΠΙΣΤΗΜΙΟ ΙΩΑΝΝΙΝΩΝ — ΤΜΗΜΑ ΜΗΧ. Η/Υ & ΠΛΗΡΟΦΟΡΙΚΗΣ
## Προχωρημένα Θέματα Τεχνολογίας και Εφαρμογών Βάσεων Δεδομένων
### Προγραμματιστική Εργασία 2025–2026

**Φοιτητής:** Βασίλης, ΑΜ: ⚠️ [ΣΥΜΠΛΗΡΩΣΕ ΑΜ]

**Τελική Αναφορά — Μάιος 2026**

---

## Ιστορικό Εκδόσεων

| Ημερομηνία | Έκδοση | Περιγραφή | Συγγραφέας |
|-----------|--------|-----------|-----------|
| 2026/05/13 | 1.0 | Αρχικό schema + ETL | Βασίλης |
| 2026/05/25 | 2.0 | Frontend, charts, materialized tables, τελική έκδοση | Βασίλης |

---

## 1. Βάση Δεδομένων

### 1.1 Σχεσιακό Σχήμα — Λογικό Επίπεδο

#### Σχεδιαστικές Αποφάσεις & Trade-offs

**Ένας ή δύο πίνακες για άρθρα;**
Επιλέχθηκε **ένας ενιαίος πίνακας `papers`** με πεδίο `paper_type ENUM('conference','journal')`.
- *Υπέρ:* Απλούστερες cross-type queries (σύνολο papers/χρονιά, per-author stats). Δεν χρειάζεται UNION παντού.
- *Κατά:* Τα πεδία `volume`, `number` είναι NULL για conference papers. Αποδεκτό tradeoff.

**Lookup tables vs ενσωμάτωση:**
- `conferences` και `journals` είναι ξεχωριστές οντότητες ranking (iCore26 / Kaggle) — δεν ενσωματώθηκαν στον `papers`.
- `primary_for` και `best_subject_area` ως lookup tables (αποφυγή duplication).
- `authors` ως lookup table — η N:M σχέση με papers μέσω `paper_authors` (με `author_position` για διατήρηση της σειράς).

**Primary Keys:**
Όλα τα PKs είναι `INT AUTO_INCREMENT`. Τα string IDs των πηγών (dblp_key, icore_id) κρατούνται ως απλά πεδία reference — όχι ως PKs, όπως ζητά η εκφώνηση.

**Conference rank ως VARCHAR:**
Το iCore26 περιέχει τιμές A\*, A, B, C αλλά και "National: AU", "Regional", "Unranked" κλπ. Δεν μπορεί να χρησιμοποιηθεί ENUM → VARCHAR(100).

#### Διάγραμμα

⚠️ **[ΧΡΕΙΑΖΕΤΑΙ: Screenshot από MySQL Workbench — EER Diagram της βάσης. Εναλλακτικά ένα απλό σχεσιακό διάγραμμα με βελάκια FK.]**

#### Σχεσιακό Σχήμα (λογικό)

```
primary_for (for_id PK, description)

best_subject_area (area_id PK, name)

authors (author_id PK, name)

conferences (conference_id PK, icore_id, title, acronym, rank,
             dblp_available, primary_for_id FK→primary_for)

journals (journal_id PK, sjr_rank, title, oa, country, sjr, cite_score,
          h_index, best_quartile, best_subject_area_id FK→best_subject_area,
          total_docs, total_docs_3y, total_refs, total_cites_3y,
          citable_docs_3y, cites_per_doc_2y, refs_per_doc, publisher)

papers (paper_id PK, dblp_id, dblp_key, title, year, pages, url, mdate,
        paper_type ENUM('conference','journal'),
        conference_id FK→conferences,
        journal_id FK→journals,
        volume, number)

paper_authors (paper_id FK→papers, author_id FK→authors,
               author_position — PK: (paper_id, author_id))
```

#### DDL Script (`sql/01_schema.sql`)

```sql
CREATE TABLE primary_for (
    for_id      INT          NOT NULL,
    description VARCHAR(255) NOT NULL,
    PRIMARY KEY (for_id)
) ENGINE=InnoDB;

CREATE TABLE best_subject_area (
    area_id INT          NOT NULL AUTO_INCREMENT,
    name    VARCHAR(255) NOT NULL,
    PRIMARY KEY (area_id),
    UNIQUE KEY uq_area_name (name(255))
) ENGINE=InnoDB;

CREATE TABLE authors (
    author_id INT          NOT NULL AUTO_INCREMENT,
    name      VARCHAR(512) NOT NULL,
    PRIMARY KEY (author_id),
    UNIQUE KEY uq_author_name (name(512))
) ENGINE=InnoDB;

CREATE TABLE conferences (
    conference_id  INT          NOT NULL AUTO_INCREMENT,
    icore_id       INT          NULL,
    title          VARCHAR(512) NOT NULL,
    acronym        VARCHAR(100) NULL,
    `rank`         VARCHAR(100) NULL,
    dblp_available TINYINT(1)   NOT NULL DEFAULT 0,
    primary_for_id INT          NULL,
    PRIMARY KEY (conference_id),
    KEY idx_conf_acronym (acronym),
    CONSTRAINT fk_conf_for FOREIGN KEY (primary_for_id)
        REFERENCES primary_for(for_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE journals (
    journal_id           INT           NOT NULL AUTO_INCREMENT,
    sjr_rank             INT           NULL,
    title                VARCHAR(512)  NOT NULL,
    oa                   TINYINT(1)    NOT NULL DEFAULT 0,
    country              VARCHAR(100)  NULL,
    sjr                  DECIMAL(10,3) NULL,
    cite_score           DECIMAL(10,2) NULL,
    h_index              INT           NULL,
    best_quartile        CHAR(2)       NULL,
    best_subject_area_id INT           NULL,
    total_docs           INT           NULL,
    total_docs_3y        INT           NULL,
    total_refs           INT           NULL,
    total_cites_3y       INT           NULL,
    citable_docs_3y      INT           NULL,
    cites_per_doc_2y     DECIMAL(10,3) NULL,
    refs_per_doc         DECIMAL(10,3) NULL,
    publisher            VARCHAR(255)  NULL,
    PRIMARY KEY (journal_id),
    CONSTRAINT fk_journal_area FOREIGN KEY (best_subject_area_id)
        REFERENCES best_subject_area(area_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE papers (
    paper_id      INT           NOT NULL AUTO_INCREMENT,
    dblp_id       INT           NULL,
    dblp_key      VARCHAR(255)  NULL,
    title         VARCHAR(1024) NOT NULL,
    year          SMALLINT      NULL,
    pages         VARCHAR(50)   NULL,
    url           VARCHAR(512)  NULL,
    mdate         DATE          NULL,
    paper_type    ENUM('conference','journal') NOT NULL,
    conference_id INT           NULL,
    journal_id    INT           NULL,
    volume        VARCHAR(20)   NULL,
    number        VARCHAR(20)   NULL,
    PRIMARY KEY (paper_id),
    KEY idx_paper_year       (year),
    KEY idx_paper_conference (conference_id),
    KEY idx_paper_journal    (journal_id),
    KEY idx_paper_type       (paper_type),
    CONSTRAINT fk_paper_conf    FOREIGN KEY (conference_id)
        REFERENCES conferences(conference_id) ON DELETE SET NULL,
    CONSTRAINT fk_paper_journal FOREIGN KEY (journal_id)
        REFERENCES journals(journal_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE paper_authors (
    paper_id        INT NOT NULL,
    author_id       INT NOT NULL,
    author_position INT NOT NULL,
    PRIMARY KEY (paper_id, author_id),
    KEY idx_pa_author (author_id),
    CONSTRAINT fk_pa_paper  FOREIGN KEY (paper_id)  REFERENCES papers(paper_id)  ON DELETE CASCADE,
    CONSTRAINT fk_pa_author FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

### 1.2 Σχεσιακό Σχήμα — Φυσικό Επίπεδο

#### Storage Engine & Charset
- **Engine:** InnoDB για όλους τους πίνακες (ACID transactions, FK enforcement, row-level locking)
- **Charset:** `utf8mb4` / `utf8mb4_unicode_ci` — υποστηρίζει πλήρες Unicode (4-byte characters, emoji κλπ)

#### Indexes

| Πίνακας | Index | Πεδίο | Σκοπός |
|---------|-------|-------|--------|
| `papers` | `idx_paper_year` | `year` | Year profile queries (WHERE year=X) |
| `papers` | `idx_paper_conference` | `conference_id` | Conference paper lookup |
| `papers` | `idx_paper_journal` | `journal_id` | Journal paper lookup |
| `papers` | `idx_paper_type` | `paper_type` | Filtering conference vs journal papers |
| `paper_authors` | PK | `(paper_id, author_id)` | Join papers↔authors |
| `paper_authors` | `idx_pa_author` | `author_id` | Author profile queries |
| `conferences` | `idx_conf_acronym` | `acronym` | Conference matching during ETL |

#### SQL Views (`sql/02_views.sql`)

Ορίστηκαν 9 views που encapsulate όλη την αθροιστική λογική μέσα στο DBMS:

| View | Σκοπός |
|------|--------|
| `v_conf_year` | Papers/authors ανά συνέδριο ανά χρονιά (για linechart) |
| `v_conf_summary` | Aggregate stats ανά συνέδριο (για profile header) |
| `v_journal_year` | Papers/authors ανά περιοδικό ανά χρονιά |
| `v_journal_summary` | Aggregate stats ανά περιοδικό |
| `v_author_summary` | Στατιστικά ανά συγγραφέα |
| `v_author_year` | Papers ανά συγγραφέα ανά χρονιά (conf/journal breakdown) |
| `v_year_summary` | Σύνολα ανά χρονιά (→ `year_stats`) |
| `v_publisher_stats` | Journals ανά publisher/quartile (για barchart) |
| `v_for_year` / `v_subject_area_year` | Venues ανά κατηγορία ανά χρονιά |

#### Materialized Tables (Precomputed για Performance)

Τα logical views επαναυπολογίζουν JOINs σε κάθε query. Για τον `paper_authors` με 5M+ rows αυτό ήταν απαγορευτικά αργό (> 40s). Λύση: **precomputed physical tables** που αντικαθιστούν τα views ως pass-through `SELECT * FROM <table>`:

| Πίνακας | Rows | Αντικαθιστά | Query time |
|---------|------|-------------|-----------|
| `year_stats` | 64 | `v_year_summary` | < 1ms |
| `conf_year_stats` | 7,983 | `v_conf_year` | < 1ms |
| `conf_summary_stats` | 710 | inline JOIN στο conference_profile | < 1ms |
| `journal_year_stats` | 14,102 | `v_journal_year` | < 1ms |
| `journal_summary_stats` | 959 | inline JOIN στο journal_profile | < 1ms |
| `for_year_stats` | 406 | `v_for_year` | < 1ms |
| `subject_area_year_stats` | 986 | `v_subject_area_year` | < 1ms |
| `year_paper_list` | 27,406 | live subquery στο year_profile | < 1ms |

Το computation γίνεται μία φορά με `INSERT INTO ... SELECT` (εντός DBMS). Τα views επαναορίστηκαν ως `SELECT * FROM <table>` — το backend δεν αλλάζει interface.

#### Ρύθμιση Ασφάλειας

⚠️ **[ΧΡΕΙΑΖΕΤΑΙ: Αν έχεις ορίσει ξεχωριστό MySQL user (πχ `academic_user`) αντί root, κατέγραψέ το εδώ με τα GRANT statements. Αν όχι, γράψε ότι η εφαρμογή τρέχει με τον root user σε development περιβάλλον και αναφέρσου ότι σε παραγωγή θα χρησιμοποιούνταν restricted user με SELECT-only δικαιώματα.]**

Σε development: η εφαρμογή συνδέεται με τον `root` user (credentials μέσω `.env` αρχείου, εκτός git). Σε παραγωγικό περιβάλλον θα οριζόταν user με δικαιώματα μόνο `SELECT` στη `academic_db`.

---

## 2. Αρχιτεκτονική Λογισμικού

### 2.1 Αρχιτεκτονική ETL

#### Πηγαία Δεδομένα

| Αρχείο | Rows | Πεδία-κλειδιά |
|--------|------|---------------|
| `input_inproceedings.csv` (DBLP) | ~1.4M | id, authors (pipe-sep), booktitle, key, pages, title, year, url |
| `input_article.csv` (DBLP) | ~1.1M | id, authors (pipe-sep), journal, key, number, pages, title, volume, year |
| `iCore26_KilledColumnsForLoading.csv` | ~3K | ID, Title, Acronym, Rank, PrimaryFoR |
| `journal_ranking_data_raw.csv` (Kaggle) | ~21K | Rank, Title, Country, SJR, CiteScore, H-index, BestQuartile, … |
| `icoreCategories.xlsx` | ~40 | FoR codes + descriptions |
| `bestSubjectArea.csv` | ~300 | Subject area names |

#### Φάσεις ETL (`etl/etl.py`)

```
Φάση 1: Φόρτωση primary_for ← icoreCategories.xlsx
Φάση 2: Φόρτωση best_subject_area ← bestSubjectArea.csv
Φάση 3: Φόρτωση conferences ← iCore26_KilledColumnsForLoading.csv
Φάση 4: Φόρτωση journals ← journal_ranking_data_raw.csv
         (fuzzy matching τίτλων με difflib για non-exact matches)
Φάση 5: Φόρτωση papers (conference) + paper_authors ← input_inproceedings.csv
         (matching: booktitle → acronym, με first-word fallback)
Φάση 6: Φόρτωση papers (journal) + paper_authors ← input_article.csv
         (matching: normalize + fuzzy match με cutoff=0.6)
```

#### Σημαντικά σημεία μετασχηματισμού

**Συγγραφείς:** Το pipe-separated string "Name1|Name2|Name3" γίνεται split ανά άρθρο. Κάθε συγγραφέας φορτώνεται με `INSERT IGNORE` στον `authors` (αποφυγή duplicates). Η σχέση paper↔author αποθηκεύεται στον `paper_authors` με `author_position` (1-based).

**Conference matching:** `booktitle` (DBLP) → `acronym` (iCore26), uppercase exact match. Αν αποτύχει: first-word fallback ("SIGMOD CONFERENCE" → "SIGMOD"). Αποτέλεσμα: 740K+ conference papers matched.

**Journal matching:** Δύο στάδια:
1. Exact match μετά από normalize (lowercase, αφαίρεση σημείων στίξης)
2. `difflib.get_close_matches(cutoff=0.6)` για fuzzy matching ("IEEE Trans. Knowl. Data Eng." → "IEEE Transactions on Knowledge and Data Engineering")

**Φιλτράρισμα:** Φορτώνονται ΜΟΝΟ papers που match με κάποιο conference/journal στα ranking files. Papers σε άγνωστα venues παραλείπονται.

**Performance:** `SET FOREIGN_KEY_CHECKS=0` κατά τη φόρτωση. Batch inserts ανά 500 rows. Cache για αποτελέσματα fuzzy matching.

⚠️ **[ΧΡΕΙΑΖΕΤΑΙ: UML component diagram ή BPMN flow diagram που δείχνει τις 6 φάσεις ETL με βέλη. Μπορεί να γίνει και ως απλό box diagram στο Word/draw.io.]**

---

### 2.2 Αρχιτεκτονική Εφαρμογής

#### High-level αρχιτεκτονική (3-tier)

```
[Browser / React SPA]
        ↕ HTTP/JSON (axios)
[Django Backend — pure conduit]
        ↕ MySQL protocol
[MySQL 8 InnoDB — all business logic]
```

**Φιλοσοφία:** Το Django backend λειτουργεί αποκλειστικά ως αγωγός. Κάθε endpoint εκτελεί SQL και επιστρέφει `JsonResponse`. Δεν γίνεται καμία aggregation στην Python — όλη η επεξεργασία γίνεται εντός του DBMS.

#### Backend — Modules

| Module | Αρχείο | Περιεχόμενο |
|--------|--------|-------------|
| URL routing | `backend/urls.py` | 12 endpoints |
| Views / API | `api/views.py` | Όλα τα SQL queries |
| Settings | `backend/settings.py` | DB config μέσω `.env` |

#### Frontend — Σελίδες

| Σελίδα | Component | Λειτουργικότητα |
|--------|-----------|-----------------|
| Conferences | `ConferencesPage` | Λίστα + search |
| Conference Profile | `ConferenceProfile` | Stats + linechart + papers (year filter) |
| Journals | `JournalsPage` | Λίστα + search + "Only with papers" filter |
| Journal Profile | `JournalProfile` | Stats + linechart + papers (year filter) |
| Authors | `AuthorsPage` | Search by name |
| Author Profile | `AuthorProfile` | Stats + linechart (conf/journal breakdown) |
| Years | `YearsPage` | Λίστα όλων των χρονιών |
| Year Profile | `YearProfile` | Stats + papers (φίλτρα: conf/journal/author) |
| Charts | `ChartsPage` | 5 panels: LineChart, CategoryLine, BarChart, Scatter×2 |

#### Component diagram

⚠️ **[ΧΡΕΙΑΖΕΤΑΙ: Deployment/component diagram. Μπορείς να χρησιμοποιήσεις draw.io και να φτιάξεις 3 κουτιά (Browser, Django, MySQL) με τα βέλη και τα κύρια modules σε κάθε layer.]**

---

### 2.3 API Endpoints & Κύρια Ερωτήματα

#### Endpoints

| Method | URL | Περιγραφή |
|--------|-----|-----------|
| GET | `/api/conferences/` | Λίστα συνεδρίων (deduplicated by acronym) |
| GET | `/api/conferences/<id>/profile/` | Profile + per-year stats (opt: year_from/to) |
| GET | `/api/conferences/<id>/papers/` | Papers (opt: year_from/to) |
| GET | `/api/journals/` | Λίστα περιοδικών (opt: has_papers=1) |
| GET | `/api/journals/<id>/profile/` | Profile + per-year stats |
| GET | `/api/journals/<id>/papers/` | Papers |
| GET | `/api/authors/?q=` | Author search |
| GET | `/api/authors/<id>/profile/` | Author stats + per-year breakdown |
| GET | `/api/years/` | Λίστα χρονιών από year_stats |
| GET | `/api/years/<year>/profile/` | Year profile + papers (opt: conf/journal/author filter) |
| GET | `/api/charts/linechart/` | Venues over time |
| GET | `/api/charts/category-linechart/` | FoR/SubjectArea over time |
| GET | `/api/charts/barchart/` | Top venues / publishers |
| GET | `/api/charts/scatter/` | Journal metrics scatter |
| GET | `/api/charts/scatter/venue-year/` | Avg authors vs paper count |

#### Αντιπροσωπευτικό SQL — Conference Profile (unfiltered)

```sql
-- Stats (από materialized table — < 1ms)
SELECT first_year, last_year, total_papers, total_distinct_authors,
       avg_authors_per_paper, avg_papers_per_year, avg_authors_per_year
FROM conf_summary_stats WHERE conference_id = %s;

-- Per-year για linechart
SELECT year, paper_count, total_author_appearances, distinct_authors
FROM v_conf_year WHERE conference_id = %s ORDER BY year;
```

#### Αντιπροσωπευτικό SQL — Year Profile (unfiltered, από precomputed table)

```sql
SELECT * FROM year_stats WHERE year = %s;

SELECT paper_id, title, year, paper_type, pages, url, venue, authors
FROM year_paper_list WHERE year = %s
ORDER BY paper_type, venue, title;
```

#### Αντιπροσωπευτικό SQL — Year Profile (με φίλτρο, live subquery)

```sql
SELECT sub.paper_id, sub.title, ...,
       GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
FROM (
    SELECT p.paper_id, p.title, p.year, p.paper_type, p.pages,
           CASE WHEN p.url LIKE 'http%' THEN p.url
                WHEN p.url IS NOT NULL  THEN CONCAT('https://dblp.org/', p.url)
           END AS url,
           COALESCE(c.acronym, j.title) AS venue
    FROM papers p
    LEFT JOIN conferences c ON p.conference_id = c.conference_id
    LEFT JOIN journals j    ON p.journal_id    = j.journal_id
    WHERE p.year = %s AND p.conference_id = %s   -- φίλτρο
    LIMIT 500
) sub
JOIN paper_authors pa ON sub.paper_id = pa.paper_id
JOIN authors a        ON pa.author_id  = a.author_id
GROUP BY sub.paper_id, ...
ORDER BY sub.paper_type, sub.venue, sub.title;
```

#### Αντιπροσωπευτικό SQL — Comparative LineChart (UNION ALL)

```sql
SELECT c.acronym AS label, v.year, v.paper_count AS value
FROM v_conf_year v JOIN conferences c ON v.conference_id = c.conference_id
WHERE v.conference_id IN (%s, %s) AND v.year BETWEEN %s AND %s
UNION ALL
SELECT j.title AS label, v.year, v.paper_count AS value
FROM v_journal_year v JOIN journals j ON v.journal_id = j.journal_id
WHERE v.journal_id IN (%s) AND v.year BETWEEN %s AND %s
ORDER BY label, year;
```

---

## 3. Υποδείγματα Ερωτήσεων & Αποτελεσμάτων

⚠️ **[ΧΡΕΙΑΖΕΤΑΙ: Screenshots από την εφαρμογή. Προτεινόμενη σειρά για το video/report:]**

1. **Conference Profile** — πχ ICDE: stat boxes + linechart + papers table
2. **Conference Profile με year filter** — πχ 2000–2010: ενημερωμένα stats + γράφημα
3. **Journal Profile** — πχ IEEE TKDE: stats με SJR/H-index + linechart
4. **Author Profile** — search "Jeffery" → κλικ → stats + linechart
5. **Year Profile 2005** — stats (91,782 papers, 417 conf, 630 journals, 145,915 distinct authors) + papers table
6. **Year Profile με φίλτρο** — πχ 2005 + journal IEEE TKDE → 143 papers
7. **LineChart** — conf_ids=986 (SERA), paper_count, 2003–2013
8. **BarChart** — Top conferences by total_papers
9. **BarChart Publishers** — Quartile series Q1-Q4
10. **Scatter** — SJR vs CiteScore (2000 journals)
11. **Scatter Venue/Year** — avg_authors vs paper_count

---

## 4. Λοιπά Σχόλια

### DBMS-first φιλοσοφία

Η εκφώνηση ζητά ρητά όλη η επεξεργασία να γίνεται εντός DBMS. Τηρήθηκε πλήρως:
- Κανένα aggregation σε Python — ούτε `sum()`, ούτε `groupby`, ούτε loops επί αποτελεσμάτων
- Βρέθηκαν και διορθώθηκαν 3 violations (βλ. DEVLOG): `year_list` Python merge, `chart_linechart` Python loop, frontend JS `.filter()`
- Gray area αποδεκτή: Chart.js data pivoting (`byLabel`/`datasets`) — format conversion για τη βιβλιοθήκη, όχι business logic

### Αποφάσεις Security

Parameterized queries (`%s`) παντού. Dynamic field names στα chart endpoints επικυρώνονται έναντι allowlist πριν τη string interpolation:

```python
allowed_metrics = {'paper_count', 'distinct_authors', 'total_author_appearances', 'avg_authors_per_paper'}
if metric not in allowed_metrics:
    return JsonResponse({'error': 'invalid metric'}, status=400)
```

### Γνωστοί Περιορισμοί

- Το linechart στα Charts ζητά manual εισαγωγή conference/journal IDs (δεν υπάρχει search widget εκεί)
- Το infinite scroll εμφανίζει μέγιστο 500 papers στο Year Profile — επαρκές για demo, αλλά δεν αποδίδει όλα τα 91K papers του 2005
- Δεν υπάρχει authentication/session management — development-only setup
