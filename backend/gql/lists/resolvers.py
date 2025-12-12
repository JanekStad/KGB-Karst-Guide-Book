from ariadne import ObjectType

tick = ObjectType("Tick")


@tick.field("tickGrade")
def resolve_tick_grade(tick_obj, info):
    return tick_obj.tick_grade


@tick.field("suggestedGrade")
def resolve_suggested_grade(tick_obj, info):
    return tick_obj.suggested_grade
