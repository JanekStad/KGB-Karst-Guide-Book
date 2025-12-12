from pathlib import Path
from ariadne import make_executable_schema, load_schema_from_path

from gql.boulders.resolvers import (
    query,
    problem,
    area,
    sector,
    wall,
    city,
)
from gql.comments.resolvers import comment
from gql.comments.mutations import mutation as comment_mutation
from gql.lists.resolvers import tick
from gql.lists.mutations import mutation as tick_mutation
from gql.shared.resolvers import (
    datetime_scalar,
    date_scalar,
    json_scalar,
    user,
)

# Load schema files
base_path = Path(__file__).parent

# Main schema
main_schema = load_schema_from_path(
    base_path / "boulders" / "resources" / "boulders_schema.graphql"
)

# Type definitions
type_defs_list = [
    main_schema,
    load_schema_from_path(
        base_path / "shared" / "resources" / "types" / "scalars.graphql"
    ),
    load_schema_from_path(
        base_path / "shared" / "resources" / "types" / "user.graphql"
    ),
    load_schema_from_path(
        base_path / "boulders" / "resources" / "types" / "types.graphql"
    ),
    load_schema_from_path(
        base_path / "comments" / "resources" / "types" / "types.graphql"
    ),
    load_schema_from_path(
        base_path / "lists" / "resources" / "types" / "types.graphql"
    ),
    load_schema_from_path(
        base_path / "lists" / "resources" / "types" / "inputs.graphql"
    ),
    load_schema_from_path(
        base_path / "comments" / "resources" / "types" / "inputs.graphql"
    ),
]

# Combine all type definitions
type_defs = "\n".join(type_defs_list)



schema = make_executable_schema(
    type_defs,
    query,
    tick_mutation,
    comment_mutation,
    problem,
    area,
    sector,
    wall,
    city,
    comment,
    tick,
    user,
    datetime_scalar,
    date_scalar,
    json_scalar,
)
