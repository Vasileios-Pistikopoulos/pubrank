from django.db import connection
from django.http import JsonResponse


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def rows_as_dicts(cursor):
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def row_as_dict(cursor):
    cols = [c[0] for c in cursor.description]
    row  = cursor.fetchone()
    return dict(zip(cols, row)) if row else None


# ------------------------------------------------------------------
# CONFERENCES
# ------------------------------------------------------------------

def conference_list(request):
    """GET /api/conferences/ — deduplicated by acronym, keeping the entry with most papers"""
    with connection.cursor() as cur:
        cur.execute("""
            SELECT c.conference_id, c.title, c.acronym, c.`rank`, c.primary_for_id,
                   pf.description AS for_description
            FROM conferences c
            LEFT JOIN primary_for pf ON c.primary_for_id = pf.for_id
            WHERE c.conference_id IN (
                SELECT conference_id FROM (
                    SELECT c2.conference_id,
                           ROW_NUMBER() OVER (
                               PARTITION BY c2.acronym
                               ORDER BY COUNT(p.paper_id) DESC, c2.conference_id DESC
                           ) AS rn
                    FROM conferences c2
                    LEFT JOIN papers p ON c2.conference_id = p.conference_id
                    GROUP BY c2.conference_id
                ) ranked WHERE rn = 1
            )
            ORDER BY c.acronym
        """)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def conference_profile(request, conference_id):
    """GET /api/conferences/<id>/profile/?year_from=2000&year_to=2020"""
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')

    with connection.cursor() as cur:
        cur.execute("""
            SELECT c.conference_id, c.title, c.acronym, c.`rank`,
                   pf.description AS for_description
            FROM conferences c
            LEFT JOIN primary_for pf ON c.primary_for_id = pf.for_id
            WHERE c.conference_id = %s
        """, [conference_id])
        info = row_as_dict(cur)

        if year_from and year_to:
            cur.execute("""
                SELECT MIN(p.year) AS first_year, MAX(p.year) AS last_year,
                       COUNT(DISTINCT p.paper_id)  AS total_papers,
                       COUNT(DISTINCT pa.author_id) AS total_distinct_authors,
                       ROUND(COUNT(pa.author_id)/COUNT(DISTINCT p.paper_id),2) AS avg_authors_per_paper,
                       ROUND(COUNT(DISTINCT p.paper_id)/(%s-%s+1),2) AS avg_papers_per_year
                FROM papers p
                JOIN paper_authors pa ON p.paper_id = pa.paper_id
                WHERE p.conference_id = %s AND p.year BETWEEN %s AND %s
            """, [year_to, year_from, conference_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT first_year, last_year, total_papers, total_distinct_authors,
                       avg_authors_per_paper, avg_papers_per_year
                FROM v_conf_summary WHERE conference_id = %s
            """, [conference_id])
        stats = row_as_dict(cur)

        if year_from and year_to:
            cur.execute("""
                SELECT year, paper_count, total_author_appearances, distinct_authors, avg_authors_per_paper
                FROM v_conf_year
                WHERE conference_id = %s AND year BETWEEN %s AND %s
                ORDER BY year
            """, [conference_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT year, paper_count, total_author_appearances, distinct_authors, avg_authors_per_paper
                FROM v_conf_year WHERE conference_id = %s ORDER BY year
            """, [conference_id])
        per_year = rows_as_dicts(cur)

    return JsonResponse({'info': info, 'stats': stats, 'per_year': per_year})


def conference_papers(request, conference_id):
    """GET /api/conferences/<id>/papers/?year_from=&year_to="""
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')
    params    = [conference_id]
    year_clause = ""
    if year_from and year_to:
        year_clause = "AND p.year BETWEEN %s AND %s"
        params += [year_from, year_to]

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT p.paper_id, p.title, p.year, p.pages, p.url,
                   GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
            FROM papers p
            JOIN paper_authors pa ON p.paper_id  = pa.paper_id
            JOIN authors a        ON pa.author_id = a.author_id
            WHERE p.conference_id = %s {year_clause}
            GROUP BY p.paper_id, p.title, p.year, p.pages, p.url
            ORDER BY p.year DESC, p.title
            LIMIT 1000
        """, params)
        return JsonResponse(rows_as_dicts(cur), safe=False)


# ------------------------------------------------------------------
# JOURNALS
# ------------------------------------------------------------------

def journal_list(request):
    """GET /api/journals/"""
    with connection.cursor() as cur:
        cur.execute("""
            SELECT j.journal_id, j.title, j.sjr_rank, j.best_quartile,
                   j.publisher, j.country, bsa.name AS subject_area
            FROM journals j
            LEFT JOIN best_subject_area bsa ON j.best_subject_area_id = bsa.area_id
            ORDER BY j.sjr_rank
        """)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def journal_profile(request, journal_id):
    """GET /api/journals/<id>/profile/"""
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')

    with connection.cursor() as cur:
        cur.execute("""
            SELECT j.*, bsa.name AS subject_area
            FROM journals j
            LEFT JOIN best_subject_area bsa ON j.best_subject_area_id = bsa.area_id
            WHERE j.journal_id = %s
        """, [journal_id])
        info = row_as_dict(cur)

        if year_from and year_to:
            cur.execute("""
                SELECT MIN(p.year) AS first_year, MAX(p.year) AS last_year,
                       COUNT(DISTINCT p.paper_id)  AS total_papers,
                       COUNT(DISTINCT pa.author_id) AS total_distinct_authors,
                       ROUND(COUNT(pa.author_id)/COUNT(DISTINCT p.paper_id),2) AS avg_authors_per_paper,
                       ROUND(COUNT(DISTINCT p.paper_id)/(%s-%s+1),2) AS avg_papers_per_year
                FROM papers p
                JOIN paper_authors pa ON p.paper_id = pa.paper_id
                WHERE p.journal_id = %s AND p.year BETWEEN %s AND %s
            """, [year_to, year_from, journal_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT first_year, last_year, total_papers, total_distinct_authors,
                       avg_authors_per_paper, avg_papers_per_year
                FROM v_journal_summary WHERE journal_id = %s
            """, [journal_id])
        stats = row_as_dict(cur)

        if year_from and year_to:
            cur.execute("""
                SELECT year, paper_count, total_author_appearances, distinct_authors
                FROM v_journal_year
                WHERE journal_id = %s AND year BETWEEN %s AND %s ORDER BY year
            """, [journal_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT year, paper_count, total_author_appearances, distinct_authors
                FROM v_journal_year WHERE journal_id = %s ORDER BY year
            """, [journal_id])
        per_year = rows_as_dicts(cur)

    return JsonResponse({'info': info, 'stats': stats, 'per_year': per_year})


def journal_papers(request, journal_id):
    """GET /api/journals/<id>/papers/"""
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')
    params    = [journal_id]
    year_clause = ""
    if year_from and year_to:
        year_clause = "AND p.year BETWEEN %s AND %s"
        params += [year_from, year_to]

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT p.paper_id, p.title, p.year, p.volume, p.number, p.pages, p.url,
                   GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
            FROM papers p
            JOIN paper_authors pa ON p.paper_id  = pa.paper_id
            JOIN authors a        ON pa.author_id = a.author_id
            WHERE p.journal_id = %s {year_clause}
            GROUP BY p.paper_id, p.title, p.year, p.volume, p.number, p.pages, p.url
            ORDER BY p.year DESC, p.title
            LIMIT 1000
        """, params)
        return JsonResponse(rows_as_dicts(cur), safe=False)


# ------------------------------------------------------------------
# AUTHORS
# ------------------------------------------------------------------

def author_search(request):
    """GET /api/authors/?q=name"""
    q = request.GET.get('q', '')
    with connection.cursor() as cur:
        cur.execute("""
            SELECT author_id, name FROM authors
            WHERE name LIKE %s ORDER BY name LIMIT 50
        """, [f'%{q}%'])
        return JsonResponse(rows_as_dicts(cur), safe=False)


def author_profile(request, author_id):
    """GET /api/authors/<id>/profile/"""
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM v_author_summary WHERE author_id = %s", [author_id])
        summary = row_as_dict(cur)

        cur.execute("""
            SELECT year, total_papers, conf_papers, journal_papers
            FROM v_author_year WHERE author_id = %s ORDER BY year
        """, [author_id])
        per_year = rows_as_dicts(cur)

    return JsonResponse({'summary': summary, 'per_year': per_year})


# ------------------------------------------------------------------
# YEARS
# ------------------------------------------------------------------

def year_list(request):
    """GET /api/years/"""
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM v_year_summary ORDER BY year")
        return JsonResponse(rows_as_dicts(cur), safe=False)


def year_profile(request, year):
    """GET /api/years/<year>/profile/?conference_id=&journal_id=&author_id="""
    conf_filter   = request.GET.get('conference_id')
    journal_filter = request.GET.get('journal_id')
    author_filter = request.GET.get('author_id')

    params = [year]
    extra  = ""
    if conf_filter:
        extra += " AND p.conference_id = %s"; params.append(conf_filter)
    if journal_filter:
        extra += " AND p.journal_id = %s";    params.append(journal_filter)
    if author_filter:
        extra += " AND pa.author_id = %s";    params.append(author_filter)

    with connection.cursor() as cur:
        cur.execute("SELECT * FROM v_year_summary WHERE year = %s", [year])
        summary = row_as_dict(cur)

        cur.execute(f"""
            SELECT p.paper_id, p.title, p.year, p.paper_type, p.pages, p.url,
                   COALESCE(c.acronym, j.title) AS venue,
                   GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
            FROM papers p
            LEFT JOIN conferences c ON p.conference_id = c.conference_id
            LEFT JOIN journals j    ON p.journal_id    = j.journal_id
            JOIN  paper_authors pa  ON p.paper_id      = pa.paper_id
            JOIN  authors a         ON pa.author_id     = a.author_id
            WHERE p.year = %s {extra}
            GROUP BY p.paper_id, p.title, p.year, p.paper_type, p.pages, p.url, venue
            ORDER BY p.paper_type, venue, p.title
            LIMIT 500
        """, params)
        papers = rows_as_dicts(cur)

    return JsonResponse({'summary': summary, 'papers': papers})


# ------------------------------------------------------------------
# CHARTS
# ------------------------------------------------------------------

def chart_linechart(request):
    """GET /api/charts/linechart/?conf_ids=1,2&jour_ids=3&metric=paper_count&year_from=2000&year_to=2020"""
    conf_ids  = request.GET.get('conf_ids', '')
    jour_ids  = request.GET.get('jour_ids', '')
    metric    = request.GET.get('metric', 'paper_count')
    year_from = request.GET.get('year_from', 1950)
    year_to   = request.GET.get('year_to', 2030)

    allowed_metrics = {'paper_count', 'distinct_authors', 'total_author_appearances', 'avg_authors_per_paper'}
    if metric not in allowed_metrics:
        return JsonResponse({'error': 'invalid metric'}, status=400)

    results = []
    with connection.cursor() as cur:
        for cid in [x.strip() for x in conf_ids.split(',') if x.strip()]:
            cur.execute(f"""
                SELECT c.acronym AS label, v.year, v.{metric} AS value
                FROM v_conf_year v
                JOIN conferences c ON v.conference_id = c.conference_id
                WHERE v.conference_id = %s AND v.year BETWEEN %s AND %s
                ORDER BY v.year
            """, [cid, year_from, year_to])
            results += rows_as_dicts(cur)

        for jid in [x.strip() for x in jour_ids.split(',') if x.strip()]:
            cur.execute(f"""
                SELECT j.title AS label, v.year, v.{metric} AS value
                FROM v_journal_year v
                JOIN journals j ON v.journal_id = j.journal_id
                WHERE v.journal_id = %s AND v.year BETWEEN %s AND %s
                ORDER BY v.year
            """, [jid, year_from, year_to])
            results += rows_as_dicts(cur)

    return JsonResponse(results, safe=False)


def chart_barchart(request):
    """GET /api/charts/barchart/?type=conferences&metric=total_papers"""
    chart_type = request.GET.get('type', 'conferences')
    metric     = request.GET.get('metric', 'total_papers')

    allowed = {'total_papers', 'avg_papers_per_year', 'avg_authors_per_paper',
               'total_journals', 'q1_count', 'q2_count', 'q3_count', 'q4_count'}
    if metric not in allowed:
        return JsonResponse({'error': 'invalid metric'}, status=400)

    with connection.cursor() as cur:
        if chart_type == 'conferences':
            cur.execute(f"SELECT acronym AS label, {metric} AS value FROM v_conf_summary ORDER BY value DESC LIMIT 50")
        elif chart_type == 'journals':
            cur.execute(f"SELECT title AS label, {metric} AS value FROM v_journal_summary ORDER BY value DESC LIMIT 50")
        elif chart_type == 'publishers':
            cur.execute(f"SELECT publisher AS label, {metric} AS value FROM v_publisher_stats ORDER BY value DESC LIMIT 30")
        else:
            return JsonResponse({'error': 'invalid type'}, status=400)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def chart_scatter(request):
    """GET /api/charts/scatter/?x=sjr&y=cite_score"""
    x_field = request.GET.get('x', 'sjr')
    y_field = request.GET.get('y', 'cite_score')

    allowed = {'sjr', 'cite_score', 'h_index', 'total_docs', 'total_docs_3y',
               'total_refs', 'total_cites_3y', 'citable_docs_3y',
               'cites_per_doc_2y', 'refs_per_doc'}
    if x_field not in allowed or y_field not in allowed:
        return JsonResponse({'error': 'invalid field'}, status=400)

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT title AS label, {x_field} AS x, {y_field} AS y,
                   best_quartile, publisher
            FROM journals
            WHERE {x_field} IS NOT NULL AND {y_field} IS NOT NULL
            LIMIT 2000
        """)
        return JsonResponse(rows_as_dicts(cur), safe=False)
