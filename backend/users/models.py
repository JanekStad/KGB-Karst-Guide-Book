from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """Extended user profile with additional information"""

    HEIGHT_CHOICES = [
        ("<150", "<150 cm"),
        ("150-155", "150-155 cm"),
        ("155-160", "155-160 cm"),
        ("160-165", "160-165 cm"),
        ("165-170", "165-170 cm"),
        ("170-175", "170-175 cm"),
        ("175-180", "175-180 cm"),
        ("180-185", "180-185 cm"),
        ("185-190", "185-190 cm"),
        ("190-195", "190-195 cm"),
        (">195", ">195 cm"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True, max_length=500)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    location = models.CharField(max_length=100, blank=True)
    height = models.CharField(
        max_length=10,
        choices=HEIGHT_CHOICES,
        blank=True,
        null=True,
        help_text="Height category in centimeters",
    )
    ape_index = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Ape index (wingspan - height) in centimeters. Positive means longer wingspan.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

    @property
    def tick_count(self):
        """Total number of problems ticked by this user"""
        from lists.models import Tick

        return Tick.objects.filter(user=self.user).count()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a profile automatically when a user is created"""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Save the profile when user is saved"""
    if hasattr(instance, "profile"):
        instance.profile.save()
