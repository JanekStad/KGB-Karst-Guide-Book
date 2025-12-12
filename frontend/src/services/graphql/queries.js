import { gql } from '@apollo/client';

/**
 * Get complete problem detail with all related data in a single query
 * This replaces 4 separate REST API calls:
 * - GET /api/problems/{id}
 * - GET /api/comments/?problem={id}
 * - GET /api/problems/{id}/statistics/
 * - GET /api/ticks/problem_ticks/?problem={id}
 */
export const GET_PROBLEM_DETAIL = gql`
  query GetProblemDetail($id: ID!) {
    problem(id: $id) {
      id
      name
      grade
      description
      rating
      area {
        id
        name
        description
        city {
          id
          name
        }
      }
      sector {
        id
        name
        description
        latitude
        longitude
      }
      wall {
        id
        name
      }
      author {
        id
        username
      }
      statistics {
        totalTicks
        heightDistribution
        gradeVoting
        heightDataCount
        gradeVotesCount
      }
      comments {
        id
        content
        created_at
        updated_at
        edited
        user {
          id
          username
        }
      }
      ticks {
        id
        date
        notes
        tickGrade
        suggestedGrade
        rating
        user {
          id
          username
        }
      }
      tickCount
      avgRating
    }
  }
`;

/**
 * Get list of problems with optional filters
 */
export const GET_PROBLEMS = gql`
  query GetProblems($areaId: ID, $sectorId: ID, $wallId: ID, $search: String) {
    problems(areaId: $areaId, sectorId: $sectorId, wallId: $wallId, search: $search) {
      id
      name
      grade
      description
      rating
      area {
        id
        name
      }
      sector {
        id
        name
      }
      tickCount
      avgRating
    }
  }
`;

/**
 * Get single area with related data
 */
export const GET_AREA = gql`
  query GetArea($id: ID!) {
    area(id: $id) {
      id
      name
      description
      city {
        id
        name
      }
      problemCount
    }
  }
`;

/**
 * Get list of areas
 */
export const GET_AREAS = gql`
  query GetAreas($cityId: ID) {
    areas(cityId: $cityId) {
      id
      name
      description
      city {
        id
        name
      }
      problemCount
    }
  }
`;

/**
 * Get single sector with related data
 */
export const GET_SECTOR = gql`
  query GetSector($id: ID!) {
    sector(id: $id) {
      id
      name
      description
      latitude
      longitude
      area {
        id
        name
        city {
          id
          name
        }
      }
      problemCount
    }
  }
`;

/**
 * Get list of sectors
 */
export const GET_SECTORS = gql`
  query GetSectors($areaId: ID) {
    sectors(areaId: $areaId) {
      id
      name
      description
      latitude
      longitude
      area {
        id
        name
      }
      problemCount
    }
  }
`;

