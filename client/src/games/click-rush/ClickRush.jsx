import { useEffect, useRef, useState } from 'react'
import { submitScore } from '../../api.js'

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
  const timer = useRef(null)
  const endTime = useRef(0)
  const arena = useRef(null)
  const submitting = useRef(false)

  useEffect(() => () => clearInterval(timer.current), [])

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
      await submitScore('click-rush', name, score)
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

  return (
    <div className="card">
      <p>Score: {score} | Time: {timeLeft}s</p>
      <div className="arena" ref={arena}>
        {state === 'playing' && (
          <button className="target" style={{ left: pos.x, top: pos.y }} onClick={hit} aria-label="target" />
        )}
      </div>
      {state !== 'playing' && <p><button onClick={start} disabled={isSubmitting}>{state === 'idle' ? 'Start' : 'Play again'}</button></p>}
      {state === 'done' && (
        <form onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} required />{' '}
          <button type="submit" disabled={isSubmitting || submitted}>
            {isSubmitting ? 'Submitting…' : submitted ? 'Score submitted' : 'Submit score'}
          </button>
          {message && <p>{message}</p>}
        </form>
      )}
    </div>
  )
}
