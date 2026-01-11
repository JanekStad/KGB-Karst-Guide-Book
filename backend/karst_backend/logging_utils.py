"""
Logging utilities for structured logging across the application.
"""

import logging
import time
from typing import Optional, Dict, Any
from django.contrib.auth.models import AnonymousUser
from karst_backend.contextual_logger import get_logger

# Get contextual loggers for different components
logger = get_logger("karst_backend")
gql_logger = get_logger("gql")
request_logger = get_logger("django.request")


def log_graphql_query(
    query_string: str,
    variables: Optional[Dict[str, Any]] = None,
    operation_name: Optional[str] = None,
    user=None,
    duration_ms: Optional[float] = None,
    is_mutation: bool = False,
    errors: Optional[list] = None,
):
    """
    Log a GraphQL query/mutation with structured data.
    
    Args:
        query_string: The GraphQL query string
        variables: Query variables (sanitized)
        operation_name: Operation name if specified
        user: User object or None for anonymous
        duration_ms: Query execution time in milliseconds
        is_mutation: Whether this is a mutation
        errors: List of errors if any
    """
    log_data = {
        "type": "graphql",
        "operation": "mutation" if is_mutation else "query",
        "operation_name": operation_name,
        "user_id": user.id if user and not isinstance(user, AnonymousUser) else None,
        "username": user.username if user and not isinstance(user, AnonymousUser) else None,
        "is_authenticated": user.is_authenticated if user else False,
        "query_length": len(query_string),
        "variables_count": len(variables) if variables else 0,
    }

    if duration_ms is not None:
        log_data["duration_ms"] = duration_ms
        # Log slow queries as warnings
        if duration_ms > 1000:  # > 1 second
            gql_logger.warning("Slow GraphQL query", extra=log_data)
        else:
            gql_logger.info("GraphQL query executed", extra=log_data)
    else:
        gql_logger.info("GraphQL query received", extra=log_data)

    if errors:
        log_data["error_count"] = len(errors)
        gql_logger.error("GraphQL query errors", extra=log_data, exc_info=True)


def log_authentication_failure(
    username: Optional[str] = None,
    reason: str = "authentication_failed",
    ip_address: Optional[str] = None,
):
    """
    Log authentication failure attempts with contextual information.
    Context (request_id, ip_address, etc.) is automatically included.
    """
    username_str = username or "(none)"
    logger.warning(
        f"Authentication failure: {reason} for username '{username_str}'",
        extra={
            "type": "auth_failure",
            "action": "login_failed",
            "reason": reason,
            "attempted_username": username,  # Store for structured logging
        },
    )


def log_rate_limit_exceeded(
    user=None,
    endpoint: str = "",
    throttle_scope: str = "",
    ip_address: Optional[str] = None,
):
    """
    Log rate limit exceeded events.
    Context (request_id, user_id, username, ip_address) is automatically included.
    """
    logger.warning(
        f"Rate limit exceeded: {throttle_scope} on {endpoint}",
        extra={
            "type": "rate_limit",
            "action": "rate_limit_exceeded",
            "endpoint": endpoint,
            "throttle_scope": throttle_scope,
        },
    )


def log_slow_query(
    query: str,
    duration_ms: float,
    model: Optional[str] = None,
    user=None,
):
    """Log slow database queries."""
    logger.warning(
        "Slow database query",
        extra={
            "type": "slow_query",
            "query": query[:500],  # Truncate long queries
            "duration_ms": duration_ms,
            "model": model,
            "user_id": user.id if user and not isinstance(user, AnonymousUser) else None,
        },
    )


class QueryTimer:
    """Context manager for timing queries/operations."""

    def __init__(self, operation_name: str, logger_instance: Optional[logging.Logger] = None):
        self.operation_name = operation_name
        self.logger = logger_instance or logger
        self.start_time = None
        self.duration_ms = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration_ms = (time.time() - self.start_time) * 1000
        if exc_type is not None:
            self.logger.error(
                f"{self.operation_name} failed",
                extra={
                    "operation": self.operation_name,
                    "duration_ms": self.duration_ms,
                    "error_type": exc_type.__name__,
                },
                exc_info=(exc_type, exc_val, exc_tb),
            )
        else:
            self.logger.debug(
                f"{self.operation_name} completed",
                extra={
                    "operation": self.operation_name,
                    "duration_ms": self.duration_ms,
                },
            )
        return False  # Don't suppress exceptions
