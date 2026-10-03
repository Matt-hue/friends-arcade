import { useEffect, useState } from 'react'
import { getScores } from '../api.js'

export default function Leaderboard({ game, refreshKey }) {
  const [scores, setScores] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getScores(game)
      .then((nextScores) => {
        if (active) {
          setScores(nextScores)
          setError(null)
        }
      })
      .catch((e) => {
        if (active) setError({ game, refreshKey, message: e.message })
      })

    return () => {
      active = false
    }
  }, [game, refreshKey])

  const currentError = error?.game === game && error?.refreshKey === refreshKey
    ? error.message
    : null

  return (
    <div className="card">
      <h3>Leaderboard</h3>
      {currentError && <p>{currentError}</p>}
      {scores.length === 0 && !currentError && <p>No scores yet. Be the first!</p>}
      <ol>
        {scores.map((s, i) => (
          <li key={i}>{s.player}: {s.score}</li>
        ))}
      </ol>
    </div>
  )
}
