from django.db import connection
from django.http import JsonResponse


def rows_as_dicts(cursor):
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

def row_as_dict(cursor):
    cols = [c[0] for c in cursor.description]
    row  = cursor.fetchone()
    return dict(zip(cols, row)) if row else None


def conference_list(request):
    q = request.GET.get('q', '').strip()
    if q:
        with connection.cursor() as cur:
            cur.execute("""
                SELECT c.conference_id, c.title, c.acronym, c.`rank`
                FROM conferences c
                WHERE c.acronym LIKE %s OR c.title LIKE %s
                ORDER BY c.acronym LIMIT 20
            """, [f'%{q}%', f'%{q}%'])
            return JsonResponse(rows_as_dicts(cur), safe=False)

    has_papers = request.GET.get('has_papers') == '1'
    extra = "AND EXISTS (SELECT 1 FROM papers p WHERE p.conference_id = c.conference_id)" if has_papers else ""
    with connection.cursor() as cur:
        cur.execute(f"""
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
            {extra}
            ORDER BY c.acronym
        """)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def conference_profile(request, conference_id):
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
                       COUNT(DISTINCT p.paper_id)   AS total_papers,
                       COUNT(DISTINCT pa.author_id)  AS total_distinct_authors,
                       ROUND(COUNT(pa.author_id)/COUNT(DISTINCT p.paper_id),2)  AS avg_authors_per_paper,
                       ROUND(COUNT(DISTINCT p.paper_id)/(%s-%s+1),2)            AS avg_papers_per_year,
                       ROUND(COUNT(pa.author_id)/(%s-%s+1),2)                   AS avg_authors_per_year
                FROM papers p
                JOIN paper_authors pa ON p.paper_id = pa.paper_id
                WHERE p.conference_id = %s AND p.year BETWEEN %s AND %s
            """, [year_to, year_from, year_to, year_from, conference_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT first_year, last_year, total_papers, total_distinct_authors,
                       avg_authors_per_paper, avg_papers_per_year, avg_authors_per_year
                FROM conf_summary_stats WHERE conference_id = %s
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
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')
    params    = [conference_id]
    year_clause = ""
    if year_from and year_to:
        year_clause = "AND p.year BETWEEN %s AND %s"
        params += [year_from, year_to]

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT p.paper_id, p.title, p.year, p.pages,
                   CASE WHEN p.url LIKE 'http%%' THEN p.url
                        WHEN p.url IS NOT NULL     THEN CONCAT('https://dblp.org/', p.url)
                   END AS url,
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


def journal_list(request):
    q = request.GET.get('q', '').strip()
    if q:
        with connection.cursor() as cur:
            cur.execute("""
                SELECT j.journal_id, j.title
                FROM journals j
                WHERE j.title LIKE %s
                ORDER BY j.sjr_rank LIMIT 20
            """, [f'%{q}%'])
            return JsonResponse(rows_as_dicts(cur), safe=False)

    has_papers = request.GET.get('has_papers') == '1'
    extra = "AND EXISTS (SELECT 1 FROM papers p WHERE p.journal_id = j.journal_id)" if has_papers else ""
    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT j.journal_id, j.title, j.sjr_rank, j.best_quartile,
                   j.publisher, j.country, bsa.name AS subject_area
            FROM journals j
            LEFT JOIN best_subject_area bsa ON j.best_subject_area_id = bsa.area_id
            WHERE 1=1 {extra}
            ORDER BY j.sjr_rank
        """)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def journal_profile(request, journal_id):
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
                       COUNT(DISTINCT p.paper_id)   AS total_papers,
                       COUNT(DISTINCT pa.author_id)  AS total_distinct_authors,
                       ROUND(COUNT(pa.author_id)/COUNT(DISTINCT p.paper_id),2)  AS avg_authors_per_paper,
                       ROUND(COUNT(DISTINCT p.paper_id)/(%s-%s+1),2)            AS avg_papers_per_year,
                       ROUND(COUNT(pa.author_id)/(%s-%s+1),2)                   AS avg_authors_per_year
                FROM papers p
                JOIN paper_authors pa ON p.paper_id = pa.paper_id
                WHERE p.journal_id = %s AND p.year BETWEEN %s AND %s
            """, [year_to, year_from, year_to, year_from, journal_id, year_from, year_to])
        else:
            cur.execute("""
                SELECT first_year, last_year, total_papers, total_distinct_authors,
                       avg_authors_per_paper, avg_papers_per_year, avg_authors_per_year
                FROM journal_summary_stats WHERE journal_id = %s
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
    year_from = request.GET.get('year_from')
    year_to   = request.GET.get('year_to')
    params    = [journal_id]
    year_clause = ""
    if year_from and year_to:
        year_clause = "AND p.year BETWEEN %s AND %s"
        params += [year_from, year_to]

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT p.paper_id, p.title, p.year, p.volume, p.number, p.pages,
                   CASE WHEN p.url LIKE 'http%%' THEN p.url
                        WHEN p.url IS NOT NULL     THEN CONCAT('https://dblp.org/', p.url)
                   END AS url,
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


def author_search(request):
    q = request.GET.get('q', '')
    with connection.cursor() as cur:
        cur.execute("""
            SELECT author_id, name FROM authors
            WHERE name LIKE %s ORDER BY name LIMIT 50
        """, [f'%{q}%'])
        return JsonResponse(rows_as_dicts(cur), safe=False)


def author_profile(request, author_id):
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM v_author_summary WHERE author_id = %s", [author_id])
        summary = row_as_dict(cur)

        cur.execute("""
            SELECT year, total_papers, conf_papers, journal_papers
            FROM v_author_year WHERE author_id = %s ORDER BY year
        """, [author_id])
        per_year = rows_as_dicts(cur)

    return JsonResponse({'summary': summary, 'per_year': per_year})


def year_list(request):
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM year_stats ORDER BY year")
        return JsonResponse(rows_as_dicts(cur), safe=False)


def year_profile(request, year):
    conf_filter    = request.GET.get('conference_id')
    journal_filter = request.GET.get('journal_id')
    author_filter  = request.GET.get('author_id')

    inner_where = "p.year = %s"
    params = [year]
    if conf_filter:
        inner_where += " AND p.conference_id = %s";   params.append(conf_filter)
    if journal_filter:
        inner_where += " AND p.journal_id = %s";      params.append(journal_filter)
    if author_filter:
        inner_where += " AND p.paper_id IN (SELECT paper_id FROM paper_authors WHERE author_id = %s)"
        params.append(author_filter)

    with connection.cursor() as cur:
        cur.execute("SELECT * FROM year_stats WHERE year = %s", [year])
        summary = row_as_dict(cur)

        if not conf_filter and not journal_filter and not author_filter:
            cur.execute("""
                SELECT paper_id, title, year, paper_type, pages, url, venue, authors
                FROM year_paper_list
                WHERE year = %s
                ORDER BY paper_type, venue, title
            """, [year])
        else:
            cur.execute(f"""
                SELECT sub.paper_id, sub.title, sub.year, sub.paper_type,
                       sub.pages, sub.url, sub.venue,
                       GROUP_CONCAT(a.name ORDER BY pa.author_position SEPARATOR ', ') AS authors
                FROM (
                    SELECT p.paper_id, p.title, p.year, p.paper_type, p.pages,
                           CASE WHEN p.url LIKE 'http%%' THEN p.url
                                WHEN p.url IS NOT NULL     THEN CONCAT('https://dblp.org/', p.url)
                           END AS url,
                           COALESCE(c.acronym, j.title) AS venue
                    FROM papers p
                    LEFT JOIN conferences c ON p.conference_id = c.conference_id
                    LEFT JOIN journals j    ON p.journal_id    = j.journal_id
                    WHERE {inner_where}
                    LIMIT 500
                ) sub
                JOIN paper_authors pa ON sub.paper_id = pa.paper_id
                JOIN authors a        ON pa.author_id  = a.author_id
                GROUP BY sub.paper_id, sub.title, sub.year, sub.paper_type,
                         sub.pages, sub.url, sub.venue
                ORDER BY sub.paper_type, sub.venue, sub.title
            """, params)
        papers = rows_as_dicts(cur)

    return JsonResponse({'summary': summary, 'papers': papers})


def chart_linechart(request):
    metric    = request.GET.get('metric', 'paper_count')
    year_from = request.GET.get('year_from', 1950)
    year_to   = request.GET.get('year_to', 2030)

    allowed_metrics = {'paper_count', 'distinct_authors', 'total_author_appearances', 'avg_authors_per_paper'}
    if metric not in allowed_metrics:
        return JsonResponse({'error': 'invalid metric'}, status=400)

    conf_ids = [x.strip() for x in request.GET.get('conf_ids', '').split(',') if x.strip()]
    jour_ids = [x.strip() for x in request.GET.get('jour_ids', '').split(',') if x.strip()]

    if not conf_ids and not jour_ids:
        return JsonResponse([], safe=False)

    parts  = []
    params = []
    if conf_ids:
        placeholders = ','.join(['%s'] * len(conf_ids))
        parts.append(f"""
            SELECT c.acronym AS label, v.year, v.{metric} AS value
            FROM v_conf_year v
            JOIN conferences c ON v.conference_id = c.conference_id
            WHERE v.conference_id IN ({placeholders}) AND v.year BETWEEN %s AND %s
        """)
        params.extend(conf_ids + [year_from, year_to])
    if jour_ids:
        placeholders = ','.join(['%s'] * len(jour_ids))
        parts.append(f"""
            SELECT j.title AS label, v.year, v.{metric} AS value
            FROM v_journal_year v
            JOIN journals j ON v.journal_id = j.journal_id
            WHERE v.journal_id IN ({placeholders}) AND v.year BETWEEN %s AND %s
        """)
        params.extend(jour_ids + [year_from, year_to])

    with connection.cursor() as cur:
        cur.execute(" UNION ALL ".join(parts) + " ORDER BY label, year", params)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def chart_barchart(request):
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


def chart_scatter_venue_year(request):
    venue_type = request.GET.get('type', 'conferences')

    with connection.cursor() as cur:
        if venue_type == 'conferences':
            cur.execute("""
                SELECT c.acronym AS label, v.year, v.paper_count AS x, v.avg_authors_per_paper AS y
                FROM v_conf_year v
                JOIN conferences c ON v.conference_id = c.conference_id
                WHERE v.paper_count IS NOT NULL AND v.avg_authors_per_paper IS NOT NULL
                LIMIT 3000
            """)
        else:
            cur.execute("""
                SELECT j.title AS label, v.year, v.paper_count AS x, v.avg_authors_per_paper AS y
                FROM v_journal_year v
                JOIN journals j ON v.journal_id = j.journal_id
                WHERE v.paper_count IS NOT NULL AND v.avg_authors_per_paper IS NOT NULL
                LIMIT 3000
            """)
        return JsonResponse(rows_as_dicts(cur), safe=False)


def category_list(request):
    cat_type = request.GET.get('type', 'for')
    q = request.GET.get('q', '').strip()
    with connection.cursor() as cur:
        if cat_type == 'for':
            if q:
                cur.execute("SELECT description AS name FROM primary_for WHERE description LIKE %s ORDER BY description LIMIT 20", [f'%{q}%'])
            else:
                cur.execute("SELECT description AS name FROM primary_for ORDER BY description")
        else:
            if q:
                cur.execute("SELECT name FROM best_subject_area WHERE name LIKE %s ORDER BY name LIMIT 20", [f'%{q}%'])
            else:
                cur.execute("SELECT name FROM best_subject_area ORDER BY name")
        return JsonResponse(rows_as_dicts(cur), safe=False)


def chart_category_linechart(request):
    cat_type = request.GET.get('type', 'for')
    category = request.GET.get('category', '').strip()

    with connection.cursor() as cur:
        if cat_type == 'for':
            if category:
                cur.execute("""
                    SELECT for_description AS label, year, conference_count AS value
                    FROM v_for_year
                    WHERE for_description LIKE %s
                    ORDER BY year
                """, [f'%{category}%'])
            else:
                cur.execute("""
                    SELECT for_description AS label, year, conference_count AS value
                    FROM v_for_year ORDER BY year
                """)
        else:
            if category:
                cur.execute("""
                    SELECT area_name AS label, year, journal_count AS value
                    FROM v_subject_area_year
                    WHERE area_name LIKE %s
                    ORDER BY year
                """, [f'%{category}%'])
            else:
                cur.execute("""
                    SELECT area_name AS label, year, journal_count AS value
                    FROM v_subject_area_year ORDER BY year
                """)
        return JsonResponse(rows_as_dicts(cur), safe=False)
