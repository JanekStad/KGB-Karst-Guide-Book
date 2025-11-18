import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { AuthProvider } from './contexts/AuthContext';
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
import Register from './pages/Register';

function App() {
  console.log('🎯 App component rendering');
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
              <Route path="/crags" element={<Crags />} />
              <Route path="/crags/add" element={<AddCrag />} />
              <Route path="/crags/:id" element={<CragDetail />} />
              <Route path="/crags/:cragId/problems/add" element={<AddProblem />} />
              <Route path="/problems" element={<Problems />} />
              <Route path="/problems/add" element={<AddProblem />} />
              <Route path="/problems/:id" element={<ProblemDetail />} />
              <Route path="/my-lists" element={<MyLists />} />
              <Route path="/my-ticks" element={<MyTicks />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
