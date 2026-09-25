import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Agendas from './pages/Agendas'
import ArtifactCategory from './pages/ArtifactCategory'
import Artifacts from './pages/Artifacts'
import FourUps from './pages/FourUps'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/agendas" element={<Agendas />} />
        <Route path="/artifacts" element={<Artifacts />} />
        <Route path="/artifacts/4ups" element={<FourUps />} />
        <Route path="/artifacts/:category" element={<ArtifactCategory />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
