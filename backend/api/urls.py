from django.urls import path
from . import views

urlpatterns = [
    path('conferences/',                        views.conference_list),
    path('conferences/<int:conference_id>/profile/', views.conference_profile),
    path('conferences/<int:conference_id>/papers/', views.conference_papers),
    path('journals/',                           views.journal_list),
    path('journals/<int:journal_id>/profile/', views.journal_profile),
    path('journals/<int:journal_id>/papers/',  views.journal_papers),
    path('authors/',                            views.author_search),
    path('authors/<int:author_id>/profile/',   views.author_profile),
    path('years/',                              views.year_list),
    path('years/<int:year>/profile/',          views.year_profile),
    path('categories/',                          views.category_list),
    path('charts/linechart/',                  views.chart_linechart),
    path('charts/category-linechart/',         views.chart_category_linechart),
    path('charts/barchart/',                   views.chart_barchart),
    path('charts/scatter/',                    views.chart_scatter),
    path('charts/scatter/venue-year/',         views.chart_scatter_venue_year),
]
