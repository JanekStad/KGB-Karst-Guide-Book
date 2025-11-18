from django.db import models
from django.contrib.auth.models import User
from boulders.models import BoulderProblem


class Tick(models.Model):
    """Represents a user ticking (completing) a boulder problem"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='ticks'
    )
    problem = models.ForeignKey(
        BoulderProblem, 
        on_delete=models.CASCADE, 
        related_name='ticks'
    )
    date = models.DateField(help_text="Date when the problem was completed")
    notes = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'problem']]
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.user.username} ticked {self.problem} on {self.date}"


class UserList(models.Model):
    """Custom lists that users can create to organize problems"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='lists'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    problems = models.ManyToManyField(
        BoulderProblem, 
        through='ListEntry',
        related_name='user_lists'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}'s list: {self.name}"


class ListEntry(models.Model):
    """Join table for UserList and BoulderProblem with additional metadata"""
    user_list = models.ForeignKey(UserList, on_delete=models.CASCADE)
    problem = models.ForeignKey(BoulderProblem, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, max_length=500)

    class Meta:
        unique_together = [['user_list', 'problem']]
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.problem} in {self.user_list}"

