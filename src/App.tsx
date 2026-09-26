import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Agendas from './pages/Agendas'
import ArtifactCategory from './pages/ArtifactCategory'
import Artifacts from './pages/Artifacts'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agendas" element={<Agendas />} />
        <Route path="/artifacts" element={<Artifacts />} />
        {/* 4Ups moved out of Artifacts; keep old links working. */}
        <Route path="/artifacts/4ups" element={<Navigate to="/agendas?show=4ups" replace />} />
        <Route path="/artifacts/:category" element={<ArtifactCategory />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
