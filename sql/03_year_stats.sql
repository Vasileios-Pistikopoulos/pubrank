
-- Precomputed year statistics table
-- Run ONCE after ETL to populate. Re-run if data changes.
-- Replaces the slow JOIN query in year_list API endpoint.


USE academic_db;

CREATE TABLE IF NOT EXISTS year_stats (
    year                    SMALLINT NOT NULL,
    total_papers            INT      NOT NULL DEFAULT 0,
    distinct_conferences    INT      NOT NULL DEFAULT 0,
    distinct_journals       INT      NOT NULL DEFAULT 0,
    total_author_appearances INT     NOT NULL DEFAULT 0,
    distinct_authors        INT      NOT NULL DEFAULT 0,
    PRIMARY KEY (year)
) ENGINE=InnoDB;

TRUNCATE TABLE year_stats;

INSERT INTO year_stats (
    year,
    total_papers,
    distinct_conferences,
    distinct_journals,
    total_author_appearances,
    distinct_authors
)
SELECT
    p.year,
    COUNT(DISTINCT p.paper_id)     AS total_papers,
    COUNT(DISTINCT p.conference_id) AS distinct_conferences,
    COUNT(DISTINCT p.journal_id)    AS distinct_journals,
    COUNT(pa.author_id)             AS total_author_appearances,
    COUNT(DISTINCT pa.author_id)    AS distinct_authors
FROM papers p
LEFT JOIN paper_authors pa ON p.paper_id = pa.paper_id
WHERE p.year IS NOT NULL
GROUP BY p.year
ORDER BY p.year;
