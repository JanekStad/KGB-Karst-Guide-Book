from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class AnonBurstRateThrottle(AnonRateThrottle):
    """Rate limit for anonymous users - burst requests"""

    scope = "anon_burst"


class AnonSustainedRateThrottle(AnonRateThrottle):
    """Rate limit for anonymous users - sustained requests"""

    scope = "anon_sustained"


class UserBurstRateThrottle(UserRateThrottle):
    """Rate limit for authenticated users - burst requests"""

    scope = "user_burst"


class UserSustainedRateThrottle(UserRateThrottle):
    """Rate limit for authenticated users - sustained requests"""

    scope = "user_sustained"


class MutationRateThrottle(UserRateThrottle):
    """Stricter rate limit for mutations (create, update, delete operations)"""

    scope = "mutations"


class AnonMutationRateThrottle(AnonRateThrottle):
    """Rate limit for anonymous mutation attempts (should be very strict)"""

    scope = "anon_mutations"
