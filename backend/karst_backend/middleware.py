"""
Custom middleware for the Karst backend.
"""

import time
from django.utils.deprecation import MiddlewareMixin
from karst_backend.contextual_logger import (
    get_logger,
    set_request_context,
    clear_request_context,
    generate_request_id,
    bind_user,
    bind_ip_address,
)

logger = get_logger("karst_backend")


class RequestContextMiddleware(MiddlewareMixin):
    """
    Middleware that sets up contextual logging for each request.
    Generates a unique request ID and binds user/IP information.
    """

    def process_request(self, request):
        """Set up request context for logging"""
        # Generate unique request ID
        request_id = generate_request_id()
        request.request_id = request_id  # Store on request for access in views

        # Get client IP
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.META.get("REMOTE_ADDR", "unknown")

        # Get user information (may not be authenticated yet)
        user = getattr(request, "user", None)
        user_id = None
        username = None
        if user and hasattr(user, "is_authenticated") and user.is_authenticated:
            user_id = user.id
            username = user.username

        # Set request context for logging
        set_request_context(
            request_id=request_id,
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            method=request.method,
            path=request.path,
        )

        # Bind to contextual logger
        bind_user(user if user else None)
        bind_ip_address(ip_address)

    def process_response(self, request, response):
        """Clear request context after response"""
        clear_request_context()
        return response

    def process_exception(self, request, exception):
        """Clear context even on exceptions"""
        clear_request_context()


class UTF8CharsetMiddleware:
    """
    Middleware to ensure Content-Type header includes charset=utf-8
    for JSON responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Ensure JSON responses have charset=utf-8
        content_type = response.get("Content-Type", "")
        if "application/json" in content_type and "charset" not in content_type:
            response["Content-Type"] = "application/json; charset=utf-8"

        return response


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log HTTP requests and responses with timing information.
    Uses contextual logger for automatic inclusion of request ID, user, IP.
    Logs slow requests (>1 second) as warnings.
    """

    def process_request(self, request):
        """Store request start time"""
        request._start_time = time.time()

    def process_response(self, request, response):
        """Log request/response information with contextual information"""
        # Update user context if authentication happened (e.g., token auth)
        user = getattr(request, "user", None)
        if user and hasattr(user, "is_authenticated") and user.is_authenticated:
            bind_user(user)

        # Calculate request duration
        duration = time.time() - getattr(request, "_start_time", time.time())
        duration_ms = duration * 1000

        # Prepare log data (contextual info is automatically added by logger)
        log_data = {
            "type": "http_request",
            "method": request.method,
            "path": request.path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "query_string": request.META.get("QUERY_STRING", "")[:200],  # Truncate
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:200],  # Truncate
            "referer": request.META.get("HTTP_REFERER", "")[:200],  # Truncate
        }

        # Log based on status code and duration
        if response.status_code >= 500:
            logger.error(
                f"{request.method} {request.path} returned {response.status_code}",
                extra=log_data,
            )
        elif response.status_code >= 400:
            logger.warning(
                f"{request.method} {request.path} returned {response.status_code}",
                extra=log_data,
            )
        elif duration_ms > 1000:  # Slow request (>1 second)
            logger.warning(
                f"Slow request: {request.method} {request.path} took {duration_ms:.0f}ms",
                extra=log_data,
            )
        else:
            logger.info(
                f"{request.method} {request.path} returned {response.status_code}",
                extra=log_data,
            )

        return response
