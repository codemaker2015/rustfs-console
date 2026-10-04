import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import BucketList from './components/BucketList'
import FileList from './components/FileList'
import FileUpload from './components/FileUpload'

export default function App() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<Navigate to="/buckets" replace />} />
          <Route path="/buckets" element={<BucketList />} />
          <Route path="/files" element={<FileList />} />
          <Route path="/upload" element={<FileUpload />} />
          <Route path="*" element={<Navigate to="/buckets" replace />} />
        </Routes>
      </main>
    </>
  )
}
