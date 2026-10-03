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

export async function createRoom() {
  return roomRequest('/api/rooms', 'POST')
}

export async function getRoom(code) {
  return roomRequest(`/api/rooms/${encodeURIComponent(code)}`)
}

export async function joinRoom(code, name) {
  return roomRequest(`/api/rooms/${encodeURIComponent(code)}/players`, 'POST', { name })
}

export async function recordRoomHit(code, name) {
  return roomRequest(`/api/rooms/${encodeURIComponent(code)}/hits`, 'POST', { name })
}

export async function finishRoom(code) {
  return roomRequest(`/api/rooms/${encodeURIComponent(code)}/finish`, 'POST')
}

async function roomRequest(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || 'Room request failed')
  }
  return res.json()
}
