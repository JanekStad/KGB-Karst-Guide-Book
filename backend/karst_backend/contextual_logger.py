"""
Contextual logger that binds request-specific context to all log entries.

This allows logging with automatic inclusion of:
- Request ID (unique per request)
- User ID and username
- IP address
- Other contextual information

Usage:
    from karst_backend.contextual_logger import get_logger, RequestContext
    
    logger = get_logger(__name__)
    logger.info("User logged in", extra={"action": "login"})
    # Automatically includes: request_id, user_id, username, ip_address
    
    # Manage context
    RequestContext.set(request_id="abc", user_id=123, username="testuser")
    RequestContext.bind_user(user)
    RequestContext.clear()
"""

import logging
import threading
import uuid
from typing import Optional, Dict, Any
from django.contrib.auth.models import AnonymousUser


class ContextAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically adds contextual information to log records.
    """

    def process(self, msg, kwargs):
        """Add contextual information to log record"""
        # Get context from RequestContext
        context = RequestContext.get()
        
        # Merge context with extra kwargs
        if "extra" not in kwargs:
            kwargs["extra"] = {}
        
        # Add contextual fields with defaults
        kwargs["extra"].update({
            "request_id": context.get("request_id") if context else None,
            "user_id": context.get("user_id") if context else None,
            "username": context.get("username") if context else None,
            "ip_address": context.get("ip_address") if context else None,
        })
        
        return msg, kwargs


class RequestContext:
    """
    Manages request-specific context for logging.
    
    Uses thread-local storage to maintain context per request thread.
    All context operations are class methods for easy access.
    """
    
    # Thread-local storage for request context
    _context = threading.local()
    
    @classmethod
    def set(
        cls,
        request_id: Optional[str] = None,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        ip_address: Optional[str] = None,
        **kwargs
    ) -> None:
        """
        Set contextual information for the current request thread.
        
        Args:
            request_id: Unique request ID (UUID)
            user_id: Authenticated user ID
            username: Username
            ip_address: Client IP address
            **kwargs: Additional contextual fields
        """
        cls._context.data = {
            "request_id": request_id,
            "user_id": user_id,
            "username": username,
            "ip_address": ip_address,
            **kwargs,
        }
    
    @classmethod
    def get(cls) -> Optional[Dict[str, Any]]:
        """Get contextual information for the current request thread."""
        return getattr(cls._context, "data", None)
    
    @classmethod
    def clear(cls) -> None:
        """Clear contextual information (call at end of request)."""
        if hasattr(cls._context, "data"):
            delattr(cls._context, "data")
    
    @classmethod
    def generate_request_id(cls) -> str:
        """Generate a unique request ID (UUID)."""
        return str(uuid.uuid4())
    
    @classmethod
    def bind_user(cls, user) -> None:
        """
        Bind user information to request context.
        
        Args:
            user: Django User instance or AnonymousUser
        """
        context = cls.get() or {}
        
        if user and not isinstance(user, AnonymousUser):
            context["user_id"] = user.id
            context["username"] = user.username
        else:
            context["user_id"] = None
            context["username"] = None
        
        cls.set(**context)
    
    @classmethod
    def bind_request_id(cls, request_id: str) -> None:
        """Bind request ID to context."""
        context = cls.get() or {}
        context["request_id"] = request_id
        cls.set(**context)
    
    @classmethod
    def bind_ip_address(cls, ip_address: str) -> None:
        """Bind IP address to context."""
        context = cls.get() or {}
        context["ip_address"] = ip_address
        cls.set(**context)


# Convenience functions for backward compatibility and ease of use
def get_logger(name: str) -> logging.LoggerAdapter:
    """
    Get a contextual logger for the given name.
    
    Usage:
        logger = get_logger(__name__)
        logger.info("Message")
        logger.error("Error occurred", extra={"error_code": "E001"})
    """
    base_logger = logging.getLogger(name)
    return ContextAdapter(base_logger, {})


# Alias class methods as module-level functions for convenience
set_request_context = RequestContext.set
get_request_context = RequestContext.get
clear_request_context = RequestContext.clear
generate_request_id = RequestContext.generate_request_id
bind_user = RequestContext.bind_user
bind_request_id = RequestContext.bind_request_id
bind_ip_address = RequestContext.bind_ip_address
