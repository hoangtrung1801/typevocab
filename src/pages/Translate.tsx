import { Navigate, useParams } from 'react-router-dom'
import TranslateSession from '../components/TranslateSession'
import { getDrill } from '../data'

export default function Translate() {
  const { id = '' } = useParams()
  const drill = getDrill(id)
  if (!drill) return <Navigate to="/" replace />
  return <TranslateSession key={drill.id} drill={drill} />
}
