from ariadne import ScalarType, ObjectType
from datetime import datetime, date
import json

# Scalar resolvers
datetime_scalar = ScalarType("DateTime")
date_scalar = ScalarType("Date")
json_scalar = ScalarType("JSONString")

user = ObjectType("User")


@datetime_scalar.serializer
def serialize_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@datetime_scalar.value_parser
def parse_datetime_value(value):
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@date_scalar.serializer
def serialize_date(value):
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


@date_scalar.value_parser
def parse_date_value(value):
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


@json_scalar.serializer
def serialize_json(value):
    if isinstance(value, str):
        return value
    return json.dumps(value)


@json_scalar.value_parser
def parse_json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value
