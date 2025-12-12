from ariadne import ObjectType

comment = ObjectType("Comment")


@comment.field("content")
def resolve_comment_content(comment_obj, info):
    return comment_obj.content
