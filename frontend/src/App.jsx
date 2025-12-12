import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { AuthProvider } from './contexts/AuthContext';
import { apolloClient } from './services/graphql';
import AddCrag from './pages/AddCrag';
import AddProblem from './pages/AddProblem';
import CragDetail from './pages/CragDetail';
import Crags from './pages/Crags';
import Home from './pages/Home';
import Login from './pages/Login';
import MyLists from './pages/MyLists';
import MyTicks from './pages/MyTicks';
import ProblemDetail from './pages/ProblemDetail';
import Problems from './pages/Problems';
import Profile from './pages/Profile';
import Register from './pages/Register';
import SectorDetail from './pages/SectorDetail';
import UserDiary from './pages/UserDiary';

function App() {
  console.log('🎯 App component rendering');
  
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <AuthProvider>
          <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  {/* Explore route (primary) */}
                  <Route path="/explore" element={<Crags />} />
                  {/* Areas routes (primary) */}
                  <Route path="/areas" element={<Crags />} />
                  <Route path="/areas/add" element={<AddCrag />} />
                  <Route path="/areas/:id" element={<CragDetail />} />
                  <Route path="/areas/:areaId/problems/add" element={<AddProblem />} />
                  {/* Crags routes (backward compatibility aliases) */}
                  <Route path="/crags" element={<Crags />} />
                  <Route path="/crags/add" element={<AddCrag />} />
                  <Route path="/crags/:id" element={<CragDetail />} />
                  <Route path="/crags/:cragId/problems/add" element={<AddProblem />} />
                  {/* Sectors routes */}
                  <Route path="/sectors/:id" element={<SectorDetail />} />
                  {/* Problems routes (kept for direct links/bookmarks) */}
                  <Route path="/problems" element={<Problems />} />
                  <Route path="/problems/add" element={<AddProblem />} />
                  <Route path="/problems/:id" element={<ProblemDetail />} />
                  <Route path="/problems/:id/edit" element={<AddProblem />} />
                  <Route path="/my-lists" element={<MyLists />} />
                  <Route path="/my-ticks" element={<MyTicks />} />
                  <Route path="/users/:userId/diary" element={<UserDiary />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </Router>
      </AuthProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default App;
