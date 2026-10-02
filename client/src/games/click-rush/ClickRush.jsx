import { useEffect, useRef, useState } from 'react'
import { submitScore } from '../../api.js'

const DURATION = 15
const SIZE = 80
const ARENA = { w: 600, h: 300 }

const randomPos = () => ({
  x: Math.random() * (ARENA.w - SIZE),
  y: Math.random() * (ARENA.h - SIZE),
})

export default function ClickRush({ onScoreSubmitted }) {
  const [state, setState] = useState('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION)
  const [pos, setPos] = useState(randomPos)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  function start() {
    setScore(0)
    setTimeLeft(DURATION)
    setMessage('')
    setState('playing')
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer.current)
          setState('done')
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function hit() {
    setScore((s) => s + 1)
    setPos(randomPos())
  }

  async function submit(e) {
    e.preventDefault()
    try {
      await submitScore('click-rush', name, score)
      setMessage('Score submitted!')
      onScoreSubmitted?.()
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <div className="card">
      <p>Score: {score} | Time: {timeLeft}s</p>
      <div className="arena">
        {state === 'playing' && (
          <button className="target" style={{ left: pos.x, top: pos.y }} onClick={hit} aria-label="target" />
        )}
      </div>
      {state !== 'playing' && <p><button onClick={start}>{state === 'idle' ? 'Start' : 'Play again'}</button></p>}
      {state === 'done' && (
        <form onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} required />{' '}
          <button type="submit">Submit score</button>
          {message && <p>{message}</p>}
        </form>
      )}
    </div>
  )
}
