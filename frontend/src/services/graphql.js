import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Use same base URL logic as REST API
const getGraphQLBaseUrl = () => {
  // Check if we have an explicit API URL in environment
  if (import.meta.env.VITE_API_BASE_URL) {
    // Remove /api suffix if present, GraphQL is at root level
    return import.meta.env.VITE_API_BASE_URL.replace('/api', '');
  }
  
  // If accessing from a non-localhost address, use the same hostname
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:8000`;
  }
  
  // Default to localhost for local development
  return 'http://localhost:8000';
};

const httpLink = createHttpLink({
  uri: `${getGraphQLBaseUrl()}/graphql/`,
});

// Add authentication token to requests
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Token ${token}` : '',
    }
  };
});

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

