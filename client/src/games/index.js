import ClickRush from './click-rush/ClickRush.jsx'

// To add a game: create a folder in src/games, then register it here.
export const games = [
  {
    id: 'click-rush',
    title: 'Click Rush',
    icon: '🎯',
    description: 'Hit as many targets as you can. Play solo or with friends on phones.',
    component: ClickRush,
  },
]
