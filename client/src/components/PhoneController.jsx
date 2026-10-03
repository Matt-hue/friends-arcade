import { useEffect, useRef, useState } from 'react'
import { getRoom, joinRoom, recordRoomHit } from '../api.js'

export default function PhoneController() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [room, setRoom] = useState(null)
  const [message, setMessage] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isHitting, setIsHitting] = useState(false)
  const hitting = useRef(false)

  useEffect(() => {
    if (!room?.code) return undefined
    let active = true
    const poll = async () => {
      try {
        setRoom(await getRoom(room.code))
        if (active) setMessage('')
      } catch (err) {
        if (active) setMessage(err.message)
      }
    }
    poll()
    const interval = setInterval(poll, 1000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [room?.code])

  async function handleJoin(event) {
    event.preventDefault()
    setIsJoining(true)
    setMessage('')
    try {
      const joinedRoom = await joinRoom(code.trim(), name.trim())
      setRoom(joinedRoom)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setIsJoining(false)
    }
  }

  async function hit() {
    if (hitting.current || room?.finished) return
    hitting.current = true
    setIsHitting(true)
    try {
      setRoom(await recordRoomHit(room.code, name))
      setMessage('')
    } catch (err) {
      setMessage(err.message)
    } finally {
      hitting.current = false
      setIsHitting(false)
    }
  }

  return (
    <main className="controller">
      <a href="/">← Back to Friends Arcade</a>
      <h1>Phone controller</h1>
      {!room ? (
        <form className="card controller-form" onSubmit={handleJoin}>
          <label>
            Room code
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={6} required autoComplete="off" />
          </label>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} required autoComplete="nickname" />
          </label>
          <button type="submit" disabled={isJoining}>{isJoining ? 'Joining…' : 'Join game'}</button>
        </form>
      ) : (
        <section className="card controller-game">
          <p>Room <strong className="room-code">{room.code}</strong></p>
          <p>Team score: <strong>{room.score}</strong></p>
          <button className="hit-button" onClick={hit} disabled={isHitting || room.finished}>
            {room.finished ? 'Game over' : isHitting ? 'Hitting…' : 'HIT!'}
          </button>
          <h2>Players</h2>
          <ol className="player-scores">
            {room.players.map((player) => <li key={player.name}>{player.name}: {player.score}</li>)}
          </ol>
        </section>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  )
}
