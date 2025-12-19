from collections import defaultdict
from typing import List, Dict, Any
from aiodataloader import DataLoader
from asgiref.sync import sync_to_async
from django.contrib.auth.models import User
from comments.models import Comment
from lists.models import Tick
from lists.services import calculate_problem_statistics


class UserLoader(DataLoader):
    """Batch loads users by ID."""

    async def batch_load_fn(self, user_ids: List[str]) -> List[User]:
        """Load multiple users in a single query."""
        def get_users():
            users = {
                str(user.id): user
                for user in User.objects.filter(id__in=user_ids).select_related("profile")
            }
            return [users.get(str(user_id)) for user_id in user_ids]

        return await sync_to_async(get_users)()


class CommentsByProblemLoader(DataLoader):
    """Batch loads comments grouped by problem ID."""

    async def batch_load_fn(self, problem_ids: List[str]) -> List[List[Comment]]:
        """Load comments for multiple problems in a single query."""
        def get_comments():
            comments_by_problem = defaultdict(list)
            comments = (
                Comment.objects.filter(problem_id__in=problem_ids)
                .select_related("user")
                .order_by("-created_at")
            )
            
            for comment in comments:
                comments_by_problem[str(comment.problem_id)].append(comment)
            
            return [comments_by_problem.get(str(problem_id), []) for problem_id in problem_ids]

        return await sync_to_async(get_comments)()


class TicksByProblemLoader(DataLoader):
    """Batch loads ticks grouped by problem ID."""

    async def batch_load_fn(self, problem_ids: List[str]) -> List[List[Tick]]:
        """Load ticks for multiple problems in a single query."""
        def get_ticks():
            ticks_by_problem = defaultdict(list)
            ticks = (
                Tick.objects.filter(problem_id__in=problem_ids)
                .select_related("user", "user__profile")
                .order_by("-date", "-created_at")
            )
            
            for tick in ticks:
                ticks_by_problem[str(tick.problem_id)].append(tick)
            
            return [ticks_by_problem.get(str(problem_id), []) for problem_id in problem_ids]

        return await sync_to_async(get_ticks)()


class StatisticsByProblemLoader(DataLoader):
    """Batch loads statistics for multiple problems."""

    async def batch_load_fn(self, problem_ids: List[str]) -> List[Dict[str, Any]]:
        """Load statistics for multiple problems in optimized queries."""
        def get_statistics():
            # Load all ticks for all problems in one query
            ticks = (
                Tick.objects.filter(problem_id__in=problem_ids)
                .select_related("user__profile")
                .values(
                    "problem_id",
                    "user__profile__height",
                    "suggested_grade",
                    "rating",
                )
            )
            
            # Group ticks by problem
            ticks_by_problem = defaultdict(list)
            for tick in ticks:
                ticks_by_problem[str(tick["problem_id"])].append(tick)
            
            # Build statistics for each problem
            results = []
            for problem_id in problem_ids:
                problem_ticks = ticks_by_problem.get(str(problem_id), [])
                stats = calculate_problem_statistics(problem_ticks)
                results.append(stats)
            
            return results

        return await sync_to_async(get_statistics)()


class TickCountByProblemLoader(DataLoader):
    """Batch loads tick counts for multiple problems."""

    async def batch_load_fn(self, problem_ids: List[str]) -> List[int]:
        """Load tick counts for multiple problems in a single query."""
        def get_counts():
            from django.db.models import Count
            
            counts = (
                Tick.objects.filter(problem_id__in=problem_ids)
                .values("problem_id")
                .annotate(count=Count("id"))
            )
            
            count_map = {str(item["problem_id"]): item["count"] for item in counts}
            return [count_map.get(str(problem_id), 0) for problem_id in problem_ids]

        return await sync_to_async(get_counts)()


class AvgRatingByProblemLoader(DataLoader):
    """Batch loads average ratings for multiple problems."""

    async def batch_load_fn(self, problem_ids: List[str]) -> List[float]:
        """Load average ratings for multiple problems in a single query."""
        def get_ratings():
            from django.db.models import Avg
            
            ratings = (
                Tick.objects.filter(problem_id__in=problem_ids)
                .values("problem_id")
                .annotate(avg_rating=Avg("rating"))
            )
            
            rating_map = {
                str(item["problem_id"]): round(float(item["avg_rating"]), 2)
                if item["avg_rating"] is not None
                else None
                for item in ratings
            }
            return [rating_map.get(str(problem_id)) for problem_id in problem_ids]

        return await sync_to_async(get_ratings)()


def get_dataloaders(context: Dict) -> Dict[str, DataLoader]:
    if "dataloaders" not in context:
        context["dataloaders"] = {
            "users": UserLoader(),
            "comments_by_problem": CommentsByProblemLoader(),
            "ticks_by_problem": TicksByProblemLoader(),
            "statistics_by_problem": StatisticsByProblemLoader(),
            "tick_count_by_problem": TickCountByProblemLoader(),
            "avg_rating_by_problem": AvgRatingByProblemLoader(),
        }
    return context["dataloaders"]

