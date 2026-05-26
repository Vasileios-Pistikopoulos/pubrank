# Pubrank
**Συντελεστής:** Βασίλης Πιστικόπουλος, Βαίοτσης Ευάγγελος (ΑΜ: 5336,5096)

Video Link: https://drive.google.com/drive/folders/1bcNKmifTBzFCyDLQpTv_k8A_mM26xdX2?usp=sharing
---

## Περιγραφή

Εφαρμογή ενοποίησης και οπτικοποίησης βιβλιογραφικών δεδομένων από DBLP, iCore26 και Kaggle Journal Rankings. Υποστηρίζει πλοήγηση σε συνέδρια, περιοδικά, συγγραφείς και χρονιές, καθώς και στοχευμένες γραφικές παραστάσεις.

---

## Stack

| Layer | Τεχνολογία |
|-------|-----------|
| DB | MySQL 8 (InnoDB) |
| Backend | Django 6 + raw SQL (`connection.cursor`) |
| Frontend | React 18 + Vite 5 + Chart.js |

---

## Δομή αρχείων

```
.
├── backend/          # Django backend
│   ├── api/
│   │   └── views.py  # όλα τα endpoints ως raw SQL
│   ├── backend/
│   │   ├── settings.py
│   │   └── urls.py
│   └── .env          # DB credentials (βλ. .env.example)
├── frontend/         # React/Vite frontend
│   ├── src/
│   │   ├── pages/    # ConferencesPage, JournalProfile, AuthorProfile, …
│   │   ├── components/
│   │   └── api/client.js
│   └── .env          # VITE_API_URL (βλ. .env.example)
├── sql/
│   ├── 01_schema.sql          # DDL
│   ├── 02_views.sql           # SQL views
│   ├── 03_year_stats.sql      # precomputed year stats
│   ├── 04_materialized.sql    # materialized summary tables
│   └── 05_year_paper_list.sql # precomputed papers per year
├── etl/
│   └── etl.py        # ETL script (6 φάσεις)
└── data/             # raw input CSVs (dblp, iCore26, Kaggle)
```

---

## Setup

### 1. Βάση δεδομένων

```bash
mysql -u root -p -e "CREATE DATABASE academic_db CHARACTER SET utf8mb4;"
```

Εκτέλεση DDL + views:

```bash
# Windows 
Get-Content sql\01_schema.sql | mysql -u root -p academic_db
Get-Content sql\02_views.sql  | mysql -u root -p academic_db
```

### 2. ETL

```bash
cd etl
pip install -r requirements.txt   # pandas, mysqlclient
python etl.py
```

### 3. Precomputed tables (τρέξε μετά το ETL)

```bash
Get-Content sql\03_year_stats.sql      | mysql -u root -p academic_db
Get-Content sql\04_materialized.sql    | mysql -u root -p academic_db
Get-Content sql\05_year_paper_list.sql | mysql -u root -p academic_db
```

### 4. Backend

```bash
cd backend
copy  .env   # και συμπλήρωσε DB_PASSWORD
pip install django mysqlclient django-cors-headers python-dotenv
python manage.py runserver
```

### 5. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Η εφαρμογή τρέχει στο `http://localhost:5173`.

---

## Αρχιτεκτονική queries

Όλη η επεξεργασία γίνεται **μέσα στο DBMS** (SQL views + precomputed tables). Το Django backend λειτουργεί αποκλειστικά ως αγωγός: `request → cursor.execute(SQL) -> JsonResponse`. Δεν γίνεται καμία aggregation σε Python.

Κρίσιμα σημεία:
- **Materialized tables** (`conf_summary_stats`, `journal_summary_stats`, `year_stats`, `year_paper_list`) για queries < 3ms
- **Parameterized queries** 
- **Allowlist validation** για dynamic field names στα chart endpoints
