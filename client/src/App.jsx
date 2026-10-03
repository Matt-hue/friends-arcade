import { useEffect, useState } from 'react'
import { games } from './games/index.js'
import Leaderboard from './components/Leaderboard.jsx'
import PhoneController from './components/PhoneController.jsx'

// Hash routes: "#/" is the lobby, "#/<game-id>" is a game.
const readRoute = () => window.location.hash.replace(/^#\/?/, '')

function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function Lobby() {
  return (
    <main>
      <h2>Choose a game</h2>
      <ul className="game-grid">
        {games.map((g) => (
          <li key={g.id}>
            <a className="card game-card" href={`#/${g.id}`}>
              <span className="game-icon" aria-hidden="true">{g.icon}</span>
              <strong>{g.title}</strong>
              <span>{g.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

function GamePage({ game }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const Game = game.component
  return (
    <main>
      <h2>{game.icon} {game.title}</h2>
      <Game onScoreSubmitted={() => setRefreshKey((k) => k + 1)} />
      <Leaderboard game={game.id} refreshKey={refreshKey} />
    </main>
  )
}

export default function App() {
  const route = useRoute()
  if (new URLSearchParams(window.location.search).has('controller')) return <PhoneController />
  const game = games.find((g) => g.id === route)

  return (
    <div className="container">
      <header className="site-header">
        <a className="brand" href="#/">🕹️ Friends Arcade</a>
        <nav aria-label="Main">
          <a href="#/" aria-current={!game ? 'page' : undefined}>Games</a>
          {games.map((g) => (
            <a key={g.id} href={`#/${g.id}`} aria-current={game?.id === g.id ? 'page' : undefined}>{g.title}</a>
          ))}
          <a href="?controller=1">Phone controller</a>
        </nav>
      </header>
      {game ? <GamePage key={game.id} game={game} /> : <Lobby />}
    </div>
  )
}
