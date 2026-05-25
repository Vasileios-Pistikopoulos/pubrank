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

---

## Pagination → Infinite scroll (25/05/2026)

Αρχικά προστέθηκε button-based pagination (PAGE_SIZE=50, smart ellipsis, CSS classes `.pg-btn` κλπ). Αντικαταστάθηκε αμέσως μετά με infinite scroll (βλ. παρακάτω) — οι CSS κλάσεις αφαιρέθηκαν, το component ξαναγράφτηκε εξ ολοκλήρου.

---

## Journals — "Only with papers" filter (25/05/2026)

Η JournalsPage εμφάνιζε ~18k journals (SJR dataset) αλλά η πλειοψηφία δεν έχει papers στη DBLP (π.χ. περιοδικά οικονομίας, ιατρικής κλπ — DBLP καλύπτει μόνο CS).

**Fix:** Checkbox "Only journals with papers" → backend query με `WHERE EXISTS (SELECT 1 FROM papers p WHERE p.journal_id = j.journal_id)`. Το filtering γίνεται εξολοκλήρου στο DBMS.

---

## DBMS compliance audit (25/05/2026)

Πλήρης έλεγχος για Python aggregation που παραβιάζει τη φιλοσοφία "all processing inside DBMS".

**Clear violations που διορθώθηκαν:**

1. **`year_list()`** — 2 queries merged με Python `for` loop → ενιαίο SQL με `LEFT JOIN paper_authors`
2. **`chart_linechart()`** — loop per conference/journal ID + Python `+=` → ένα `UNION ALL` query με `WHERE conference_id IN (...)`
3. **`CategoryLineChartPanel` (frontend)** — JS `.filter()` στα category results → backend `WHERE for_description LIKE %s` query param

**Gray areas (αφέθηκαν):**
- Chart.js data pivoting (`byLabel`, `labels`, `datasets`): format conversion για το chart library, όχι business aggregation — το SQL κάνει ήδη το GROUP BY
- Client-side search/pagination: UI presentation pattern, τα δεδομένα ήδη στη μνήμη

---

## Materialized summary tables (25/05/2026)

Τα SQL Views είναι "logical" — επαναπροϋπολογίζουν τα JOINs σε κάθε query. Για μεγάλα datasets (5M+ paper_authors rows) αυτό είναι απαγορευτικά αργό.

**Λύση:** Precomputed physical tables — το computation γίνεται μία φορά με `INSERT INTO ... SELECT` (εντός DBMS), και οι views επαναορίστηκαν ως `SELECT * FROM <table>`.

**Νέα αρχεία SQL:**
- `sql/03_year_stats.sql` — year_stats table (64 rows, 0.3ms query)
- `sql/04_materialized.sql` — 6 tables + view redefinitions

| Πίνακας | Rows | Αντικαθιστά |
|---------|------|-------------|
| `year_stats` | 64 | `v_year_summary` + inline JOIN |
| `conf_year_stats` | 7,983 | `v_conf_year` |
| `conf_summary_stats` | 710 | inline JOIN query στο conference_profile |
| `journal_year_stats` | 14,102 | `v_journal_year` |
| `journal_summary_stats` | 959 | inline JOIN query στο journal_profile |
| `for_year_stats` | 406 | `v_for_year` |
| `subject_area_year_stats` | 986 | `v_subject_area_year` |

**Αποτέλεσμα:** Query times < 3ms σε όλα. Views παραμένουν ως interface — το `views.py` δεν χρειάστηκε σχεδόν καμία αλλαγή.

**Σημείωση:** Profile stats (unfiltered) → `SELECT FROM conf/journal_summary_stats`. Filtered (year_from/year_to) → εξακολουθεί να κάνει dynamic JOIN γιατί `COUNT(DISTINCT author_id)` δεν μπορεί να αθροιστεί από per-year counts (set union problem).

**year_list συγκεκριμένα:** Πριν τα materialized tables, το `GET /api/years/` έπαιρνε ~41s — έτρεχε 2 queries και τα merge-αρε σε Python loop (DBMS violation + αργό). Fix: `SELECT * FROM year_stats` σε 0.3ms.

**Operational note — MySQL + Greek path:** Τα SQL scripts δεν μπορούσαν να τρέξουν με `SOURCE` λόγω ελληνικών χαρακτήρων στο path. Workaround: `$sql = Get-Content "...sql" -Raw; $sql | & mysql.exe -u root -proot academic_db`.

---

## Infinite scroll (25/05/2026)

Αντικατάσταση pagination με infinite scroll σε όλες τις σελίδες (ConferencesPage, JournalsPage, ConferenceProfile, JournalProfile, YearProfile).

**Νέο `Pagination.jsx`:** `useInfiniteScroll(items)` hook με `IntersectionObserver` (callback ref pattern — χρήση `useCallback` γιατί το sentinel div mountάρει μετά τη φόρτωση δεδομένων) + `<ScrollSentinel>` component. Batch size: 50 rows, rootMargin: 300px για early load.

---

## Bug fix: paper URLs (25/05/2026)

Τα DBLP URLs ήταν αποθηκευμένα ως relative paths (πχ `db/conf/acii/acii2013.html#PeerBJ13`) αντί για full URLs.

**Fix:** Στα 3 paper queries (conference_papers, journal_papers, year_profile) προστέθηκε SQL expression:
```sql
CASE WHEN p.url LIKE 'http%' THEN p.url
     WHEN p.url IS NOT NULL   THEN CONCAT('https://dblp.org/', p.url)
END AS url
```
Τα links πλέον ανοίγουν το αντίστοιχο DBLP entry.

---

## Bug fix: `%%` escaping + infinite spinner (25/05/2026)

Προσθέτοντας `LIKE 'http%'` μέσα σε `cursor.execute()`, το Django ερμήνευσε το `%` ως Python format specifier → `ValueError: unsupported format character`. Το σφάλμα ήταν στο `conference_papers` endpoint.

**Επίδραση:** Τα ConferenceProfile / JournalProfile χρησιμοποιούν `Promise.all([getConferenceProfile, getConferencePapers])`. Επειδή το `getConferencePapers` επέστρεφε 500 error, το `Promise.all` reject-αρε → `setLoading(false)` ποτέ δεν καλέστηκε → άπειρο spinner σε κάθε profile.

**Fix:** `LIKE 'http%%'` (διπλό `%%` στο Django raw SQL για literal `%`). Εφαρμόστηκε και στα 3 paper endpoints (`conference_papers`, `journal_papers`, `year_profile`) με `replace_all=true`.

---

## Precomputed year_paper_list + year profile optimization (25/05/2026)

**Πρόβλημα:** Το year_profile endpoint για χρονιές με πολλά papers (πχ 2005: 258k papers) ήταν αργό (~2s σε κάθε νέα χρονιά) λόγω random disk I/O στον papers πίνακα (1.5M rows).

**Λύση (DBMS-only):** Νέος precomputed πίνακας `year_paper_list` — αποθηκεύει 500 αντιπροσωπευτικά papers ανά χρονιά με ήδη resolved venue και GROUP_CONCAT'd authors.

**Αρχείο:** `sql/05_year_paper_list.sql` — MySQL stored procedure που κάνει loop ανά χρονιά, εκτελεί `INSERT INTO ... SELECT ... LIMIT 500` για κάθε έτος, τρέχει σε ~2s συνολικά (27,406 rows, 64 χρονιές).

| Χρόνος | Πριν | Μετά |
|--------|------|------|
| Cold (πρώτη επίσκεψη) | ~2s/χρονιά | ~2s άπαξ (φόρτωση ολόκληρου πίνακα) |
| Warm (επανεπίσκεψη) | ~65ms | ~55ms |
| Μετά 1η επίσκεψη | κάθε χρονιά ξεχωριστά | **όλες οι χρονιές fast** |

**Backend logic (`year_profile`):**
- Αν **δεν υπάρχουν filters** → `SELECT * FROM year_paper_list WHERE year = %s` (1ms)
- Αν **υπάρχουν filters** (conference/journal/author) → live subquery με `LIMIT 500`

---

## "Only conferences with papers" filter (26/05/2026)

Ίδια λογική με το αντίστοιχο φίλτρο για journals — `WHERE EXISTS (SELECT 1 FROM papers p WHERE p.conference_id = c.conference_id)` στο DBMS. Checkbox στη ConferencesPage, το φίλτρο περνά ως `has_papers=1` query param.

---

## Bug fix: `avg_authors_per_paper` πάντα = 1 (26/05/2026)

Στα `conf_year_stats` / `journal_year_stats` (και τα αντίστοιχα views) ο υπολογισμός ήταν:
```sql
COUNT(p.paper_id) / COUNT(pa.author_id)
```
Σε ένα JOIN `papers ⋈ paper_authors`, το `COUNT(p.paper_id)` μετρά γραμμές (= ένας author ανά γραμμή), άρα ισούται πάντα με `COUNT(pa.author_id)` → ratio = 1.

**Fix:**
```sql
ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2) AS avg_authors_per_paper
```
Εφαρμόστηκε σε `sql/02_views.sql` (views) και `sql/04_materialized.sql` (INSERT statements). Ο πίνακας ξαναφορτώθηκε με TRUNCATE + re-INSERT.

---

## Navbar "pubrank" link (26/05/2026)

Το `<NavLink>` στο `App.jsx` άλλαξε από `Academic DB` σε `pubrank` (το όνομα του git repo) και λειτουργεί ως link στην αρχική σελίδα (`/`).

---

## EmptyState component (26/05/2026)

Νέο `frontend/src/components/EmptyState.jsx` — εμφανίζει ένα διακοσμητικό SVG-less circle με slash και μήνυμα όταν δεν υπάρχουν αποτελέσματα. Χρησιμοποιείται σε:

| Σελίδα / Panel | Trigger |
|----------------|---------|
| ConferenceProfile | `per_year.length === 0` (chart), `papers.length === 0` (table) |
| JournalProfile | ίδιο |
| ChartsPage — LineChartPanel | `chartData.labels.length === 0` |
| ChartsPage — CategoryLineChartPanel | ίδιο |
| ChartsPage — BarChartPanel | ίδιο |
| ChartsPage — ScatterPanel | `chartData.datasets[0].data.length === 0` |
| ChartsPage — ScatterVenueYearPanel | ίδιο |

---

## Autocomplete suggestions σε όλα τα searchbars (26/05/2026)

Αρχή: οι προτάσεις δεν φιλτράρονται ποτέ σε JS — πάντα `LIKE %s LIMIT N` query στο DBMS.

| Searchbar | Endpoint | Debounce | Limit |
|-----------|----------|----------|-------|
| AuthorsPage | `GET /api/authors/?q=` | 300ms | 50 (SQL) |
| ConferencesPage | `GET /api/conferences/?q=` | 250ms | 20 (SQL) |
| JournalsPage | `GET /api/journals/?q=` | 250ms | 20 (SQL) |
| ChartsPage — MultiVenueSelect (conf) | `GET /api/conferences/?q=` | 300ms | 20 (SQL), cap 10 UI |
| ChartsPage — MultiVenueSelect (jour) | `GET /api/journals/?q=` | 300ms | 20 (SQL), cap 10 UI |
| ChartsPage — CategoryLineChartPanel | `GET /api/categories/?type=&q=` | 200ms | 20 (SQL), cap 10 UI |
| YearProfile — ConferenceSearch | `GET /api/conferences/` (all, client filter) | — | 30 (JS slice από preloaded list) |
| YearProfile — JournalSearch | `GET /api/journals/` (all, client filter) | — | 30 (JS slice από preloaded list) |
| YearProfile — AuthorSearch | `GET /api/authors/?q=` | 300ms | 50 (SQL) |

**Σημείωση για YearProfile:** Τα Conference/Journal dropdowns φορτώνουν ολόκληρη τη λίστα (`getConferences()`/`getJournals()`) στο mount και κάνουν client-side substring filter. Αυτό είναι αποδεκτό γκρι περιοχή: τα ίδια τα δεδομένα (η λίστα venues) παράγονται από SQL· η client-side αναζήτηση αφορά **presentation** της ήδη φορτωμένης λίστας. Θα μπορούσε να αντικατασταθεί με debounced backend LIKE (όπως στα άλλα searchbars) αν η λίστα γινόταν πολύ μεγάλη.

**Νέο endpoint `GET /api/categories/`:**
```python
# ?type=for&q=intel  →  WHERE description LIKE '%intel%' LIMIT 20
# ?type=subject_area  →  WHERE name LIKE '%...%' LIMIT 20
```
Χρησιμοποιείται από το CategoryLineChartPanel για αυτόματη συμπλήρωση FoR / Subject Area χωρίς να φορτώνει ολόκληρη τη λίστα.

**MultiVenueSelect component (ChartsPage):** Reusable component — δέχεται `fetchFn` (async), `getLabel`, `getId`, εμφανίζει chips για τα επιλεγμένα venues, εκπέμπει comma-separated IDs μέσω `onChange`. Αντικατέστησε τα plain text inputs για `conf_ids`/`jour_ids` στο LineChartPanel.

---

## YearsPage + YearProfile restructuring (26/05/2026)

**Πριν:** YearsPage είχε embedded bar chart που εμφανιζόταν κάνοντας κλικ στο κουτί μιας γραμμής, αλλά το `<Link>` στη χρονολογία δεν το ενεργοποιούσε (navigation conflict).

**Μετά:** 
- YearsPage: αποκλειστικά navigation — κλικ σε οποιοδήποτε σημείο της γραμμής (ή στο link) → `navigate(/years/${year})`.
- YearProfile: ο bar chart (total papers ανά χρονιά, τρέχον έτος highlighted με `#e94560`) εμφανίζεται πάντα στην κορυφή, πριν από τα stats.
- Χρησιμοποιεί `getYears()` (precomputed `year_stats`) για τα δεδομένα του chart — 0.3ms query, τρέχει μία φορά στο mount.

---

## DBMS compliance audit (26/05/2026)

Πλήρης επανέλεγχος μετά τις αλλαγές της συνεδρίας.

### Backend (views.py) — 16 endpoints

**Όλα COMPLIANT.** Ανάλυση:

| Endpoint | Λογική | DBMS; |
|----------|--------|-------|
| `conference_list` | LIKE, ROW_NUMBER, EXISTS — όλα SQL | ✓ |
| `conference_profile` | Filtered: COUNT DISTINCT, ROUND, BETWEEN σε SQL. Unfiltered: reads `conf_summary_stats` | ✓ |
| `conference_papers` | GROUP_CONCAT, year filter, LIMIT — SQL | ✓ |
| `journal_list` | LIKE, EXISTS — SQL | ✓ |
| `journal_profile` | Ίδιο με conference_profile | ✓ |
| `journal_papers` | Ίδιο με conference_papers | ✓ |
| `author_search` | LIKE LIMIT — SQL | ✓ |
| `author_profile` | Reads `v_author_summary`, `v_author_year` | ✓ |
| `year_list` | `SELECT * FROM year_stats` — precomputed | ✓ |
| `year_profile` | Unfiltered: `year_paper_list`. Filtered: live subquery GROUP_CONCAT LIMIT 500 | ✓ |
| `chart_linechart` | UNION ALL per venue, WHERE IN (parameterized), ORDER BY — SQL | ✓ |
| `chart_barchart` | Reads views `v_conf_summary`, `v_journal_summary`, `v_publisher_stats`, ORDER BY DESC LIMIT | ✓ |
| `chart_scatter` | SELECT fields allowlist-validated, WHERE IS NOT NULL, LIMIT — SQL | ✓ |
| `chart_scatter_venue_year` | Reads `v_conf_year`/`v_journal_year`, LIMIT — SQL | ✓ |
| `category_list` | LIKE LIMIT / full list — SQL | ✓ |
| `chart_category_linechart` | Reads `v_for_year`/`v_subject_area_year`, LIKE filter — SQL | ✓ |

**Security:** Τα `metric`, `x_field`, `y_field`, `chart_type` ονόματα επικυρώνονται έναντι hardcoded set πριν από string interpolation. Κανένα user-controlled string δεν παρεμβάλλεται ανεπικύρωτο.

### Frontend (ChartsPage, profiles, pages) — γκρι περιοχές

Οι παρακάτω JS πράξεις δεν παραβιάζουν τη φιλοσοφία:

- **`byLabel` pivoting** (LineChartPanel, CategoryLineChartPanel): Μετατρέπει flat rows `{label, year, value}` → `{label: [{x, y}]}` για το Chart.js API. Η GROUP BY λογική ήδη έχει γίνει στο SQL.
- **Publisher quartiles join** (BarChartPanel): 4 ξεχωριστά requests για `q1_count`…`q4_count`, join ανά label σε JS. Τα counts προέρχονται από `v_publisher_stats` (SQL `COUNT(CASE WHEN...)`). Το JS απλώς ευθυγραμμίζει 4 pre-aggregated arrays για το multi-series bar chart.
- **`[...new Set(...).sort()]` για chart labels**: Εξαγωγή μοναδικών χρονιών από pre-aggregated rows — chart axis formatting, όχι aggregation.
- **YearProfile VenueSearchFiltered**: Client-side substring filter σε preloaded venue list (βλ. σημείωση παραπάνω).

**Κανένα `reduce`, `sum`, `avg`, `count` ή άλλη aggregation function δεν εκτελείται σε Python ή JS.**
