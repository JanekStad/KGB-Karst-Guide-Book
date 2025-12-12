"""
Comments app-specific test fixtures.
Boulder-related fixtures are defined in tests/conftest.py and available globally.
This file can be used for comments-specific fixtures if needed in the future.
"""

# Boulder-related fixtures are now in tests/conftest.py
# Keep this file for comments-specific fixtures if needed


@pytest.fixture
def multiple_problems(db, area, sector, wall, user):
    problems = []
    grades = ["6A", "6B", "7A", "7B", "8A"]
    for i, grade in enumerate(grades):
        problem = BoulderProblem.objects.create(
            area=area,
            sector=sector,
            wall=wall,
            name=f"Problem {i+1}",
            description=f"Test problem {i+1}",
            grade=grade,
            created_by=user,
        )
        problems.append(problem)
    return problems
