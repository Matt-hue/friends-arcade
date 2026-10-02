import { useEffect, useState } from 'react'
import { getScores } from '../api.js'

export default function Leaderboard({ game, refreshKey }) {
  const [scores, setScores] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    getScores(game).then(setScores).catch((e) => setError(e.message))
  }, [game, refreshKey])

  return (
    <div className="card">
      <h3>Leaderboard</h3>
      {error && <p>{error}</p>}
      {scores.length === 0 && !error && <p>No scores yet. Be the first!</p>}
      <ol>
        {scores.map((s, i) => (
          <li key={i}>{s.player}: {s.score}</li>
        ))}
      </ol>
    </div>
  )
}
