const { roles } = require('../data/roles')
const MAX_STEP_HISTORY = 60

function makeGame(board, seatRoles) {
  const now = Date.now()
  const seats = seatRoles.map((roleId, index) => {
    const role = roles[roleId]
    if (!role) throw new Error(`未定义的身份：${roleId}`)
    return {
      number: index + 1,
      roleId,
      roleName: role.name,
      alive: true,
      foolRevealed: false,
      deathCause: '',
      marks: { goldWater: false, silverWater: false }
    }
  })
  return {
    id: String(now),
    boardId: board.id,
    boardName: board.name,
    status: 'playing',
    winner: null,
    day: 1,
    phase: 'night',
    sheriffSeat: null,
    sheriffElectionDone: false,
    sheriffElectionInterrupted: false,
    sheriffElectionSnapshot: null,
    selfExposeCount: 0,
    stepHistory: [],
    dayState: null,
    voteHistory: [],
    nightStep: 0,
    seats,
    resources: { antidote: true, poison: true, lastGuardTarget: null, wolfKingClawUsed: false },
    special: { lonelyGirlTarget: null },
    selfExposeRoleIds: (board.dayRules.selfExposeRoleIds || []).slice(),
    pendingWolfKingClaw: false,
    pendingDeathSkills: [],
    pendingLastWords: [],
    night: emptyNight(),
    logs: [{ time: now, text: '游戏开始，进入第1夜' }]
  }
}

function emptyNight() {
  return { wolfTarget: null, guardTarget: null, seerTarget: null, witchAction: 'none', witchTarget: null }
}

function roleAlive(game, roleId) {
  return game.seats.some(seat => seat.alive && seat.roleId === roleId)
}

function setLonelyGirlTarget(game, targetNumber) {
  if (game.day !== 1 || !roleAlive(game, 'lonelyGirl')) throw new Error('当前不能记录孤独少女的崇拜对象')
  if (!game.special) game.special = { lonelyGirlTarget: null }
  if (game.special.lonelyGirlTarget) throw new Error('孤独少女的崇拜对象已经确定')
  const girl = game.seats.find(seat => seat.roleId === 'lonelyGirl')
  const target = game.seats.find(seat => seat.number === Number(targetNumber) && seat.alive)
  if (!target || target.number === girl.number) throw new Error('请为孤独少女选择其他存活玩家')
  game.special.lonelyGirlTarget = target.number
  addLog(game, `孤独少女首夜崇拜${target.number}号`)
  return target
}

function ensureLonelyGirlTarget(game) {
  if (game.day !== 1 || !roleAlive(game, 'lonelyGirl')) return null
  if (game.special && game.special.lonelyGirlTarget) return game.special.lonelyGirlTarget
  const girl = game.seats.find(seat => seat.roleId === 'lonelyGirl')
  const candidates = game.seats.filter(seat => seat.alive && seat.number !== girl.number)
  if (!candidates.length) return null
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  setLonelyGirlTarget(game, target.number)
  return target.number
}

function addLog(game, text) {
  game.logs.unshift({ time: Date.now(), text })
}

function checkpointStep(game, label) {
  const history = Array.isArray(game.stepHistory) ? game.stepHistory.slice() : []
  const snapshot = JSON.parse(JSON.stringify(game))
  delete snapshot.stepHistory
  history.push({ id: `${Date.now()}-${history.length}`, label: label || '上一步', snapshot })
  game.stepHistory = history.slice(-MAX_STEP_HISTORY)
}

function restoreStep(game) {
  const history = Array.isArray(game.stepHistory) ? game.stepHistory : []
  if (!history.length) return null
  const entry = history[history.length - 1]
  const restored = entry.snapshot
  restored.stepHistory = history.slice(0, -1)
  return { game: restored, label: entry.label }
}

function kill(game, number, cause) {
  const seat = game.seats.find(item => item.number === Number(number))
  if (!seat || !seat.alive) return null
  seat.alive = false
  seat.deathCause = cause
  if (!Array.isArray(game.pendingDeathSkills)) game.pendingDeathSkills = []
  game.pendingDeathSkills.push({ seatNumber: seat.number, cause })
  if (!Array.isArray(game.pendingLastWords)) game.pendingLastWords = []
  if (shouldHaveLastWords(game, cause)) game.pendingLastWords.push({ seatNumber: seat.number, cause })
  if (seat.roleId === 'wolfKing' && ['狼人袭击', '放逐'].includes(cause) && !game.resources.wolfKingClawUsed) game.pendingWolfKingClaw = true
  return seat
}

function shouldHaveLastWords(game, cause) {
  if (['狼人自曝', '放逐'].includes(cause)) return true
  return game.day === 1 && ['狼人袭击', '女巫毒药'].includes(cause)
}

function canUseDeathSkill(game, prompt) {
  const seat = game.seats.find(item => item.number === prompt.seatNumber)
  if (!seat) return false
  if (seat.roleId === 'hunter') return prompt.cause !== '女巫毒药'
  if (seat.roleId === 'wolfKing') return ['狼人袭击', '放逐'].includes(prompt.cause) && !game.resources.wolfKingClawUsed
  return false
}

function resolveDeathSkill(game, seatNumber, activate, targetNumber) {
  const prompt = game.pendingDeathSkills && game.pendingDeathSkills[0]
  if (!prompt || prompt.seatNumber !== Number(seatNumber)) throw new Error('当前没有待结算的死亡技能')
  const seat = game.seats.find(item => item.number === prompt.seatNumber)
  const canUse = canUseDeathSkill(game, prompt)
  let target = null
  if (activate && canUse) {
    target = game.seats.find(item => item.number === Number(targetNumber))
    if (!target || !target.alive) throw new Error('请选择仍存活的技能目标')
  }
  game.pendingDeathSkills.shift()
  if (activate && canUse) {
    const cause = seat.roleId === 'hunter' ? '猎人开枪' : '狼王爪击'
    kill(game, target.number, cause)
    if (seat.roleId === 'wolfKing') {
      game.resources.wolfKingClawUsed = true
      game.pendingWolfKingClaw = false
    }
    addLog(game, `${seat.number}号发动技能带走${target.number}号`)
  } else {
    if (seat.roleId === 'wolfKing') game.pendingWolfKingClaw = false
    addLog(game, `${seat.number}号未发动出局技能`)
  }
  evaluateWinner(game)
}

function settleNight(game) {
  const deaths = []
  ensureLonelyGirlTarget(game)
  if (game.night.guardTarget && game.night.guardTarget === game.resources.lastGuardTarget) throw new Error('守卫不能连续两晚守护同一名玩家')
  const guarded = game.night.guardTarget === game.night.wolfTarget
  const guardedAndSaved = guarded && game.night.witchAction === 'save'
  if (game.night.wolfTarget && ((!guarded && game.night.witchAction !== 'save') || guardedAndSaved)) {
    const target = game.seats.find(seat => seat.number === game.night.wolfTarget)
    const seat = target && target.roleId !== 'cursedFox' ? kill(game, game.night.wolfTarget, '狼人袭击') : null
    if (seat) deaths.push(seat)
  }
  if (game.night.witchAction === 'save' && game.night.wolfTarget) {
    const saved = game.seats.find(item => item.number === game.night.wolfTarget)
    if (saved) saved.marks.silverWater = true
  }
  if (game.night.guardTarget) game.resources.lastGuardTarget = game.night.guardTarget
  if (game.night.witchAction === 'poison' && game.night.witchTarget) {
    const target = game.seats.find(seat => seat.number === game.night.witchTarget)
    const seat = target && target.roleId !== 'cursedFox' ? kill(game, game.night.witchTarget, '女巫毒药') : null
    if (seat) deaths.push(seat)
  }
  const inspected = game.night.seerTarget && game.seats.find(seat => seat.number === game.night.seerTarget)
  if (inspected && inspected.alive && inspected.roleId === 'cursedFox') {
    const seat = kill(game, inspected.number, '预言家查验')
    if (seat) deaths.push(seat)
  }
  const text = deaths.length ? deaths.map(item => `${item.number}号`).join('、') + '出局' : '平安夜'
  game.latestNightDeathNumbers = deaths.map(item => item.number)
  addLog(game, `第${game.day}夜：${text}`)
  game.phase = 'day'
  game.dayState = createDayState(game)
  game.nightStep = 0
  evaluateWinner(game)
  return deaths
}

function createDayState(game) {
  const resumeElection = game.sheriffElectionInterrupted && !game.sheriffElectionDone && game.sheriffElectionSnapshot
  const snapshot = game.sheriffElectionSnapshot || {}
  return {
    stage: resumeElection ? 'sheriffResumeWithdraw' : game.sheriffElectionDone ? 'announceNight' : 'sheriffSignup',
    sheriffCandidates: resumeElection ? (snapshot.sheriffCandidates || []) : [],
    sheriffInitialCandidates: resumeElection ? (snapshot.sheriffInitialCandidates || []) : [],
    sheriffWithdrawn: resumeElection ? (snapshot.sheriffWithdrawn || []) : [],
    sheriffVotes: {},
    exileMode: 'individual',
    exileVotes: {},
    simpleVoteCounts: {}
  }
}

function addVoteHistory(game, round) {
  if (!Array.isArray(game.voteHistory)) game.voteHistory = []
  game.voteHistory.unshift({ id: `${Date.now()}-${game.voteHistory.length}`, day: game.day, ...round })
}

function applyDayEvent(game, type, number) {
  if (type === 'none') {
    addLog(game, `第${game.day}天：无人出局`)
  } else if (type === 'exile') {
    const seat = game.seats.find(item => item.number === Number(number))
    if (!seat || !seat.alive) throw new Error('请选择仍存活的玩家')
    if (seat.roleId === 'fool' && !seat.foolRevealed) {
      seat.foolRevealed = true
      addLog(game, `第${game.day}天：${seat.number}号愚者被放逐，翻牌但不出局`)
    } else {
      kill(game, number, '放逐')
      addLog(game, `第${game.day}天：${number}号被放逐出局`)
    }
  } else if (type === 'shot') {
    kill(game, number, '猎人开枪')
    addLog(game, `第${game.day}天：猎人开枪带走${number}号`)
  } else if (type === 'selfExpose') {
    const seat = game.seats.find(item => item.number === Number(number))
    if (!seat || !seat.alive) throw new Error('请选择仍存活的玩家')
    if (!(game.selfExposeRoleIds || []).includes(seat.roleId)) throw new Error('该身份不能自曝')
    kill(game, number, '狼人自曝')
    addLog(game, `第${game.day}天：${number}号狼人自曝`)
  } else if (type === 'wolfKingClaw') {
    const wolfKing = game.seats.find(item => item.roleId === 'wolfKing')
    if (!wolfKing || wolfKing.alive || !game.pendingWolfKingClaw || game.resources.wolfKingClawUsed) throw new Error('当前没有可发动的狼王爪击')
    if (!['狼人袭击', '放逐'].includes(wolfKing.deathCause)) throw new Error('狼王被女巫毒死，不能发动爪击')
    const target = game.seats.find(item => item.number === Number(number))
    if (!target || !target.alive) throw new Error('请选择仍存活的玩家')
    kill(game, number, '狼王爪击')
    game.resources.wolfKingClawUsed = true
    game.pendingWolfKingClaw = false
    addLog(game, `第${game.day}天：狼王爪击带走${number}号`)
  } else if (type === 'skipWolfKingClaw') {
    if (!game.pendingWolfKingClaw) throw new Error('当前没有待处理的狼王爪击')
    game.pendingWolfKingClaw = false
    addLog(game, `第${game.day}天：狼王放弃发动爪击`)
  }
  evaluateWinner(game)
}

function nextNight(game) {
  game.day += 1
  game.phase = 'night'
  game.nightStep = 0
  game.night = emptyNight()
  game.dayState = null
  addLog(game, `进入第${game.day}夜`)
}

function evaluateWinner(game) {
  if (game.pendingDeathSkills && game.pendingDeathSkills.length) return null
  if (game.pendingWolfKingClaw) return null
  const alive = game.seats.filter(seat => seat.alive)
  const wolves = alive.filter(seat => roles[seat.roleId].camp === 'wolf').length
  const villagers = alive.filter(seat => roles[seat.roleId].group === '平民').length
  const gods = alive.filter(seat => roles[seat.roleId].group === '神职').length
  const cursedFoxAlive = alive.some(seat => seat.roleId === 'cursedFox')
  const lonelyGirlAlive = alive.some(seat => seat.roleId === 'lonelyGirl')
  let winner = null
  if (game.boardId === 'brotherFoxCrow12' && cursedFoxAlive && (villagers === 0 || gods === 0 || wolves === 0)) winner = '咒狐'
  else if ((villagers === 0 || gods === 0) && !lonelyGirlAlive) winner = '狼人阵营'
  else if (wolves === 0) winner = '好人阵营'
  if (winner) {
    game.status = 'ended'
    game.winner = winner
    addLog(game, `游戏结束：${winner}获胜`)
  }
  return winner
}

module.exports = { makeGame, roleAlive, setLonelyGirlTarget, settleNight, applyDayEvent, nextNight, evaluateWinner, addLog, checkpointStep, restoreStep, createDayState, canUseDeathSkill, resolveDeathSkill, addVoteHistory, shouldHaveLastWords }
