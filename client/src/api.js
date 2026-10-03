export async function getScores(game) {
  const res = await fetch(`/api/scores/${encodeURIComponent(game)}`)
  if (!res.ok) throw new Error('Failed to load scores')
  return res.json()
}

export async function submitScore(game, player, score) {
  const res = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game, player, score }),
  })
  if (!res.ok) throw new Error('Failed to submit score')
  return res.json()
}
