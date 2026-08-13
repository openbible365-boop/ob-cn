import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Verses from './pages/Verses';
import Books from './pages/Books';
import Versions from './pages/Versions';
import Audio from './pages/Audio';
import StudyNotes from './pages/StudyNotes';
import { ReadingStats } from './pages/ReadingStats';
import { AudioStats } from './pages/AudioStats';
import { LoginStats } from './pages/LoginStats';
import { AILogs } from './pages/AILogs';
import ReadingPlans from './pages/ReadingPlans';
import UserPlans from './pages/UserPlans';
import Spiritual from './pages/Spiritual';
import SettingsPage from './pages/Settings';
import AIEval from './pages/AIEval';
import MediaManage from './pages/MediaManage';
import EncyclopediaManage from './pages/EncyclopediaManage';
import SupportPlans from './pages/SupportPlans';

function App() {
  // NOTE: 生产环境 Vercel 部署在 /admin/ 前缀下，需告知 React Router
  // 本地开发 vite dev server 无前缀，用 '/'
  const basename = import.meta.env.PROD ? '/admin' : '/';

  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          
          <Route path="stats/reading" element={<ReadingStats />} />
          <Route path="stats/audio" element={<AudioStats />} />
          <Route path="stats/login" element={<LoginStats />} />
          <Route path="ai-logs" element={<AILogs />} />

          <Route path="versions" element={<Versions />} />
          <Route path="audio" element={<Audio />} />
          <Route path="books" element={<Books />} />
          <Route path="users" element={<Users />} />
          <Route path="verses" element={<Verses />} />
          <Route path="study-notes" element={<StudyNotes />} />
          <Route path="reading-plans" element={<ReadingPlans />} />
          <Route path="user-plans" element={<UserPlans />} />
          <Route path="support-plans" element={<SupportPlans />} />
          <Route path="spiritual" element={<Spiritual />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="ai-eval" element={<AIEval />} />
          <Route path="media" element={<MediaManage />} />
          <Route path="encyclopedia" element={<EncyclopediaManage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
