-- ============================================================
-- 05_year_paper_list.sql
-- Precomputed table: 500 representative papers per year,
-- with venue and authors already resolved.
-- Run once (or after bulk data changes).
-- ============================================================

DROP TABLE IF EXISTS year_paper_list;

CREATE TABLE year_paper_list (
    year       SMALLINT     NOT NULL,
    paper_id   INT          NOT NULL,
    title      VARCHAR(512) NULL,
    paper_type VARCHAR(10)  NULL,
    pages      VARCHAR(50)  NULL,
    url        TEXT         NULL,
    venue      VARCHAR(512) NULL,
    authors    TEXT         NULL,
    PRIMARY KEY (year, paper_id),
    KEY idx_yrpl_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Use a stored procedure to process one year at a time.
-- Each iteration does: pick 500 paper_ids for the year (index scan),
-- join details + authors, insert — avoids full-table aggregation.

DROP PROCEDURE IF EXISTS populate_year_paper_list;

DELIMITER //

CREATE PROCEDURE populate_year_paper_list()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE yr   SMALLINT;

    DECLARE yr_cur CURSOR FOR
        SELECT DISTINCT year FROM papers WHERE year IS NOT NULL ORDER BY year;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN yr_cur;
    yr_loop: LOOP
        FETCH yr_cur INTO yr;
        IF done THEN LEAVE yr_loop; END IF;

        INSERT INTO year_paper_list
            (year, paper_id, title, paper_type, pages, url, venue, authors)
        SELECT sub.year, sub.paper_id, sub.title, sub.paper_type,
               sub.pages, sub.url, sub.venue,
               GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
        FROM (
            SELECT p.paper_id, p.title, p.year, p.paper_type, p.pages,
                   CASE WHEN p.url LIKE 'http%' THEN p.url
                        WHEN p.url IS NOT NULL   THEN CONCAT('https://dblp.org/', p.url)
                   END AS url,
                   COALESCE(c.acronym, j.title) AS venue
            FROM papers p
            LEFT JOIN conferences c ON p.conference_id = c.conference_id
            LEFT JOIN journals j    ON p.journal_id    = j.journal_id
            WHERE p.year = yr
            LIMIT 500
        ) sub
        JOIN paper_authors pa ON sub.paper_id = pa.paper_id
        JOIN authors a        ON pa.author_id  = a.author_id
        GROUP BY sub.year, sub.paper_id, sub.title, sub.paper_type,
                 sub.pages, sub.url, sub.venue;

    END LOOP;

    CLOSE yr_cur;
END //

DELIMITER ;

CALL populate_year_paper_list();

DROP PROCEDURE populate_year_paper_list;

SELECT CONCAT('year_paper_list populated: ', COUNT(*), ' rows across ',
              COUNT(DISTINCT year), ' years') AS status
FROM year_paper_list;
