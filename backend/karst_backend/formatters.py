"""
Custom log formatters and filters that handle missing contextual fields gracefully.
"""

import logging
from datetime import datetime
import json


class ContextualFormatter(logging.Formatter):
    """Formatter that handles missing contextual fields gracefully"""

    def format(self, record):
        # Set defaults for contextual fields if not present
        if not hasattr(record, "request_id"):
            record.request_id = None
        if not hasattr(record, "user_id"):
            record.user_id = None
        if not hasattr(record, "username"):
            record.username = None
        if not hasattr(record, "ip_address"):
            record.ip_address = None
        if not hasattr(record, "attempted_username"):
            record.attempted_username = None

        # Format None values as "-" (more concise than "N/A")
        # Truncate request_id to first 8 chars for readability (full UUID is too long)
        if record.request_id and record.request_id != "-":
            record.request_id_short = (
                record.request_id[:8]
                if len(record.request_id) > 8
                else record.request_id
            )
        else:
            record.request_id_short = "-"

        record.user_id = record.user_id if record.user_id is not None else "-"
        record.username = record.username or "-"
        record.ip_address = record.ip_address or "-"
        record.attempted_username = record.attempted_username or "-"

        return super().format(record)


class ContextualJSONFormatter(logging.Formatter):
    """JSON formatter that handles missing contextual fields gracefully"""

    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add contextual information (will be None if not set)
        log_data["request_id"] = getattr(record, "request_id", None)
        log_data["user_id"] = getattr(record, "user_id", None)
        log_data["username"] = getattr(record, "username", None)
        log_data["ip_address"] = getattr(record, "ip_address", None)

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields from record (exclude internal logging fields)
        excluded_fields = {
            "name",
            "msg",
            "args",
            "created",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "module",
            "msecs",
            "message",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "thread",
            "threadName",
            "exc_info",
            "exc_text",
            "stack_info",
        }

        for key, value in record.__dict__.items():
            if key not in excluded_fields and not key.startswith("_"):
                log_data[key] = value

        return json.dumps(log_data)


class ContextualFilter(logging.Filter):
    """
    Filter that adds contextual information to log records.
    This ensures django.server and other loggers outside middleware also get context.
    Uses lazy import to avoid circular dependencies during Django startup.
    """

    def filter(self, record):
        """Add contextual information from RequestContext if available"""
        # Lazy import to avoid circular dependency during Django startup
        try:
            from karst_backend.contextual_logger import RequestContext

            context = RequestContext.get()
        except (ImportError, AttributeError):
            # If import fails (e.g., during startup), just set defaults
            context = None

        if context:
            # Add contextual fields to record
            record.request_id = context.get("request_id")
            record.user_id = context.get("user_id")
            record.username = context.get("username")
            record.ip_address = context.get("ip_address")
        else:
            # Set defaults if no context
            record.request_id = None
            record.user_id = None
            record.username = None
            record.ip_address = None

        return True  # Always allow the record through
