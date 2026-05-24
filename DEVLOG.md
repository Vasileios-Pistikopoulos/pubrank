# Dev Log — Προχ. Θέματα Βάσεων 2026

## Stack αποφάσεις (02/05/2026)

**Back-end:** Django + Django REST Framework  
**Front-end:** React (Vite) + react-chartjs-2 (Chart.js)  
**DB:** MySQL (InnoDB)  
**ETL:** Python scripts (pandas / csv)  

**Γιατί Django αντί Rust/Spring:** Tight deadline (26/05). Rust frameworks (Axum, Actix) έχουν μεγάλο boilerplate overhead. Django δίνει ταχύτητα στο back-end.  
**Γιατί React αντί Vue:** Ο χρήστης ξέρει Vue, η λογική components/hooks είναι παρόμοια — καλή ευκαιρία να μάθει React χωρίς μεγάλο ρίσκο.  
**Γιατί Chart.js αντί D3:** D3 είναι overkill για line/bar/scatter. Chart.js είναι plug-and-play.

---

## Φιλοσοφία queries (02/05/2026)

Η εκφώνηση ζητά ρητά: **όλη η επεξεργασία να γίνεται ΜΕΣΑ στο DBMS** (SQL views / direct queries), όχι Python aggregation. Το Django back-end λειτουργεί μόνο σαν "αγωγός": δέχεται request → εκτελεί SQL → επιστρέφει JSON.

---

## Δεδομένα — Δομή αρχείων (13/05/2026)

| Αρχείο | Delimiter | Rows | Κύρια πεδία |
|--------|-----------|------|-------------|
| input_inproceedings.csv | `;` | ~1.4M | id, author (pipe-sep), booktitle, key, pages, title, year |
| input_article.csv | `;` | ~1.1M | id, author (pipe-sep), journal, key, number, pages, title, volume, year |
| iCore26_KilledColumnsForLoading.csv | `,` | ~3k | ID, Title, Acronym, Rank, DBLP, PrimaryFoR |
| journal_ranking_data_raw.csv | `,` | ~21k | Rank, Title, Country, SJR, CiteScore, H-index, BestQuartile, BestSubjectArea, publisher, … |

**Παρατηρήσεις:**
- iCore26 Rank: περιέχει A*, A, B, C αλλά και δεκάδες "National: X", "Regional" κλπ. → αποθηκεύεται ως VARCHAR, όχι ENUM.
- Journal ranking: CSV με comma, αλλά τίτλοι περιέχουν κόμματα (πχ "Lancet, The") → χρειάζεται προσεκτικό parsing με quote handling.
- author field: pipe-separated string πχ "Name1|Name2|Name3" → split στο ETL, N:M σχέση με paper_authors.

---

## Schema design (13/05/2026)

### Απόφαση: ένας πίνακας `papers` ή δύο;
**Επιλογή: ένας ενιαίος `papers` με `paper_type` ENUM('conference','journal').**  
Tradeoff: ορισμένα πεδία (volume, number) είναι NULL για conference papers. Αντισταθμίζεται από την απλούστερη σύνταξη queries για "συνολικά άρθρα ανά χρονιά". Δύο ξεχωριστοί πίνακες θα απαιτούσαν UNION παντού.

### Πίνακας conferences ή όχι;
**Ναι, ξεχωριστός lookup.** Η εκφώνηση λέει ρητά: "άλλο ΆρθροΣεΣυνέδριο και άλλο Συνέδριο". Το conference ranking (iCore26) είναι ξεχωριστή οντότητα από τα papers.

### Primary keys:
Όλα τα PKs είναι INT AUTO_INCREMENT. Τα string IDs των πηγαίων αρχείων (dblp key, iCore ID) κρατούνται ως απλά πεδία για reference, όχι ως PK — η εκφώνηση το απαιτεί ρητά.

---

## DDL scripts (13/05/2026)

Βλ. `sql/01_schema.sql`

---

## ETL script (13/05/2026)

Βλ. `etl/etl.py`

### Δομή ETL (6 φάσεις, σε σειρά εξαρτήσεων):
1. `primary_for` ← icoreCategories.xlsx
2. `best_subject_area` ← bestSubjectArea.csv
3. `conferences` ← iCore26_KilledColumnsForLoading.csv
4. `journals` ← journal_ranking_data_raw.csv
5. `papers` (conference) + `paper_authors` ← input_inproceedings.csv
6. `papers` (journal) + `paper_authors` ← input_article.csv

### Φιλτράρισμα papers:
Φορτώνονται ΜΟΝΟ papers που ανήκουν σε συνέδριο/περιοδικό που υπάρχει στα ranking files. Τα υπόλοιπα (εκτός iCore26/Kaggle) παραλείπονται. Αυτό μειώνει τα 1.4M+1.1M σε διαχειρίσιμο υποσύνολο.

### Conference matching:
`booktitle` (inproceedings) → `Acronym` (iCore26), uppercase exact match. Απλό και αξιόπιστο γιατί τα dblp booktitle values είναι ήδη συντομογραφίες (πχ "EDBT", "ICDE").

### Journal matching:
`journal` (articles) → `Title` (Kaggle). Δύο βήματα:
1. Exact match μετά από normalize (lowercase, χωρίς σημεία στίξης)
2. `difflib.get_close_matches` με cutoff=0.6 — πιάνει περιπτώσεις όπως "IEEE Trans. Knowl. Data Eng." → "IEEE Transactions on Knowledge and Data Engineering"

Cache αποτελεσμάτων για να μην υπολογίζεται το fuzzy match πολλές φορές για το ίδιο journal name.

### Authors:
Split του pipe-separated string per row → INSERT IGNORE στον `authors` πίνακα → paper_authors με position. `author_cache` dict για να αποφύγουμε επαναλαμβανόμενα SELECTs.

### Performance:
`SET FOREIGN_KEY_CHECKS = 0` κατά τη διάρκεια του load για ταχύτητα. Batch inserts ανά 500 rows. Paper authors γράφονται με INSERT IGNORE για idempotency.

---

## SQL Views (13/05/2026)

Βλ. `sql/02_views.sql` — 9 views συνολικά:

| View | Σκοπός |
|------|--------|
| `v_conf_year` | Papers / authors per conference per year |
| `v_conf_summary` | Aggregate stats per conference (πρώτη/τελευταία χρονιά, totals) |
| `v_journal_year` | Papers / authors per journal per year |
| `v_journal_summary` | Aggregate stats per journal |
| `v_author_summary` | Στατιστικά ανά author (total papers, active years, avg) |
| `v_author_year` | Papers per author per year (conf / journal breakdown) |
| `v_year_summary` | Συνολικά papers / conferences / journals / authors ανά χρονιά |
| `v_publisher_stats` | Aggregate stats ανά publisher (για barchart) |
| `v_for_year` / `v_subject_area_year` | Auxiliary για μελλοντική επέκταση |

**Φιλοσοφία:** Όλη η αθροιστική λογική κάθεται μέσα στο DBMS, όχι στο Python. Το Django backend απλώς εκτελεί `SELECT * FROM v_conf_summary WHERE conference_id = %s`.

---

## Django Backend — Raw SQL (13/05/2026)

**Απόφαση: χωρίς DRF, χωρίς ORM.** Η εκφώνηση το ζητά ρητά. Το backend χρησιμοποιεί αποκλειστικά `connection.cursor()` + `JsonResponse`.

Helpers `rows_as_dicts` / `row_as_dict` μετατρέπουν cursor results σε list-of-dicts χωρίς καμία εξάρτηση.

**Security:** Όλα τα SQL fragments που δέχονται user input χρησιμοποιούν parameterized queries (`%s`). Τα ονόματα metric/field στα chart endpoints επικυρώνονται έναντι allowlist πριν γίνουν string interpolation, αποτρέποντας SQL injection.

**CORS:** `django-cors-headers` με `CORS_ALLOW_ALL_ORIGINS = True` για το dev server του React.

---

## Frontend — React + Chart.js (13/05/2026)

**Vite version:** Χρήση `npm create vite@5` (όχι latest) λόγω incompatibility του Node 20.11.1 με Vite 9 (απαιτεί Node >=20.19.0).

**9 σελίδες:**
- ConferencesPage / ConferenceProfile (με year filter + linechart + papers table)
- JournalsPage / JournalProfile (ίδια δομή, επιπλέον SJR/H-index/CiteScore stats)
- AuthorsPage (search by name) / AuthorProfile (linechart conf vs journal papers)
- YearsPage / YearProfile (με filters: conference_id, journal_id, author_id)
- ChartsPage (3 panels: LineChart, BarChart, Scatter)

**Chart.js registration:** Ξεχωριστό `Chart.register(...)` ανά component που χρησιμοποιεί chart (αν το κάνεις globally κάποιες φορές χάνεις scale types).

---

## Bugs & Fixes (13/05/2026)

### Bug: Conference duplicates στο list
iCore26 περιέχει 3 εγγραφές για AAAI (IDs 262, 353, 982) — τα papers είναι συνδεδεμένα στο 982, αλλά το list έδειχνε το 262 (0 papers).

**Fix:** `conference_list` endpoint χρησιμοποιεί `ROW_NUMBER() OVER (PARTITION BY acronym ORDER BY COUNT(papers) DESC)` — δείχνει πάντα την εγγραφή που έχει τα περισσότερα papers.

### Bug: ETL paper counter
`total_papers += 1` ήταν μέσα στο `if len(pa_buf) >= BATCH_SIZE` → μετρούσε buffer flushes (ανά 500 author entries), όχι papers. Ανέφερε "3,472 papers" αντί ~740k.

**Fix:** Το increment μπήκε αμέσως μετά από κάθε `INSERT INTO papers`.

### Bug: ETL relative paths
`open("../input_inproceedings.csv")` απέτυχε όταν ο χρήστης το τρέχει από διαφορετικό working directory (VSCode).

**Fix:** `BASE = os.path.dirname(os.path.abspath(__file__))` + `os.path.join(BASE, "..", "data", "...")`

### Bug: Conference matching rate ~41%
Το exact uppercase booktitle match έπιανε μόνο 3,472 papers από τα 1.4M inproceedings.

**Fix:** Προστέθηκε `match_conference()` με first-word fallback — αν δεν υπάρχει exact match, δοκιμάζει μόνο την πρώτη λέξη του booktitle ("SIGMOD CONFERENCE" → "SIGMOD"). Αποτέλεσμα: 740,130 conference papers.
