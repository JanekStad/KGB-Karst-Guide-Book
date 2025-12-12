from ariadne import QueryType, ObjectType
from django.db.models import Q, Count, Avg
from asgiref.sync import sync_to_async
from boulders.models import BoulderProblem, Area, Sector
from comments.models import Comment
from lists.models import Tick
from users.models import UserProfile

query = QueryType()
problem = ObjectType("BoulderProblem")
area = ObjectType("Area")
sector = ObjectType("Sector")
wall = ObjectType("Wall")
city = ObjectType("City")


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
async def resolve_areas(_, info, cityId=None):
    def get_areas():
        queryset = Area.objects.filter(is_secret=False).select_related("city")
        if cityId:
            queryset = queryset.filter(city_id=cityId)
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
async def resolve_sectors(_, info, areaId=None):
    def get_sectors():
        queryset = Sector.objects.filter(
            area__is_secret=False, is_secret=False
        ).select_related("area")
        if areaId:
            queryset = queryset.filter(area_id=areaId)
        return list(queryset)

    return await sync_to_async(get_sectors)()


# Object field resolvers
@problem.field("statistics")
async def resolve_statistics(problem_obj, info):
    def get_statistics():
        ticks = Tick.objects.filter(problem=problem_obj).select_related("user__profile")

        # Height distribution
        height_stats = {}
        for height_choice in UserProfile.HEIGHT_CHOICES:
            height_value = height_choice[0]
            count = ticks.filter(user__profile__height=height_value).count()
            if count > 0:
                height_stats[height_value] = {"label": height_choice[1], "count": count}

        # Grade voting distribution
        grade_stats = {}
        for grade_choice in Tick.GRADE_CHOICES:
            grade_value = grade_choice[0]
            count = (
                ticks.filter(suggested_grade=grade_value)
                .exclude(suggested_grade__isnull=True)
                .exclude(suggested_grade="")
                .count()
            )
            if count > 0:
                grade_stats[grade_value] = {"label": grade_choice[1], "count": count}

        total_ticks = ticks.count()
        ticks_with_height = (
            ticks.filter(user__profile__height__isnull=False)
            .exclude(user__profile__height="")
            .count()
        )
        ticks_with_grade_vote = (
            ticks.exclude(suggested_grade__isnull=True)
            .exclude(suggested_grade="")
            .count()
        )

        return {
            "totalTicks": total_ticks,
            "heightDistribution": height_stats,
            "gradeVoting": grade_stats,
            "heightDataCount": ticks_with_height,
            "gradeVotesCount": ticks_with_grade_vote,
        }

    return await sync_to_async(get_statistics)()


@problem.field("comments")
async def resolve_comments(problem_obj, info):
    def get_comments():
        return list(
            Comment.objects.filter(problem=problem_obj)
            .select_related("user")
            .order_by("-created_at")
        )

    return await sync_to_async(get_comments)()


@problem.field("ticks")
async def resolve_ticks(problem_obj, info):
    def get_ticks():
        return list(
            Tick.objects.filter(problem=problem_obj)
            .select_related("user", "user__profile")
            .order_by("-date", "-created_at")
        )

    return await sync_to_async(get_ticks)()


@problem.field("tickCount")
async def resolve_tick_count(problem_obj, info):
    def get_count():
        return problem_obj.ticks.count()

    return await sync_to_async(get_count)()


@problem.field("avgRating")
async def resolve_avg_rating(problem_obj, info):
    def get_avg():
        from django.db.models import Avg

        avg = problem_obj.ticks.aggregate(Avg("rating"))["rating__avg"]
        return round(float(avg), 2) if avg else None

    return await sync_to_async(get_avg)()


@area.field("problemCount")
async def resolve_area_problem_count(area_obj, info):
    def get_count():
        return area_obj.problems.filter(area__is_secret=False).count()

    return await sync_to_async(get_count)()


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
