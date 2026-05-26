CREATE DATABASE IF NOT EXISTS academic_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE academic_db;

-- lookup tables

-- Conference field-of-research categories (from icoreCategories)
CREATE TABLE IF NOT EXISTS primary_for (
    for_id      INT          NOT NULL,
    description VARCHAR(255) NOT NULL,
    PRIMARY KEY (for_id)
) ENGINE=InnoDB;

-- Journal subject area categories (from bestSubjectArea.csv)
CREATE TABLE IF NOT EXISTS best_subject_area (
    area_id     INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    PRIMARY KEY (area_id),
    UNIQUE KEY uq_area_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS authors (
    author_id   INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(512) NOT NULL,
    PRIMARY KEY (author_id),
    UNIQUE KEY uq_author_name (name(512))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conferences (
    conference_id   INT          NOT NULL AUTO_INCREMENT,
    icore_id        INT          NULL,           -- original ID from iCore26
    title           VARCHAR(512) NOT NULL,
    acronym         VARCHAR(100) NULL,
    `rank`          VARCHAR(100) NULL,           -- A*, A, B, C, Unranked, National:X, etc.
    dblp_available  TINYINT(1)   NOT NULL DEFAULT 0,
    primary_for_id  INT          NULL,
    PRIMARY KEY (conference_id),
    KEY idx_conf_acronym (acronym),
    CONSTRAINT fk_conf_for FOREIGN KEY (primary_for_id)
        REFERENCES primary_for (for_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journals (
    journal_id          INT            NOT NULL AUTO_INCREMENT,
    sjr_rank            INT            NULL,
    title               VARCHAR(512)   NOT NULL,
    oa                  TINYINT(1)     NOT NULL DEFAULT 0,
    country             VARCHAR(100)   NULL,
    sjr                 DECIMAL(10,3)  NULL,
    cite_score          DECIMAL(10,2)  NULL,
    h_index             INT            NULL,
    best_quartile       CHAR(2)        NULL,     -- Q1, Q2, Q3, Q4
    best_subject_area_id INT           NULL,
    total_docs          INT            NULL,
    total_docs_3y       INT            NULL,
    total_refs          INT            NULL,
    total_cites_3y      INT            NULL,
    citable_docs_3y     INT            NULL,
    cites_per_doc_2y    DECIMAL(10,3)  NULL,
    refs_per_doc        DECIMAL(10,3)  NULL,
    publisher           VARCHAR(255)   NULL,
    PRIMARY KEY (journal_id),
    KEY idx_journal_title (title(255)),
    CONSTRAINT fk_journal_area FOREIGN KEY (best_subject_area_id)
        REFERENCES best_subject_area (area_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- factual tables

CREATE TABLE IF NOT EXISTS papers (
    paper_id        INT          NOT NULL AUTO_INCREMENT,
    dblp_id         INT          NULL,           -- original numeric id from source CSV
    dblp_key        VARCHAR(255) NULL,           -- e.g. conf/edbt/SuTZ12
    title           VARCHAR(1024) NOT NULL,
    year            SMALLINT     NULL,
    pages           VARCHAR(50)  NULL,
    url             VARCHAR(512) NULL,
    mdate           DATE         NULL,
    paper_type      ENUM('conference','journal') NOT NULL,
    conference_id   INT          NULL,
    journal_id      INT          NULL,
    volume          VARCHAR(20)  NULL,
    number          VARCHAR(20)  NULL,
    PRIMARY KEY (paper_id),
    KEY idx_paper_year       (year),
    KEY idx_paper_conference (conference_id),
    KEY idx_paper_journal    (journal_id),
    KEY idx_paper_type       (paper_type),
    CONSTRAINT fk_paper_conference FOREIGN KEY (conference_id)
        REFERENCES conferences (conference_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_paper_journal FOREIGN KEY (journal_id)
        REFERENCES journals (journal_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paper_authors (
    paper_id        INT  NOT NULL,
    author_id       INT  NOT NULL,
    author_position INT  NOT NULL,   -- 1-based position in the pipe-separated list
    PRIMARY KEY (paper_id, author_id),
    KEY idx_pa_author (author_id),
    CONSTRAINT fk_pa_paper FOREIGN KEY (paper_id)
        REFERENCES papers (paper_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pa_author FOREIGN KEY (author_id)
        REFERENCES authors (author_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
