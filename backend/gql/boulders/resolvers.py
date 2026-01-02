from ariadne import QueryType, ObjectType
from django.db.models import Q, Count, Avg
from asgiref.sync import sync_to_async
from django.contrib.auth.models import User
from boulders.models import BoulderProblem, Area, Sector
from ..dataloaders import get_dataloaders

query = QueryType()
problem = ObjectType("BoulderProblem")
area = ObjectType("Area")
sector = ObjectType("Sector")
wall = ObjectType("Wall")
city = ObjectType("City")
search_results = ObjectType("SearchResults")


# Query resolvers
@query.field("problem")
async def resolve_problem(_, info, id):
    def get_problem():
        try:
            return (
                BoulderProblem.objects.select_related(
                    "area", "sector", "wall", "author", "created_by"
                )
                .prefetch_related("ticks", "comments")
                .get(id=id)
            )
        except BoulderProblem.DoesNotExist:
            return None

    result = await sync_to_async(get_problem)()
    # Check if area is secret
    if result and result.area and result.area.is_secret:
        return None
    return result


@query.field("problems")
async def resolve_problems(
    _, info, areaId=None, sectorId=None, wallId=None, search=None
):
    def get_problems():
        queryset = BoulderProblem.objects.filter(area__is_secret=False)

        if areaId:
            queryset = queryset.filter(area_id=areaId)
        if sectorId:
            queryset = queryset.filter(sector_id=sectorId)
        if wallId:
            queryset = queryset.filter(wall_id=wallId)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        return list(
            queryset.select_related("area", "sector", "wall", "author")
            .prefetch_related("ticks")
            .annotate(
                tick_count_annotated=Count("ticks", distinct=True),
                avg_rating_annotated=Avg("ticks__rating"),
            )
        )

    return await sync_to_async(get_problems)()


@query.field("area")
async def resolve_area(_, info, id):
    def get_area():
        try:
            area_obj = Area.objects.select_related("city").get(id=id)
            if area_obj.is_secret:
                return None
            return area_obj
        except Area.DoesNotExist:
            return None

    return await sync_to_async(get_area)()


@query.field("areas")
async def resolve_areas(_, info, cityId=None, search=None):
    def get_areas():
        from boulders.utils import normalize_problem_name

        queryset = Area.objects.filter(is_secret=False).select_related("city")
        if cityId:
            queryset = queryset.filter(city_id=cityId)
        if search:
            # Use normalized search for diacritic-insensitive matching
            normalized_search = normalize_problem_name(search)
            queryset = queryset.filter(
                Q(name_normalized__icontains=normalized_search)
                | Q(description__icontains=normalized_search)
                | Q(city__name_normalized__icontains=normalized_search)
            ).distinct()
        return list(queryset)

    return await sync_to_async(get_areas)()


@query.field("sector")
async def resolve_sector(_, info, id):
    def get_sector():
        try:
            sector_obj = Sector.objects.select_related("area").get(id=id)
            if sector_obj.is_secret or (sector_obj.area and sector_obj.area.is_secret):
                return None
            return sector_obj
        except Sector.DoesNotExist:
            return None

    return await sync_to_async(get_sector)()


@query.field("sectors")
async def resolve_sectors(_, info, areaId=None, search=None):
    def get_sectors():
        from boulders.utils import normalize_problem_name

        queryset = Sector.objects.filter(
            area__is_secret=False, is_secret=False
        ).select_related("area")
        if areaId:
            queryset = queryset.filter(area_id=areaId)
        if search:
            normalized_search = normalize_problem_name(search)
            queryset = queryset.filter(
                Q(name_normalized__icontains=normalized_search)
                | Q(description__icontains=search)
            )
        return list(queryset)

    return await sync_to_async(get_sectors)()


# Object field resolvers
@problem.field("statistics")
async def resolve_statistics(problem_obj, info):
    """Resolve statistics using DataLoader to batch queries."""
    dataloaders = get_dataloaders(info.context)
    return await dataloaders["statistics_by_problem"].load(str(problem_obj.id))


@problem.field("comments")
async def resolve_comments(problem_obj, info):
    """Resolve comments using DataLoader to batch queries."""
    dataloaders = get_dataloaders(info.context)
    return await dataloaders["comments_by_problem"].load(str(problem_obj.id))


@problem.field("ticks")
async def resolve_ticks(problem_obj, info):
    """Resolve ticks using DataLoader to batch queries."""
    dataloaders = get_dataloaders(info.context)
    return await dataloaders["ticks_by_problem"].load(str(problem_obj.id))


@problem.field("tickCount")
async def resolve_tick_count(problem_obj, info):
    """Resolve tick count using DataLoader to batch queries."""
    dataloaders = get_dataloaders(info.context)
    return await dataloaders["tick_count_by_problem"].load(str(problem_obj.id))


@problem.field("avgRating")
async def resolve_avg_rating(problem_obj, info):
    """Resolve average rating using DataLoader to batch queries."""
    dataloaders = get_dataloaders(info.context)
    return await dataloaders["avg_rating_by_problem"].load(str(problem_obj.id))


@problem.field("videoLinks")
async def resolve_video_links(problem_obj, info):
    """Resolve video links from the model."""
    return problem_obj.video_links if problem_obj.video_links else []


@problem.field("externalLinks")
async def resolve_external_links(problem_obj, info):
    """Resolve external links from the model."""
    return problem_obj.external_links if problem_obj.external_links else []


@area.field("problemCount")
async def resolve_area_problem_count(area_obj, info):
    def get_count():
        return area_obj.problems.filter(area__is_secret=False).count()

    return await sync_to_async(get_count)()


@sector.field("radiusMeters")
async def resolve_sector_radius_meters(sector_obj, info):
    """Resolve radius_meters field (snake_case to camelCase)"""
    return float(sector_obj.radius_meters) if sector_obj.radius_meters else None


@sector.field("problemCount")
async def resolve_sector_problem_count(sector_obj, info):
    def get_count():
        return sector_obj.problems.filter(area__is_secret=False).count()

    return await sync_to_async(get_count)()


@wall.field("problemCount")
async def resolve_wall_problem_count(wall_obj, info):
    def get_count():
        return wall_obj.problems.filter(area__is_secret=False).count()

    return await sync_to_async(get_count)()


@query.field("users")
async def resolve_users(_, info, search=None):
    def get_users():
        queryset = User.objects.all()
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        return list(queryset[:50])  # Limit to 50 results

    return await sync_to_async(get_users)()


@query.field("search")
async def resolve_search(_, info, query):
    """Universal search across problems, areas, sectors, and users."""

    def perform_search():
        from boulders.utils import normalize_problem_name

        normalized_query = normalize_problem_name(query)

        # Search problems
        problems = list(
            BoulderProblem.objects.filter(area__is_secret=False)
            .filter(Q(name__icontains=query) | Q(description__icontains=query))
            .select_related("area", "sector", "wall", "author")
            .prefetch_related("ticks")
            .annotate(
                tick_count_annotated=Count("ticks", distinct=True),
                avg_rating_annotated=Avg("ticks__rating"),
            )[
                :10
            ]  # Limit to 10 results
        )

        # Search areas
        areas = list(
            Area.objects.filter(is_secret=False)
            .filter(
                Q(name_normalized__icontains=normalized_query)
                | Q(description__icontains=query)
                | Q(city__name_normalized__icontains=normalized_query)
            )
            .select_related("city")
            .distinct()[:10]
        )

        # Search sectors
        sectors = list(
            Sector.objects.filter(area__is_secret=False, is_secret=False)
            .filter(
                Q(name_normalized__icontains=normalized_query)
                | Q(description__icontains=query)
            )
            .select_related("area", "area__city")[:10]
        )

        # Search users
        users = list(
            User.objects.filter(
                Q(username__icontains=query) | Q(email__icontains=query)
            )[:10]
        )

        return {
            "problems": problems,
            "areas": areas,
            "sectors": sectors,
            "users": users,
        }

    return await sync_to_async(perform_search)()
