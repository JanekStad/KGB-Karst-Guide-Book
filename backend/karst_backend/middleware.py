"""
Custom middleware to ensure UTF-8 charset in API responses.
"""


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
