import { useEffect, useRef, useState } from 'react'
import { createRoom, finishRoom, getRoom, submitScore } from '../../api.js'

const DURATION = 15
const SIZE = 80

const randomPos = (arena) => {
  const { width, height } = arena?.getBoundingClientRect() ?? { width: SIZE, height: SIZE }
  return {
    x: Math.random() * Math.max(0, width - SIZE),
    y: Math.random() * Math.max(0, height - SIZE),
  }
}

export default function ClickRush({ onScoreSubmitted }) {
  const [state, setState] = useState('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [pos, setPos] = useState(() => randomPos(null))
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [room, setRoom] = useState(null)
  const [roomError, setRoomError] = useState('')
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const timer = useRef(null)
  const endTime = useRef(0)
  const arena = useRef(null)
  const submitting = useRef(false)
  const lastRoomScore = useRef(0)

  useEffect(() => () => clearInterval(timer.current), [])

  useEffect(() => {
    if (!room?.code || state !== 'playing') return undefined
    let active = true
    const poll = async () => {
      try {
        const current = await getRoom(room.code)
        if (!active) return
        if (current.score > lastRoomScore.current) setPos(randomPos(arena.current))
        lastRoomScore.current = current.score
        setRoom(current)
        setRoomError('')
      } catch (err) {
        if (active) setRoomError(err.message)
      }
    }
    poll()
    const interval = setInterval(poll, 500)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [room?.code, state])

  useEffect(() => {
    if (state === 'done' && room?.code) finishRoom(room.code).catch(() => {})
  }, [room?.code, state])

  useEffect(() => {
    const element = arena.current
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect()
      setPos((current) => ({
        x: Math.min(current.x, Math.max(0, width - SIZE)),
        y: Math.min(current.y, Math.max(0, height - SIZE)),
      }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function start() {
    setScore(0)
    setTimeLeft(DURATION)
    setMessage('')
    setSubmitted(false)
    setRoom(null)
    setRoomError('')
    lastRoomScore.current = 0
    setState('playing')
    setPos(randomPos(arena.current))
    clearInterval(timer.current)
    endTime.current = Date.now() + DURATION * 1000
    timer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(timer.current)
        setState('done')
      }
    }, 100)
  }

  async function createMultiplayerRoom() {
    setIsCreatingRoom(true)
    setRoomError('')
    try {
      const newRoom = await createRoom()
      setRoom(newRoom)
      lastRoomScore.current = newRoom.score
    } catch (err) {
      setRoomError(err.message)
    } finally {
      setIsCreatingRoom(false)
    }
  }

  function hit() {
    if (Date.now() >= endTime.current) {
      clearInterval(timer.current)
      setTimeLeft(0)
      setState('done')
      return
    }
    setScore((s) => s + 1)
    setPos(randomPos(arena.current))
  }

  async function submit(e) {
    e.preventDefault()
    if (submitting.current || submitted) return

    submitting.current = true
    setIsSubmitting(true)
    setMessage('')
    try {
      await submitScore('click-rush', name, totalScore)
      setSubmitted(true)
      setMessage('Score submitted!')
      onScoreSubmitted?.()
    } catch (err) {
      setMessage(err.message)
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  const totalScore = score + (room?.score ?? 0)

  return (
    <div className="card">
      <p>Score: {totalScore} | Time: {timeLeft}s</p>
      {state === 'playing' && !room && (
        <p><button onClick={createMultiplayerRoom} disabled={isCreatingRoom}>
          {isCreatingRoom ? 'Creating room…' : 'Play with friends on phones'}
        </button></p>
      )}
      {room && (
        <section className="room-panel" aria-live="polite">
          <h3>Room code: <span className="room-code">{room.code}</span></h3>
          <p>Friends: {room.players.length}/8 · Score: {room.score}</p>
          <p>On each phone, open this site, tap <strong>Phone controller</strong>, and enter the code.</p>
          {room.players.length > 0 && (
            <ol className="player-scores">
              {room.players.map((player) => <li key={player.name}>{player.name}: {player.score}</li>)}
            </ol>
          )}
        </section>
      )}
      <div className="arena" ref={arena}>
        {state === 'playing' && (
          <button className="target" style={{ left: pos.x, top: pos.y }} onClick={hit} aria-label="target" />
        )}
      </div>
      {roomError && <p role="alert">{roomError}</p>}
      {state !== 'playing' && <p><button onClick={start} disabled={isSubmitting}>{state === 'idle' ? 'Start' : 'Play again'}</button></p>}
      {state === 'done' && (
        <form onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} required />{' '}
          <button type="submit" disabled={isSubmitting || submitted}>
            {isSubmitting ? 'Submitting…' : submitted ? 'Score submitted' : 'Submit score'}
          </button>
          {room?.players.length > 0 && (
            <ol className="player-scores">
              {room.players.map((player) => <li key={player.name}>{player.name}: {player.score}</li>)}
            </ol>
          )}
          {message && <p>{message}</p>}
        </form>
      )}
    </div>
  )
}
