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
  const [isFinishingRoom, setIsFinishingRoom] = useState(false)
  const timer = useRef(null)
  const endTime = useRef(0)
  const arena = useRef(null)
  const submitting = useRef(false)
  const lastRoomScore = useRef(0)
  const roomCode = useRef(null)
  const hostToken = useRef(null)
  const gameFinished = useRef(false)

  useEffect(() => () => clearInterval(timer.current), [])

  useEffect(() => {
    if (!room?.code || !['idle', 'playing'].includes(state)) return undefined
    let active = true
    const poll = async () => {
      try {
        const current = await getRoom(room.code)
        if (!active) return
        if (current.score > lastRoomScore.current) setPos(randomPos(arena.current))
        lastRoomScore.current = Math.max(lastRoomScore.current, current.score)
        setRoom((previous) => {
          if (previous?.finished && !current.finished) return previous
          if (previous && current.score < previous.score) return previous
          return { ...current, hostToken: previous?.hostToken }
        })
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

  async function finalizeRoom(code) {
    setIsFinishingRoom(true)
    try {
      const finalRoom = await finishRoom(code, hostToken.current)
      setRoom((previous) => ({ ...finalRoom, hostToken: previous?.hostToken }))
    } catch (err) {
      setRoomError(err.message)
    } finally {
      setIsFinishingRoom(false)
    }
  }

  function endGame() {
    if (gameFinished.current) return
    gameFinished.current = true
    clearInterval(timer.current)
    setTimeLeft(0)
    setState('done')
    if (roomCode.current) finalizeRoom(roomCode.current)
  }

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

  function start(withRoom = false) {
    setScore(0)
    setTimeLeft(DURATION)
    setMessage('')
    setSubmitted(false)
    setRoomError('')
    if (!withRoom) {
      setRoom(null)
      lastRoomScore.current = 0
      roomCode.current = null
      hostToken.current = null
    }
    gameFinished.current = false
    setState('playing')
    setPos(randomPos(arena.current))
    clearInterval(timer.current)
    endTime.current = Date.now() + DURATION * 1000
    timer.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) endGame()
    }, 100)
  }

  async function createMultiplayerRoom() {
    setIsCreatingRoom(true)
    setRoomError('')
    try {
      const newRoom = await createRoom()
      setRoom(newRoom)
      lastRoomScore.current = newRoom.score
      roomCode.current = newRoom.code
      hostToken.current = newRoom.hostToken
    } catch (err) {
      setRoomError(err.message)
    } finally {
      setIsCreatingRoom(false)
    }
  }

  function hit() {
    if (Date.now() >= endTime.current) {
      endGame()
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
      {state === 'idle' && !room && (
        <p>
          <button onClick={() => start()}>Start</button>{' '}
          <button onClick={createMultiplayerRoom} disabled={isCreatingRoom}>
            {isCreatingRoom ? 'Creating room…' : 'Play with friends on phones'}
          </button>
        </p>
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
      {state === 'idle' && room && (
        <p><button onClick={() => start(true)} disabled={!room.players.length}>Start game</button></p>
      )}
      {state === 'done' && <p><button onClick={() => start()} disabled={isSubmitting || isFinishingRoom}>Play again</button></p>}
      {state === 'done' && (
        <form onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} required />{' '}
          <button type="submit" disabled={isSubmitting || submitted || isFinishingRoom}>
            {isFinishingRoom ? 'Finalizing game…' : isSubmitting ? 'Submitting…' : submitted ? 'Score submitted' : 'Submit score'}
          </button>
          {message && <p>{message}</p>}
        </form>
      )}
    </div>
  )
}
