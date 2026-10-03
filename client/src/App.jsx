import { useState } from 'react'
import { games } from './games/index.js'
import Leaderboard from './components/Leaderboard.jsx'
import PhoneController from './components/PhoneController.jsx'

export default function App() {
  const [gameId, setGameId] = useState(games[0].id)
  const [refreshKey, setRefreshKey] = useState(0)
  if (new URLSearchParams(window.location.search).has('controller')) return <PhoneController />
  const game = games.find((g) => g.id === gameId)
  const Game = game.component

  return (
    <div className="container">
      <h1>Friends Arcade</h1>
      <p><a href="?controller=1">Phone controller</a></p>
      <nav>
        {games.map((g) => (
          <button key={g.id} onClick={() => setGameId(g.id)} disabled={g.id === gameId}>{g.title}</button>
        ))}
      </nav>
      <Game onScoreSubmitted={() => setRefreshKey((k) => k + 1)} />
      <Leaderboard game={game.id} refreshKey={refreshKey} />
    </div>
  )
}
