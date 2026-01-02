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
      videoLinks
      externalLinks
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
  query GetAreas($cityId: ID, $search: String) {
    areas(cityId: $cityId, search: $search) {
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
      radiusMeters
      area {
        id
        name
      }
      problemCount
    }
  }
`;

/**
 * Mutations
 */

/**
 * Create a new tick
 */
export const CREATE_TICK = gql`
  mutation CreateTick($input: CreateTickInput!) {
    createTick(input: $input) {
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
      problem {
        id
        name
      }
    }
  }
`;

/**
 * Update an existing tick
 */
export const UPDATE_TICK = gql`
  mutation UpdateTick($id: ID!, $input: UpdateTickInput!) {
    updateTick(id: $id, input: $input) {
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
      problem {
        id
        name
      }
    }
  }
`;

/**
 * Delete a tick
 */
export const DELETE_TICK = gql`
  mutation DeleteTick($id: ID!) {
    deleteTick(id: $id)
  }
`;

/**
 * Create a new comment
 */
export const CREATE_COMMENT = gql`
  mutation CreateComment($input: CreateCommentInput!) {
    createComment(input: $input) {
      id
      content
      created_at
      updated_at
      edited
      user {
        id
        username
      }
      problem {
        id
        name
      }
    }
  }
`;

/**
 * Update video links for a boulder problem
 */
export const UPDATE_PROBLEM_VIDEO_LINKS = gql`
  mutation UpdateProblemVideoLinks($id: ID!, $input: UpdateProblemVideoLinksInput!) {
    updateProblemVideoLinks(id: $id, input: $input) {
      id
      name
      videoLinks
    }
  }
`;

/**
 * Universal search query across problems, areas, sectors, and users
 */
export const UNIVERSAL_SEARCH = gql`
  query UniversalSearch($query: String!) {
    search(query: $query) {
      problems {
        id
        name
        grade
        description
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
      areas {
        id
        name
        description
        city {
          id
          name
        }
        problemCount
      }
      sectors {
        id
        name
        description
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
      users {
        id
        username
        email
      }
    }
  }
`;

/**
 * Get list of users with optional search
 */
export const GET_USERS = gql`
  query GetUsers($search: String) {
    users(search: $search) {
      id
      username
      email
    }
  }
`;

