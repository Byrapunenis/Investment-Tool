import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyForm from './pages/PropertyForm';
import PropertyDetail from './pages/PropertyDetail';
import CashFlow from './pages/CashFlow';
import Team from './pages/Team';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="properties/new" element={<PropertyForm />} />
              <Route path="properties/:id" element={<PropertyDetail />} />
              <Route path="properties/:id/edit" element={<PropertyForm />} />
              <Route path="cash-flow" element={<CashFlow />} />
              <Route path="team" element={<Team />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
