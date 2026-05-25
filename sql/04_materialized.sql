-- =============================================================
-- Materialized summary tables
-- Run ONCE after ETL (and after 01_schema.sql + 02_views.sql).
-- Re-run only if the dataset changes.
--
-- Strategy:
--   1. Create physical tables with precomputed aggregates
--   2. Redefine slow views as lightweight SELECT FROM <table>
--   The backend views.py references the views unchanged;
--   they now resolve instantly against the physical tables.
-- =============================================================

USE academic_db;

-- =============================================================
-- 1. CONFERENCE YEAR STATS  (replaces v_conf_year)
-- =============================================================

CREATE TABLE IF NOT EXISTS conf_year_stats (
    conference_id            INT          NOT NULL,
    year                     SMALLINT     NOT NULL,
    paper_count              INT          NOT NULL DEFAULT 0,
    total_author_appearances INT          NOT NULL DEFAULT 0,
    distinct_authors         INT          NOT NULL DEFAULT 0,
    avg_authors_per_paper    DECIMAL(6,2) NULL,
    PRIMARY KEY (conference_id, year),
    KEY idx_cys_year (year)
) ENGINE=InnoDB;

TRUNCATE TABLE conf_year_stats;

INSERT INTO conf_year_stats
    (conference_id, year, paper_count, total_author_appearances,
     distinct_authors, avg_authors_per_paper)
SELECT
    p.conference_id,
    p.year,
    COUNT(p.paper_id)                                          AS paper_count,
    COUNT(pa.author_id)                                        AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)                               AS distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2) AS avg_authors_per_paper
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.paper_type = 'conference' AND p.year IS NOT NULL
GROUP BY p.conference_id, p.year;


-- =============================================================
-- 2. CONFERENCE SUMMARY STATS  (replaces inline JOIN in profile)
-- =============================================================

CREATE TABLE IF NOT EXISTS conf_summary_stats (
    conference_id            INT          NOT NULL,
    first_year               SMALLINT     NULL,
    last_year                SMALLINT     NULL,
    total_papers             INT          NOT NULL DEFAULT 0,
    total_distinct_authors   INT          NOT NULL DEFAULT 0,
    avg_authors_per_paper    DECIMAL(6,2) NULL,
    avg_papers_per_year      DECIMAL(8,2) NULL,
    avg_authors_per_year     DECIMAL(8,2) NULL,
    PRIMARY KEY (conference_id)
) ENGINE=InnoDB;

TRUNCATE TABLE conf_summary_stats;

INSERT INTO conf_summary_stats
    (conference_id, first_year, last_year, total_papers,
     total_distinct_authors, avg_authors_per_paper,
     avg_papers_per_year, avg_authors_per_year)
SELECT
    p.conference_id,
    MIN(p.year)                                                             AS first_year,
    MAX(p.year)                                                             AS last_year,
    COUNT(DISTINCT p.paper_id)                                              AS total_papers,
    COUNT(DISTINCT pa.author_id)                                            AS total_distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2)             AS avg_authors_per_paper,
    ROUND(COUNT(DISTINCT p.paper_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                     AS avg_papers_per_year,
    ROUND(COUNT(pa.author_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                     AS avg_authors_per_year
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.conference_id IS NOT NULL AND p.year IS NOT NULL
GROUP BY p.conference_id;


-- =============================================================
-- 3. JOURNAL YEAR STATS  (replaces v_journal_year)
-- =============================================================

CREATE TABLE IF NOT EXISTS journal_year_stats (
    journal_id               INT          NOT NULL,
    year                     SMALLINT     NOT NULL,
    paper_count              INT          NOT NULL DEFAULT 0,
    total_author_appearances INT          NOT NULL DEFAULT 0,
    distinct_authors         INT          NOT NULL DEFAULT 0,
    avg_authors_per_paper    DECIMAL(6,2) NULL,
    PRIMARY KEY (journal_id, year),
    KEY idx_jys_year (year)
) ENGINE=InnoDB;

TRUNCATE TABLE journal_year_stats;

INSERT INTO journal_year_stats
    (journal_id, year, paper_count, total_author_appearances,
     distinct_authors, avg_authors_per_paper)
SELECT
    p.journal_id,
    p.year,
    COUNT(p.paper_id)                                          AS paper_count,
    COUNT(pa.author_id)                                        AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)                               AS distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2) AS avg_authors_per_paper
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.paper_type = 'journal' AND p.year IS NOT NULL
GROUP BY p.journal_id, p.year;


-- =============================================================
-- 4. JOURNAL SUMMARY STATS  (replaces inline JOIN in profile)
-- =============================================================

CREATE TABLE IF NOT EXISTS journal_summary_stats (
    journal_id               INT          NOT NULL,
    first_year               SMALLINT     NULL,
    last_year                SMALLINT     NULL,
    total_papers             INT          NOT NULL DEFAULT 0,
    total_distinct_authors   INT          NOT NULL DEFAULT 0,
    avg_authors_per_paper    DECIMAL(6,2) NULL,
    avg_papers_per_year      DECIMAL(8,2) NULL,
    avg_authors_per_year     DECIMAL(8,2) NULL,
    PRIMARY KEY (journal_id)
) ENGINE=InnoDB;

TRUNCATE TABLE journal_summary_stats;

INSERT INTO journal_summary_stats
    (journal_id, first_year, last_year, total_papers,
     total_distinct_authors, avg_authors_per_paper,
     avg_papers_per_year, avg_authors_per_year)
SELECT
    p.journal_id,
    MIN(p.year)                                                             AS first_year,
    MAX(p.year)                                                             AS last_year,
    COUNT(DISTINCT p.paper_id)                                              AS total_papers,
    COUNT(DISTINCT pa.author_id)                                            AS total_distinct_authors,
    ROUND(COUNT(pa.author_id) / COUNT(DISTINCT p.paper_id), 2)             AS avg_authors_per_paper,
    ROUND(COUNT(DISTINCT p.paper_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                     AS avg_papers_per_year,
    ROUND(COUNT(pa.author_id) /
          NULLIF(MAX(p.year) - MIN(p.year) + 1, 0), 2)                     AS avg_authors_per_year
FROM papers p
JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.journal_id IS NOT NULL AND p.year IS NOT NULL
GROUP BY p.journal_id;


-- =============================================================
-- 5. FOR YEAR STATS  (replaces v_for_year)
-- =============================================================

CREATE TABLE IF NOT EXISTS for_year_stats (
    primary_for_id    INT      NOT NULL,
    for_description   VARCHAR(255) NOT NULL,
    year              SMALLINT NOT NULL,
    conference_count  INT      NOT NULL DEFAULT 0,
    paper_count       INT      NOT NULL DEFAULT 0,
    PRIMARY KEY (primary_for_id, year)
) ENGINE=InnoDB;

TRUNCATE TABLE for_year_stats;

INSERT INTO for_year_stats
    (primary_for_id, for_description, year, conference_count, paper_count)
SELECT
    c.primary_for_id,
    pf.description                  AS for_description,
    py.year,
    COUNT(DISTINCT py.conference_id) AS conference_count,
    COUNT(DISTINCT py.paper_id)      AS paper_count
FROM primary_for pf
JOIN conferences c  ON pf.for_id       = c.primary_for_id
JOIN papers py      ON c.conference_id = py.conference_id
WHERE py.year IS NOT NULL
GROUP BY c.primary_for_id, pf.description, py.year;


-- =============================================================
-- 6. SUBJECT AREA YEAR STATS  (replaces v_subject_area_year)
-- =============================================================

CREATE TABLE IF NOT EXISTS subject_area_year_stats (
    area_id       INT          NOT NULL,
    area_name     VARCHAR(255) NOT NULL,
    year          SMALLINT     NOT NULL,
    journal_count INT          NOT NULL DEFAULT 0,
    paper_count   INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (area_id, year)
) ENGINE=InnoDB;

TRUNCATE TABLE subject_area_year_stats;

INSERT INTO subject_area_year_stats
    (area_id, area_name, year, journal_count, paper_count)
SELECT
    bsa.area_id,
    bsa.name                        AS area_name,
    py.year,
    COUNT(DISTINCT py.journal_id)   AS journal_count,
    COUNT(DISTINCT py.paper_id)     AS paper_count
FROM best_subject_area bsa
JOIN journals j  ON bsa.area_id   = j.best_subject_area_id
JOIN papers py   ON j.journal_id  = py.journal_id
WHERE py.year IS NOT NULL
GROUP BY bsa.area_id, bsa.name, py.year;


-- =============================================================
-- 7. REDEFINE VIEWS  →  lightweight pass-through to physical tables
--    All backend queries that reference these views now hit
--    indexed tables instead of recomputing JOINs.
-- =============================================================

DROP VIEW IF EXISTS v_conf_year;
CREATE VIEW v_conf_year AS
    SELECT * FROM conf_year_stats;

DROP VIEW IF EXISTS v_conf_summary;
CREATE VIEW v_conf_summary AS
    SELECT
        s.conference_id,
        c.title, c.acronym, c.`rank`, c.primary_for_id,
        s.first_year, s.last_year,
        s.total_papers, s.total_distinct_authors,
        s.avg_authors_per_paper, s.avg_papers_per_year, s.avg_authors_per_year
    FROM conf_summary_stats s
    JOIN conferences c ON s.conference_id = c.conference_id;

DROP VIEW IF EXISTS v_journal_year;
CREATE VIEW v_journal_year AS
    SELECT * FROM journal_year_stats;

DROP VIEW IF EXISTS v_journal_summary;
CREATE VIEW v_journal_summary AS
    SELECT
        s.journal_id,
        j.title, j.sjr_rank, j.best_quartile, j.publisher,
        j.country, j.sjr, j.cite_score, j.h_index,
        s.first_year, s.last_year,
        s.total_papers, s.total_distinct_authors,
        s.avg_authors_per_paper, s.avg_papers_per_year, s.avg_authors_per_year
    FROM journal_summary_stats s
    JOIN journals j ON s.journal_id = j.journal_id;

DROP VIEW IF EXISTS v_for_year;
CREATE VIEW v_for_year AS
    SELECT * FROM for_year_stats;

DROP VIEW IF EXISTS v_subject_area_year;
CREATE VIEW v_subject_area_year AS
    SELECT * FROM subject_area_year_stats;

DROP VIEW IF EXISTS v_year_summary;
CREATE VIEW v_year_summary AS
    SELECT * FROM year_stats;
