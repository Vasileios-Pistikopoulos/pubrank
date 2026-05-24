-- =============================================================
-- Views: Academic Publications Database
-- Run after 01_schema.sql and ETL
-- =============================================================

USE academic_db;

-- =============================================================
-- CONFERENCE VIEWS
-- =============================================================

-- Papers + author counts per conference per year
-- Used for: linechart in conference profile
DROP VIEW IF EXISTS v_conf_year;
CREATE VIEW v_conf_year AS
SELECT
    p.conference_id,
    p.year,
    COUNT(p.paper_id)              AS paper_count,
    COUNT(pa.author_id)            AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)   AS distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(p.paper_id), 2) AS avg_authors_per_paper
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.paper_type = 'conference'
  AND p.year IS NOT NULL
GROUP BY p.conference_id, p.year;


-- Overall summary stats per conference
-- Used for: conference profile header (first/last year, totals, averages)
DROP VIEW IF EXISTS v_conf_summary;
CREATE VIEW v_conf_summary AS
SELECT
    c.conference_id,
    c.title,
    c.acronym,
    c.`rank`,
    c.primary_for_id,
    MIN(p.year)                                                        AS first_year,
    MAX(p.year)                                                        AS last_year,
    COUNT(DISTINCT p.paper_id)                                         AS total_papers,
    COUNT(DISTINCT pa.author_id)                                       AS total_distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2)        AS avg_authors_per_paper,
    ROUND(COUNT(DISTINCT p.paper_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                AS avg_papers_per_year
FROM conferences c
JOIN papers p        ON c.conference_id = p.conference_id
JOIN paper_authors pa ON p.paper_id     = pa.paper_id
WHERE p.year IS NOT NULL
GROUP BY c.conference_id, c.title, c.acronym, c.`rank`, c.primary_for_id;


-- =============================================================
-- JOURNAL VIEWS
-- =============================================================

-- Papers + author counts per journal per year
DROP VIEW IF EXISTS v_journal_year;
CREATE VIEW v_journal_year AS
SELECT
    p.journal_id,
    p.year,
    COUNT(p.paper_id)              AS paper_count,
    COUNT(pa.author_id)            AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)   AS distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(p.paper_id), 2) AS avg_authors_per_paper
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.paper_type = 'journal'
  AND p.year IS NOT NULL
GROUP BY p.journal_id, p.year;


-- Overall summary stats per journal
DROP VIEW IF EXISTS v_journal_summary;
CREATE VIEW v_journal_summary AS
SELECT
    j.journal_id,
    j.title,
    j.sjr_rank,
    j.best_quartile,
    j.publisher,
    j.country,
    j.sjr,
    j.cite_score,
    j.h_index,
    MIN(p.year)                                                        AS first_year,
    MAX(p.year)                                                        AS last_year,
    COUNT(DISTINCT p.paper_id)                                         AS total_papers,
    COUNT(DISTINCT pa.author_id)                                       AS total_distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2)        AS avg_authors_per_paper,
    ROUND(COUNT(DISTINCT p.paper_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                AS avg_papers_per_year
FROM journals j
JOIN papers p         ON j.journal_id  = p.journal_id
JOIN paper_authors pa  ON p.paper_id   = pa.paper_id
WHERE p.year IS NOT NULL
GROUP BY j.journal_id, j.title, j.sjr_rank, j.best_quartile,
         j.publisher, j.country, j.sjr, j.cite_score, j.h_index;


-- =============================================================
-- AUTHOR VIEWS
-- =============================================================

-- Overall stats per author
-- Used for: author profile header
DROP VIEW IF EXISTS v_author_summary;
CREATE VIEW v_author_summary AS
SELECT
    a.author_id,
    a.name,
    MIN(p.year)                                                AS first_year,
    MAX(p.year)                                                AS last_year,
    COUNT(DISTINCT p.paper_id)                                 AS total_papers,
    COUNT(DISTINCT p.year)                                     AS active_years,
    ROUND(COUNT(DISTINCT p.paper_id) /
          NULLIF(COUNT(DISTINCT p.year), 0), 2)                AS avg_papers_per_active_year
FROM authors a
JOIN paper_authors pa ON a.author_id  = pa.author_id
JOIN papers p          ON pa.paper_id = p.paper_id
WHERE p.year IS NOT NULL
GROUP BY a.author_id, a.name;


-- Papers per author per year, split by type
-- Used for: author profile linechart
DROP VIEW IF EXISTS v_author_year;
CREATE VIEW v_author_year AS
SELECT
    pa.author_id,
    p.year,
    COUNT(p.paper_id)                               AS total_papers,
    SUM(p.paper_type = 'conference')                AS conf_papers,
    SUM(p.paper_type = 'journal')                   AS journal_papers
FROM paper_authors pa
JOIN papers p ON pa.paper_id = p.paper_id
WHERE p.year IS NOT NULL
GROUP BY pa.author_id, p.year;


-- =============================================================
-- YEAR VIEWS
-- =============================================================

-- Profile per year (total papers, venues, authors)
-- Used for: year profile page
DROP VIEW IF EXISTS v_year_summary;
CREATE VIEW v_year_summary AS
SELECT
    p.year,
    COUNT(DISTINCT p.paper_id)              AS total_papers,
    COUNT(DISTINCT p.conference_id)         AS distinct_conferences,
    COUNT(DISTINCT p.journal_id)            AS distinct_journals,
    COUNT(pa.author_id)                     AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)            AS distinct_authors
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.year IS NOT NULL
GROUP BY p.year;


-- =============================================================
-- CHART VIEWS
-- =============================================================

-- For linechart: multiple venues selected by user
-- (used with WHERE conference_id IN (...) or journal_id IN (...))
-- v_conf_year and v_journal_year already cover this

-- For barchart: total/avg papers and authors per conference
-- Reuses v_conf_summary / v_journal_summary

-- Publisher stats for barchart
-- Used for: barchart "journals per publisher" and "per quartile per publisher"
DROP VIEW IF EXISTS v_publisher_stats;
CREATE VIEW v_publisher_stats AS
SELECT
    j.publisher,
    COUNT(j.journal_id)                            AS total_journals,
    SUM(j.best_quartile = 'Q1')                    AS q1_count,
    SUM(j.best_quartile = 'Q2')                    AS q2_count,
    SUM(j.best_quartile = 'Q3')                    AS q3_count,
    SUM(j.best_quartile = 'Q4')                    AS q4_count
FROM journals j
WHERE j.publisher IS NOT NULL
GROUP BY j.publisher;


-- PrimaryFoR category: conferences per category per year
-- Used for: linechart "conferences per FoR category per year"
DROP VIEW IF EXISTS v_for_year;
CREATE VIEW v_for_year AS
SELECT
    p.primary_for_id,
    pf.description  AS for_description,
    py.year,
    COUNT(DISTINCT py.conference_id) AS conference_count,
    COUNT(DISTINCT py.paper_id)      AS paper_count
FROM primary_for pf
JOIN conferences p  ON pf.for_id        = p.primary_for_id
JOIN papers py       ON p.conference_id = py.conference_id
WHERE py.year IS NOT NULL
GROUP BY p.primary_for_id, pf.description, py.year;


-- BestSubjectArea: journals per area per year
DROP VIEW IF EXISTS v_subject_area_year;
CREATE VIEW v_subject_area_year AS
SELECT
    bsa.area_id,
    bsa.name        AS area_name,
    py.year,
    COUNT(DISTINCT py.journal_id)   AS journal_count,
    COUNT(DISTINCT py.paper_id)     AS paper_count
FROM best_subject_area bsa
JOIN journals j   ON bsa.area_id    = j.best_subject_area_id
JOIN papers py    ON j.journal_id   = py.journal_id
WHERE py.year IS NOT NULL
GROUP BY bsa.area_id, bsa.name, py.year;
