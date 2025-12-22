"""
Custom filters for boulders app that support diacritic-insensitive search.
"""
from rest_framework import filters
from django.db.models import Q
from .utils import normalize_problem_name


class NormalizedSearchFilter(filters.SearchFilter):
    """
    Custom search filter that uses name_normalized fields for diacritic-insensitive search.
    
    This filter:
    - Normalizes the search term before searching
    - Uses name_normalized fields when available
    - Falls back to regular fields for non-name fields (like description)
    """
    
    def filter_queryset(self, request, queryset, view):
        search_terms = self.get_search_terms(request)
        if not search_terms:
            return queryset
        
        # Normalize search terms
        normalized_terms = [normalize_problem_name(term) for term in search_terms]
        
        # Get search fields from view
        search_fields = self.get_search_fields(view, request)
        if not search_fields:
            return queryset
        
        # Build Q objects for normalized search
        # DRF SearchFilter uses AND between terms, OR between fields
        conditions = None
        
        for term in normalized_terms:
            term_conditions = Q()
            
            for field in search_fields:
                # Check if this field has a normalized version
                # Map regular fields to their normalized equivalents
                if field == 'name':
                    # Use name_normalized for direct name field
                    term_conditions |= Q(name_normalized__icontains=term)
                elif field == 'area__name':
                    # Use area__name_normalized for related area name
                    term_conditions |= Q(area__name_normalized__icontains=term)
                elif field == 'sector__name':
                    # Use sector__name_normalized for related sector name
                    term_conditions |= Q(sector__name_normalized__icontains=term)
                elif field == 'wall__name':
                    # Use wall__name_normalized for related wall name
                    term_conditions |= Q(wall__name_normalized__icontains=term)
                elif field == 'city__name':
                    # Use city__name_normalized for related city name
                    term_conditions |= Q(city__name_normalized__icontains=term)
                elif field == 'description':
                    # Description doesn't have normalized version, use regular search
                    # But normalize the search term for better matching
                    term_conditions |= Q(description__icontains=term)
                else:
                    # For other fields, use regular search with normalized term
                    term_conditions |= Q(**{f"{field}__icontains": term})
            
            # AND between terms (all terms must match)
            if conditions is None:
                conditions = term_conditions
            else:
                conditions &= term_conditions
        
        if conditions is None:
            return queryset
        
        return queryset.filter(conditions).distinct()

