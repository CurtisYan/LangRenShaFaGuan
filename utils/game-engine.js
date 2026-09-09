const { roles } = require('../data/roles')
const { nightActionDefinitions } = require('../data/night-actions')
const MAX_STEP_HISTORY = 60

const CAUSE_LABELS = {
  wolfAttack: '狼人袭击', poison: '女巫毒药', exile: '放逐', selfExpose: '狼人自曝',
  hunterShot: '猎人开枪', wolfKingClaw: '狼王爪击', awakenedClaw: '狼王爪击',
  whiteWolfClaw: '白狼王爪击',
  inspection: '查验出局', dream: '梦游出局', dreamFollow: '摄梦连带', tradeFailure: '交易失败',
  hunt: '猎魔人狩猎', backlash: '流光反噬', charmFollow: '魅惑连带', knightDuel: '骑士决斗'
}

function causeLabel(cause) { return CAUSE_LABELS[cause] || cause }
function causeId(cause) {
  if (CAUSE_LABELS[cause]) return cause
  return Object.keys(CAUSE_LABELS).find(id => CAUSE_LABELS[id] === cause) || cause
}

function defaultSpecialState() {
  return {
    lonelyGirlTarget: null,
    miracleMerchantUsed: false,
    luckySkill: null,
    timeWolfConsort: { lastTarget: null, disabled: false },
    orderPrince: { used: false, revealed: false },
    wolfCrowClaw: { joined: false, clawAvailable: false, used: false },
    alchemistWitch: { fogAvailable: true, snakeAvailable: true, pendingWolfTarget: null },
    eclipseMaid: { copiedRoleId: null, copiedTargetNumber: null },
    awakenedHiddenWolf: { mimickedRoleId: null, mimicDay: null, joined: false, extraClawAvailable: false, extraClawUsed: false, poisonAvailable: true, inspectedTargets: [] },
    mirrorGirlInspected: [],
    dreamerLastTarget: null,
    radiantCountLastTarget: null,
    magicianUsed: false,
    magicianSwappedSeats: [],
    nightmareLastTarget: null,
    wolfBeautyTarget: null,
    gargoyleInspected: [],
    crowTarget: null,
    knightUsed: false,
    bloodApostleDelayed: false,
    lastExiledSeat: null,
    goodSkillsSealedTonight: false
  }
}

function ensureGameState(game) {
  game.resources = game.resources || {}
  if (game.resources.antidote === undefined) game.resources.antidote = true
  if (game.resources.poison === undefined) game.resources.poison = true
  if (game.resources.lastGuardTarget === undefined) game.resources.lastGuardTarget = null
  if (game.resources.wolfKingClawUsed === undefined) game.resources.wolfKingClawUsed = false
  game.special = { ...defaultSpecialState(), ...(game.special || {}) }
  game.special.timeWolfConsort = { lastTarget: null, disabled: false, ...(game.special.timeWolfConsort || {}) }
  game.special.orderPrince = { used: false, revealed: false, ...(game.special.orderPrince || {}) }
  game.special.wolfCrowClaw = { joined: false, clawAvailable: false, used: false, ...(game.special.wolfCrowClaw || {}) }
  game.special.alchemistWitch = { fogAvailable: true, snakeAvailable: true, pendingWolfTarget: null, ...(game.special.alchemistWitch || {}) }
  game.special.eclipseMaid = { copiedRoleId: null, copiedTargetNumber: null, ...(game.special.eclipseMaid || {}) }
  game.special.awakenedHiddenWolf = { mimickedRoleId: null, mimicDay: null, joined: false, extraClawAvailable: false, extraClawUsed: false, poisonAvailable: true, inspectedTargets: [], ...(game.special.awakenedHiddenWolf || {}) }
  if (!Array.isArray(game.special.mirrorGirlInspected)) game.special.mirrorGirlInspected = []
  if (!Array.isArray(game.special.magicianSwappedSeats)) game.special.magicianSwappedSeats = []
  if (!Array.isArray(game.special.gargoyleInspected)) game.special.gargoyleInspected = []
  game.seats.forEach(seat => {
    if (!seat.abilities) seat.abilities = {}
    if (seat.roleId === 'awakenedWolfKing' && seat.abilities.clawCharges === undefined) seat.abilities.clawCharges = 2
    if (seat.abilities.clawCharges === undefined) seat.abilities.clawCharges = 0
  })
  if (!game.night || !game.night.actions) game.night = { ...emptyNight(), ...(game.night || {}), actions: (game.night && game.night.actions) || {} }
  return game
}

function seatForRole(game, roleId) { return game.seats.find(seat => seat.roleId === roleId) || null }
function aliveSeatForRole(game, roleId) { return game.seats.find(seat => seat.alive && seat.roleId === roleId) || null }
function actionValue(game, actionId) { ensureGameState(game); return game.night.actions[actionId] || {} }

function identityRoleOrder(board) {
  const roleIds = Object.keys(board.roleCounts)
  const ordered = []
  const add = roleId => {
    if (roleIds.includes(roleId) && roleId !== 'villager' && !ordered.includes(roleId)) ordered.push(roleId)
  }
  ;(board.nightSequence || []).forEach(actionId => {
    if (actionId === 'wolves') {
      roleIds.filter(roleId => roles[roleId] && roles[roleId].camp === 'wolf' && roleId !== 'wolf').forEach(add)
      add('wolf')
    } else {
      const definition = nightActionDefinitions[actionId]
      add(definition && definition.roleId ? definition.roleId : actionId)
    }
  })
  roleIds.forEach(add)
  if (roleIds.includes('villager')) ordered.push('villager')
  return ordered
}

function makeGame(board, seatRoles, options = {}) {
  const identityAssignmentTiming = options.identityAssignmentTiming === 'firstNight' ? 'firstNight' : 'beforeGame'
  const identitiesKnown = identityAssignmentTiming === 'beforeGame'
  const now = Date.now()
  const seats = seatRoles.map((roleId, index) => {
    const role = roles[roleId]
    if (!role && !(!identitiesKnown && !roleId)) throw new Error(`未定义的身份：${roleId}`)
    return {
      number: index + 1,
      roleId: roleId || '',
      roleName: role ? role.name : '待确认身份',
      alive: true,
      foolRevealed: false,
      deathCause: '',
      deathCauseId: '',
      abilities: { clawCharges: roleId === 'awakenedWolfKing' ? 2 : 0 },
      marks: { goldWater: false, silverWater: false }
    }
  })
  return {
    id: String(now),
    boardId: board.id,
    boardName: board.name,
    identityAssignmentTiming,
    identityAssignment: identitiesKnown ? null : { complete: false, roleCounts: { ...board.roleCounts }, roleOrder: identityRoleOrder(board), currentIndex: 0, selectedSeatNumbers: [] },
    status: 'playing',
    winner: null,
    day: 1,
    phase: 'night',
    sheriffSeat: null,
    pendingSheriffTransfer: null,
    sheriffElectionDone: false,
    sheriffElectionInterrupted: false,
    sheriffElectionSnapshot: null,
    selfExposeCount: 0,
    stepHistory: [],
    dayState: null,
    voteHistory: [],
    seats,
    resources: { antidote: true, poison: true, lastGuardTarget: null, wolfKingClawUsed: false },
    special: defaultSpecialState(),
    selfExposeRoleIds: (board.dayRules.selfExposeRoleIds || []).slice(),
    pendingWolfKingClaw: false,
    pendingDeathSkills: [],
    pendingLastWords: [],
    night: emptyNight(),
    logs: [{ time: now, text: identitiesKnown ? '游戏开始，进入第1夜' : '游戏开始，第1夜行动前先确认号码身份' }]
  }
}

function makeFirstNightIdentityGame(board) {
  return makeGame(board, Array(board.playerCount).fill(''), { identityAssignmentTiming: 'firstNight' })
}

function getIdentityAssignmentPrompt(game) {
  const state = game.identityAssignment
  if (game.identityAssignmentTiming !== 'firstNight' || !state || state.complete) return null
  const roleId = state.roleOrder[state.currentIndex]
  const role = roles[roleId]
  if (!role) return null
  const required = Number(state.roleCounts && state.roleCounts[roleId])
  return { roleId, roleName: role.name, required: required || 0, selectedSeatNumbers: (state.selectedSeatNumbers || []).slice() }
}

function normalizeIdentityAssignment(game, board) {
  const state = game.identityAssignment
  if (!state) return null
  if (!state.roleCounts) state.roleCounts = { ...board.roleCounts }
  if (!Array.isArray(state.roleOrder) || !state.roleOrder.length) state.roleOrder = identityRoleOrder(board)
  if (!Array.isArray(state.selectedSeatNumbers)) state.selectedSeatNumbers = []
  return state
}

function toggleIdentityAssignmentSeat(game, board, seatNumber) {
  const state = normalizeIdentityAssignment(game, board)
  if (game.identityAssignmentTiming !== 'firstNight' || !state || state.complete) throw new Error('当前不在首夜身份确认阶段')
  const seat = game.seats.find(item => item.number === Number(seatNumber))
  if (!seat || seat.roleId) throw new Error('该号码已经登记了身份')
  const prompt = getIdentityAssignmentPrompt(game)
  const selected = state.selectedSeatNumbers
  const index = selected.indexOf(seat.number)
  if (index >= 0) selected.splice(index, 1)
  else {
    if (selected.length >= prompt.required) throw new Error(`${prompt.roleName}只需登记${prompt.required}人`)
    selected.push(seat.number)
    selected.sort((a, b) => a - b)
  }
  return getIdentityAssignmentPrompt(game)
}

function advanceIdentityAssignment(game, state) {
  const remainingRoleIds = state.roleOrder.slice(state.currentIndex)
  if (remainingRoleIds.length === 1) {
    const finalRoleId = remainingRoleIds[0]
    const finalRole = roles[finalRoleId]
    const remainingSeats = game.seats.filter(seat => !seat.roleId)
    if (remainingSeats.length !== Number(state.roleCounts[finalRoleId])) throw new Error('剩余号码与板子身份数量不一致')
    remainingSeats.forEach(seat => { seat.roleId = finalRoleId; seat.roleName = finalRole.name })
    addLog(game, `第一夜身份确认：剩余号码自动确认为${finalRole.name}`)
    state.currentIndex = state.roleOrder.length
  }
  if (state.currentIndex >= state.roleOrder.length) {
    state.complete = true
    ensureGameState(game)
    addLog(game, '号码身份确认完成，继续第一夜行动')
  }
  return state.complete
}

function completeIdentityAssignment(game, board) {
  const state = normalizeIdentityAssignment(game, board)
  if (game.identityAssignmentTiming !== 'firstNight' || !state || state.complete) throw new Error('当前不在首夜身份确认阶段')
  const prompt = getIdentityAssignmentPrompt(game)
  if (prompt.selectedSeatNumbers.length !== prompt.required) throw new Error(`请确认${prompt.required}名${prompt.roleName}`)
  prompt.selectedSeatNumbers.forEach(number => {
    const seat = game.seats.find(item => item.number === number)
    seat.roleId = prompt.roleId
    seat.roleName = prompt.roleName
  })
  addLog(game, `第一夜身份确认：${prompt.roleName}为${prompt.selectedSeatNumbers.map(number => `${number}号`).join('、')}`)
  state.currentIndex += 1
  state.selectedSeatNumbers = []
  return advanceIdentityAssignment(game, state)
}

function emptyNight() {
  return { wolfTarget: null, guardTarget: null, seerTarget: null, witchAction: 'none', witchTarget: null, actions: {} }
}

function setNightActionTarget(game, actionId, targetNumber) {
  ensureGameState(game)
  const target = targetNumber === null || targetNumber === undefined || targetNumber === '' ? null : Number(targetNumber)
  if (target !== null && !game.seats.some(seat => seat.alive && seat.number === target)) throw new Error('请选择存活玩家')
  const value = actionValue(game, actionId)
  game.night.actions[actionId] = { ...value, target }
  if (actionId === 'wolves') game.night.wolfTarget = target
  if (actionId === 'guard') game.night.guardTarget = target
  if (actionId === 'seer') game.night.seerTarget = target
  if (actionId === 'witch') game.night.witchTarget = target
  if (actionId === 'lonelyGirl') game.special.lonelyGirlTarget = target
  return game.night.actions[actionId]
}

function setNightActionChoice(game, actionId, choice) {
  ensureGameState(game)
  game.night.actions[actionId] = { ...actionValue(game, actionId), choice: choice || null }
  return game.night.actions[actionId]
}

function setWitchAction(game, action, targetNumber) {
  ensureGameState(game)
  const normalized = ['none', 'save', 'poison'].includes(action) ? action : 'none'
  game.night.witchAction = normalized
  game.night.witchTarget = normalized === 'poison' && targetNumber ? Number(targetNumber) : null
  game.night.actions.witch = { ...actionValue(game, 'witch'), choice: normalized, target: game.night.witchTarget }
  return game.night.actions.witch
}

function toggleNightActionTarget(game, actionId, targetNumber, maximum) {
  ensureGameState(game)
  const number = Number(targetNumber)
  const selected = Array.isArray(actionValue(game, actionId).targets) ? actionValue(game, actionId).targets.slice() : []
  const index = selected.indexOf(number)
  if (index >= 0) selected.splice(index, 1)
  else {
    if (selected.length >= Number(maximum || 1)) throw new Error(`最多选择${maximum}名玩家`)
    selected.push(number)
    selected.sort((a, b) => a - b)
  }
  game.night.actions[actionId] = { ...actionValue(game, actionId), targets: selected }
  return selected
}

function clearNightAction(game, actionId) {
  ensureGameState(game)
  delete game.night.actions[actionId]
  if (actionId === 'wolves') game.night.wolfTarget = null
  if (actionId === 'guard') game.night.guardTarget = null
  if (actionId === 'seer') game.night.seerTarget = null
  if (actionId === 'witch') { game.night.witchTarget = null; game.night.witchAction = 'none' }
}

function effectiveRoleId(game, seat) {
  ensureGameState(game)
  if (seat && seat.roleId === 'awakenedHiddenWolf' && game.special.awakenedHiddenWolf.mimickedRoleId) return game.special.awakenedHiddenWolf.mimickedRoleId
  return seat ? seat.roleId : ''
}

function inspectionResult(game, actionId, targetNumber) {
  ensureGameState(game)
  const target = game.seats.find(seat => seat.number === Number(targetNumber))
  if (!target || !target.roleId) return ''
  let inspected = target
  const lock = actionValue(game, 'timeWolfConsort').target
  const definition = nightActionDefinitions[actionId]
  if (lock === target.number && definition && definition.roleId && roles[definition.roleId] && roles[definition.roleId].camp === 'good' && actionId !== 'witch') {
    inspected = seatForRole(game, definition.roleId) || target
  }
  const roleId = effectiveRoleId(game, inspected)
  if (['pureWhiteGirl', 'wolfWitch', 'mirrorGirl', 'gargoyle', 'hiddenWolfAbility'].includes(actionId)) return roles[roleId] ? roles[roleId].name : ''
  return roles[roleId] && roles[roleId].camp === 'wolf' ? '狼人' : '好人'
}

const ACTION_PROMPTS = {
  magician: '选择两名玩家交换号码牌，本次交换只对当夜技能目标生效。',
  nightmare: '选择一名其他玩家进行恐惧，或本夜不发动。',
  lonelyGirl: '首夜选择一名其他玩家作为崇拜对象。',
  miracleMerchant: '选择一名其他玩家，并赋予查验、毒药或守护中的一种技能。',
  luckySkill: '幸运儿可以使用获赠的一次性技能，也可以保留到之后夜晚。',
  timeWolfConsort: '选择一名玩家封锁；好人对该玩家的技能将反弹给技能发动者。',
  awakenedWolfKing: '可以把一枚狼王爪亲传给一名尚未接收过狼王爪的存活狼队友。',
  awakenedHiddenWolf: '每局一次，选择一名其他玩家进行模仿；复制技能从下一夜开始可用。',
  alchemistWitch: '可以消耗末明之雾，选择三名玩家限制本夜普通狼刀目标。',
  eclipseMaid: '第二夜起选择一名非狼人玩家吞噬，本夜暂时获得其技能。',
  eclipseMaidAbility: '使用本夜吞噬获得的技能，或选择不发动。',
  radiantCount: '第二夜起庇护一名其他玩家，不能连续两夜选择同一目标。',
  pureWhiteGirl: '选择一名玩家查验具体身份；第二夜起查到狼人会使其出局。',
  wolfWitch: '选择一名非狼人玩家查验具体身份；第二夜起查到纯白之女会使其出局。',
  wolfCrowClaw: '狼鸦之爪觉醒后可消耗一次额外爪击，无视一切保护效果。',
  mirrorGirl: '选择一名未查验过的其他玩家，查看其当前身份。',
  hiddenWolfAbility: '使用觉醒隐狼模仿获得的技能。',
  wolves: '狼人确认同伴，并选择本夜普通狼刀目标；也可以空过。',
  wolfBeauty: '选择一名其他玩家进行魅惑。',
  guard: '选择本夜守护目标，不能连续两夜守护同一名玩家。',
  seer: '选择一名玩家查验其阵营，也可以本夜不发动。',
  witch: '根据刀口选择不用药、使用解药或使用毒药。',
  gargoyle: '选择一名未查验过的其他玩家，查看其具体身份。',
  gravedigger: '查看上一个白天被放逐玩家的阵营。',
  demonHunter: '第二夜起选择一名其他玩家狩猎，也可以不发动。',
  crow: '选择一名玩家施加诅咒，其下一次放逐投票额外增加一票。',
  dreamer: '必须选择一名其他玩家成为梦游者。'
}

const ISOLATED_WOLVES = new Set(['gargoyle', 'wolfCrowClaw', 'eclipseMaid', 'awakenedHiddenWolf'])

function activeWolfTeam(game) {
  ensureGameState(game)
  const pack = game.seats.filter(seat => seat.alive && roles[seat.roleId] && roles[seat.roleId].camp === 'wolf' && !ISOLATED_WOLVES.has(seat.roleId))
  const crow = aliveSeatForRole(game, 'wolfCrowClaw')
  if (pack.length) return crow && game.special.wolfCrowClaw.joined ? pack.concat(crow) : pack
  if (crow && game.special.wolfCrowClaw.joined) return [crow]
  const maid = aliveSeatForRole(game, 'eclipseMaid')
  if (maid) return [maid]
  const hidden = aliveSeatForRole(game, 'awakenedHiddenWolf')
  if (hidden) return [hidden]
  const gargoyle = aliveSeatForRole(game, 'gargoyle')
  return gargoyle ? [gargoyle] : []
}

function dynamicSkillForAction(game, actionId) {
  if (actionId === 'luckySkill') {
    if (game.special.luckySkill && !game.special.luckySkill.used) return game.special.luckySkill
    const merchant = actionValue(game, 'miracleMerchant')
    const target = game.seats.find(seat => seat.number === Number(merchant.target))
    if (target && roles[target.roleId] && roles[target.roleId].camp !== 'wolf' && merchant.choice) return { seatNumber: target.number, skill: merchant.choice, used: false, pending: true }
  }
  if (actionId === 'eclipseMaidAbility') {
    const devour = actionValue(game, 'eclipseMaid')
    const target = game.seats.find(seat => seat.number === Number(devour.target))
    if (target) return { seatNumber: seatForRole(game, 'eclipseMaid').number, skill: target.roleId, sourceSeatNumber: target.number }
  }
  if (actionId === 'hiddenWolfAbility') {
    const state = game.special.awakenedHiddenWolf
    if (state.mimickedRoleId && game.day > Number(state.mimicDay || 0)) return { seatNumber: seatForRole(game, 'awakenedHiddenWolf').number, skill: state.mimickedRoleId }
  }
  return null
}

function dynamicKind(skill) {
  if (!skill) return 'information'
  if (['witch'].includes(skill)) return 'witch'
  if (skill === 'villager') return 'information'
  return 'target'
}

function getNightActionCards(game, board) {
  ensureGameState(game)
  const alive = game.seats.filter(seat => seat.alive)
  const wolfCount = alive.filter(seat => roles[seat.roleId] && roles[seat.roleId].camp === 'wolf').length
  const crow = aliveSeatForRole(game, 'wolfCrowClaw')
  if (crow && !game.special.wolfCrowClaw.joined && wolfCount <= 2) {
    game.special.wolfCrowClaw.joined = true
    game.special.wolfCrowClaw.clawAvailable = true
  }
  const hidden = aliveSeatForRole(game, 'awakenedHiddenWolf')
  const otherHiddenWolves = hidden ? alive.filter(seat => seat.number !== hidden.number && roles[seat.roleId] && roles[seat.roleId].camp === 'wolf') : []
  if (hidden && !otherHiddenWolves.length && !game.special.awakenedHiddenWolf.joined) {
    game.special.awakenedHiddenWolf.joined = true
    if (game.special.awakenedHiddenWolf.mimickedRoleId === 'wolf') game.special.awakenedHiddenWolf.extraClawAvailable = true
  }
  return (board.nightSequence || []).map((actionId, index) => {
    const definition = nightActionDefinitions[actionId] || { id: actionId, roleId: actionId, name: actionId, kind: 'target', optional: true }
    let actor = definition.roleId ? seatForRole(game, definition.roleId) : null
    if (actionId === 'wolves') actor = activeWolfTeam(game)[0] || null
    const dynamic = dynamicSkillForAction(game, actionId)
    if (dynamic && dynamic.seatNumber) actor = game.seats.find(seat => seat.number === dynamic.seatNumber) || actor
    let enabled = Boolean(actionId === 'wolves' ? activeWolfTeam(game).length : actor && actor.alive)
    let inactiveReason = enabled ? '' : '该身份已出局或当前没有可行动玩家。'
    if (definition.firstNightOnly && game.day !== 1) { enabled = false; inactiveReason = '该技能仅在第一夜行动。' }
    if (definition.fromDay && game.day < definition.fromDay) { enabled = false; inactiveReason = `第${definition.fromDay}夜开始行动。` }
    if (actionId === 'miracleMerchant' && game.special.miracleMerchantUsed) { enabled = false; inactiveReason = '本局交易技能已经使用。' }
    if (actionId === 'magician' && game.special.magicianUsed) { enabled = false; inactiveReason = '本局交换技能已经使用。' }
    if (actionId === 'timeWolfConsort' && game.special.timeWolfConsort.disabled) { enabled = false; inactiveReason = '封锁已成功反弹技能，蚀时狼妃永久失去技能。' }
    if (actionId === 'alchemistWitch' && !game.special.alchemistWitch.fogAvailable) { enabled = false; inactiveReason = '末明之雾已经使用。' }
    if (actionId === 'awakenedWolfKing' && (!actor || !actor.abilities || actor.abilities.clawCharges <= 0)) { enabled = false; inactiveReason = '没有可亲传的狼王爪。' }
    if (actionId === 'wolfCrowClaw' && (!game.special.wolfCrowClaw.joined || !game.special.wolfCrowClaw.clawAvailable)) { enabled = false; inactiveReason = '狼鸦之爪尚未觉醒，或觉醒爪击已经使用。' }
    if (actionId === 'awakenedHiddenWolf' && game.special.awakenedHiddenWolf.mimickedRoleId) { enabled = false; inactiveReason = '本局已经完成模仿。' }
    if (['luckySkill', 'eclipseMaidAbility', 'hiddenWolfAbility'].includes(actionId) && !dynamic) { enabled = false; inactiveReason = '当前没有可使用的继承技能。' }
    if (actor && roles[actor.roleId] && roles[actor.roleId].camp === 'good' && game.special.goodSkillsSealedTonight) { enabled = false; inactiveReason = '血夜使徒自曝，本夜好人技能全部封印。' }
    if (actor && actionId !== 'eclipseMaidAbility' && rawNightTarget(game, 'eclipseMaid') === actor.number) { enabled = false; inactiveReason = '本夜被蚀日侍女吞噬，技能暂时失效。' }
    if (actionId === 'wolves' && rawNightTarget(game, 'nightmare') && activeWolfTeam(game).some(seat => seat.number === rawNightTarget(game, 'nightmare'))) { enabled = false; inactiveReason = '狼队成员被恐惧，本夜不能发动普通狼刀。' }
    let kind = definition.kind
    let name = definition.name
    let prompt = ACTION_PROMPTS[actionId] || definition.name
    if (dynamic) {
      kind = dynamicKind(dynamic.skill)
      const skillRole = roles[dynamic.skill]
      const skillNames = { inspect: '查验', poison: '毒药', guard: '守护' }
      const skillName = skillNames[dynamic.skill] || (skillRole && skillRole.name) || dynamic.skill
      name = `${definition.name} · ${skillName}`
      if (dynamic.skill === 'villager') { enabled = false; inactiveReason = '模仿或吞噬到平民，本夜没有可发动的技能。' }
    }
    let candidates = alive.slice()
    if (definition.excludeSelf && actor) candidates = candidates.filter(seat => seat.number !== actor.number)
    if (definition.wolfTargetOnly) candidates = candidates.filter(seat => roles[seat.roleId] && roles[seat.roleId].camp === 'wolf' && seat.number !== actor.number && !seat.abilities.receivedAwakenedClaw)
    if (definition.nonWolfTargetOnly) candidates = candidates.filter(seat => roles[seat.roleId] && roles[seat.roleId].camp !== 'wolf')
    if (actionId === 'eclipseMaid') candidates = candidates.filter(seat => roles[seat.roleId] && roles[seat.roleId].camp !== 'wolf')
    if (actionId === 'wolves') {
      candidates = candidates.filter(seat => seat.roleId !== 'evilKnight')
      const fogTargets = actionValue(game, 'alchemistWitch').targets || []
      if (fogTargets.length === 3) candidates = candidates.filter(seat => fogTargets.includes(seat.number))
    }
    if (actionId === 'luckySkill' && dynamic && dynamic.skill === 'guard' && game.resources.lastGuardTarget) candidates = candidates.filter(seat => seat.number !== game.resources.lastGuardTarget)
    if (actionId === 'hiddenWolfAbility' && dynamic && dynamic.skill === 'mirrorGirl') candidates = candidates.filter(seat => seat.number !== actor.number && !game.special.awakenedHiddenWolf.inspectedTargets.includes(seat.number))
    if (actionId === 'hiddenWolfAbility' && dynamic && dynamic.skill === 'hunter') { enabled = false; inactiveReason = '猎人技能仅在出局时询问。' }
    const noRepeat = actionId === 'mirrorGirl' ? game.special.mirrorGirlInspected : actionId === 'gargoyle' ? game.special.gargoyleInspected : []
    if (definition.noRepeat) candidates = candidates.filter(seat => !noRepeat.includes(seat.number))
    if (actionId === 'guard' && game.resources.lastGuardTarget) candidates = candidates.filter(seat => seat.number !== game.resources.lastGuardTarget)
    if (actionId === 'timeWolfConsort' && game.special.timeWolfConsort.lastTarget) candidates = candidates.filter(seat => seat.number !== game.special.timeWolfConsort.lastTarget)
    if (actionId === 'radiantCount' && game.special.radiantCountLastTarget) candidates = candidates.filter(seat => seat.number !== game.special.radiantCountLastTarget)
    if (actionId === 'nightmare' && game.special.nightmareLastTarget) candidates = candidates.filter(seat => seat.number !== game.special.nightmareLastTarget)
    if (actionId === 'crow' && game.special.crowTarget) candidates = candidates.filter(seat => seat.number !== game.special.crowTarget)
    const value = actionValue(game, actionId)
    if (kind === 'witch' && !value.choice) {
      value.choice = actionId === 'witch' ? game.night.witchAction : 'none'
      value.target = actionId === 'witch' ? game.night.witchTarget : value.target
    }
    const selectedIndex = Math.max(0, candidates.findIndex(seat => seat.number === Number(value.target)))
    let result = value.target ? inspectionResult(game, actionId, value.target) : ''
    if (actionId === 'gravedigger') {
      const exiled = game.special.lastExiledSeat && game.seats.find(seat => seat.number === game.special.lastExiledSeat)
      result = exiled ? `${exiled.number}号属于${roles[exiled.roleId].camp === 'wolf' ? '狼人阵营' : '好人阵营'}` : '上一天没有玩家被放逐。'
    }
    if (dynamic && ['inspect', 'seer', 'mirrorGirl'].includes(dynamic.skill) && value.target) result = inspectionResult(game, dynamic.skill === 'inspect' ? 'seer' : dynamic.skill, value.target)
    return {
      id: actionId, order: String(index + 2).padStart(2, '0'), name, prompt, kind, enabled, inactiveReason,
      actorNumber: actor ? actor.number : '', targetNumbers: candidates.map(seat => seat.number), targetLabels: candidates.map(seat => `${seat.number}号`), targetIndex: selectedIndex,
      selectedTarget: value.target || null, targets: value.targets || [], targetSeats: candidates.map(seat => ({ number: seat.number, selected: (value.targets || []).includes(seat.number) })),
      targetCount: definition.targetCount || 1, choice: value.choice || '', choiceLabel: value.choice ? ((definition.choiceLabels || definition.choices || [])[(definition.choices || []).indexOf(value.choice)] || value.choice) : '', choiceOptions: definition.choiceLabels || definition.choices || [], choiceValues: definition.choices || [], choiceIndex: Math.max(0, (definition.choices || []).indexOf(value.choice)),
      result, optional: definition.required !== true && definition.optional !== false, dynamicSkill: dynamic ? dynamic.skill : '', information: kind === 'information' ? result || inactiveReason : '',
      witchChoices: ['不用药', '使用解药', '使用毒药'], witchChoiceIndex: Math.max(0, ['none', 'save', 'poison'].indexOf(value.choice || 'none')),
      resourceText: actionId === 'witch' ? `解药：${game.resources.antidote ? '可用' : '已用'}　毒药：${game.resources.poison ? '可用' : '已用'}` : ''
    }
  })
}

function getWolfTeamNumbers(game) {
  return activeWolfTeam(game).map(seat => seat.number)
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

function queueSheriffTransfer(game, seat, cause) {
  if (!seat || Number(game.sheriffSeat) !== seat.number) return null
  game.pendingSheriffTransfer = { seatNumber: seat.number, cause }
  return game.pendingSheriffTransfer
}

function kill(game, number, cause) {
  ensureGameState(game)
  const seat = game.seats.find(item => item.number === Number(number))
  if (!seat || !seat.alive) return null
  const normalizedCauseId = causeId(cause)
  const label = causeLabel(cause)
  seat.alive = false
  seat.deathCause = label
  seat.deathCauseId = normalizedCauseId
  queueSheriffTransfer(game, seat, label)
  if (!Array.isArray(game.pendingDeathSkills)) game.pendingDeathSkills = []
  game.pendingDeathSkills.push({ seatNumber: seat.number, cause: label, causeId: normalizedCauseId })
  if (!Array.isArray(game.pendingLastWords)) game.pendingLastWords = []
  if (shouldHaveLastWords(game, normalizedCauseId) && !(seat.roleId === 'whiteWolfKing' && normalizedCauseId === 'selfExpose')) game.pendingLastWords.push({ seatNumber: seat.number, cause: label, causeId: normalizedCauseId })
  if (seat.roleId === 'wolfKing' && ['wolfAttack', 'exile'].includes(normalizedCauseId) && !game.resources.wolfKingClawUsed) game.pendingWolfKingClaw = true
  if (seat.roleId === 'wolfBeauty' && normalizedCauseId !== 'knightDuel' && game.special.wolfBeautyTarget) kill(game, game.special.wolfBeautyTarget, 'charmFollow')
  return seat
}

function shouldHaveLastWords(game, cause) {
  const id = causeId(cause)
  if (['selfExpose', 'exile'].includes(id)) return true
  return game.day === 1 && ['wolfAttack', 'poison', 'inspection', 'tradeFailure', 'backlash'].includes(id)
}

function canUseDeathSkill(game, prompt) {
  const seat = game.seats.find(item => item.number === prompt.seatNumber)
  if (!seat) return false
  const promptCauseId = prompt.causeId || causeId(prompt.cause)
  if (seat.roleId === 'hunter') return !['poison', 'dream', 'dreamFollow'].includes(promptCauseId)
  if (seat.roleId === 'wolfKing') return ['wolfAttack', 'exile'].includes(promptCauseId) && !game.resources.wolfKingClawUsed
  if (seat.roleId === 'whiteWolfKing') return promptCauseId === 'selfExpose'
  if (seat.roleId === 'awakenedWolfKing' || (roles[seat.roleId] && roles[seat.roleId].camp === 'wolf' && seat.abilities && seat.abilities.clawCharges > 0)) {
    const otherWolfAlive = game.seats.some(other => other.alive && other.number !== seat.number && roles[other.roleId] && roles[other.roleId].camp === 'wolf')
    return otherWolfAlive && ['wolfAttack', 'exile'].includes(promptCauseId) && seat.abilities.clawCharges > 0
  }
  if (seat.roleId === 'awakenedHiddenWolf' && game.special.awakenedHiddenWolf.mimickedRoleId === 'hunter') return game.day > Number(game.special.awakenedHiddenWolf.mimicDay || 0) && !['poison', 'dream', 'dreamFollow'].includes(promptCauseId)
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
  if (activate && canUse) {
    const isHunterShot = seat.roleId === 'hunter' || (seat.roleId === 'awakenedHiddenWolf' && game.special.awakenedHiddenWolf.mimickedRoleId === 'hunter')
    const isChargedClaw = !isHunterShot && seat.roleId !== 'wolfKing' && seat.abilities && seat.abilities.clawCharges > 0
    if (!isChargedClaw) game.pendingDeathSkills.shift()
    kill(game, target.number, isHunterShot ? 'hunterShot' : seat.roleId === 'wolfKing' ? 'wolfKingClaw' : seat.roleId === 'whiteWolfKing' ? 'whiteWolfClaw' : 'awakenedClaw')
    if (seat.roleId === 'wolfKing') {
      game.resources.wolfKingClawUsed = true
      game.pendingWolfKingClaw = false
    } else if (isChargedClaw) {
      seat.abilities.clawCharges -= 1
      if (!canUseDeathSkill(game, prompt)) game.pendingDeathSkills.shift()
    }
    addLog(game, `${seat.number}号发动技能带走${target.number}号`)
  } else {
    game.pendingDeathSkills.shift()
    if (seat.abilities && seat.abilities.clawCharges) seat.abilities.clawCharges = 0
    if (seat.roleId === 'wolfKing') game.pendingWolfKingClaw = false
    addLog(game, `${seat.number}号未发动出局技能`)
  }
  evaluateWinner(game)
}

function resolveSheriffTransfer(game, targetNumber) {
  const prompt = game.pendingSheriffTransfer
  if (!prompt) throw new Error('当前没有待处理的警徽传承')
  if (game.status === 'ended') {
    game.pendingSheriffTransfer = null
    throw new Error('本局已经结束，无需处理警徽传承')
  }
  if ((game.pendingDeathSkills && game.pendingDeathSkills.length) || game.pendingWolfKingClaw) throw new Error('请先完成全部出局技能结算并校验胜负')
  const formerSheriff = game.seats.find(seat => seat.number === prompt.seatNumber)
  if (targetNumber === null || targetNumber === undefined || targetNumber === '') {
    game.sheriffSeat = null
    game.pendingSheriffTransfer = null
    addLog(game, `${prompt.seatNumber}号警长撕毁警徽`)
    evaluateWinner(game)
    return null
  }
  const target = game.seats.find(seat => seat.number === Number(targetNumber))
  if (!target || !target.alive || target.number === prompt.seatNumber || target.foolRevealed) throw new Error('警徽只能移交给其他可接警徽的存活玩家')
  game.sheriffSeat = target.number
  game.pendingSheriffTransfer = null
  addLog(game, `${prompt.seatNumber}号警长将警徽移交给${target.number}号`)
  evaluateWinner(game)
  return { formerSheriff, target }
}

function rawNightTarget(game, actionId) {
  const value = actionValue(game, actionId)
  if (value.target !== undefined && value.target !== null) return Number(value.target)
  if (actionId === 'wolves') return game.night.wolfTarget
  if (actionId === 'guard') return game.night.guardTarget
  if (actionId === 'seer') return game.night.seerTarget
  if (actionId === 'witch') return game.night.witchTarget
  return null
}

function swapTarget(game, targetNumber) {
  const pair = actionValue(game, 'magician').targets || []
  if (pair.length !== 2) return targetNumber
  if (Number(targetNumber) === Number(pair[0])) return Number(pair[1])
  if (Number(targetNumber) === Number(pair[1])) return Number(pair[0])
  return targetNumber
}

function effectiveActionTarget(game, actionId, actor, isGoodSkill = false) {
  const raw = rawNightTarget(game, actionId)
  if (!raw) return null
  let target = swapTarget(game, raw)
  const locked = rawNightTarget(game, 'timeWolfConsort')
  if (isGoodSkill && actionId !== 'witchSave' && locked && Number(target) === Number(locked) && actor) {
    target = actor.number
    game.special.timeWolfConsort.disabled = true
  }
  return Number(target)
}

function settleNight(game) {
  ensureGameState(game)
  if (game.identityAssignmentTiming === 'firstNight' && game.identityAssignment && !game.identityAssignment.complete) throw new Error('请先完成号码身份确认')
  ensureLonelyGirlTarget(game)
  const boardActions = Object.keys(game.night.actions || {})
  if (!boardActions.length) {
    if (game.night.wolfTarget) setNightActionTarget(game, 'wolves', game.night.wolfTarget)
    if (game.night.guardTarget) setNightActionTarget(game, 'guard', game.night.guardTarget)
    if (game.night.seerTarget) setNightActionTarget(game, 'seer', game.night.seerTarget)
    if (game.night.witchAction) setWitchAction(game, game.night.witchAction, game.night.witchTarget)
  }

  const events = []
  const addEvent = (number, cause, options = {}) => {
    const seat = game.seats.find(item => item.alive && item.number === Number(number))
    if (seat && !events.some(item => item.number === seat.number)) events.push({ number: seat.number, cause, ...options })
  }
  const actor = roleId => aliveSeatForRole(game, roleId)
  const isFeared = roleId => {
    const fearTarget = rawNightTarget(game, 'nightmare')
    const roleSeat = actor(roleId)
    const swallowed = game.special.eclipseMaid.copiedTargetNumber
    return Boolean((roles[roleId] && roles[roleId].camp === 'good' && game.special.goodSkillsSealedTonight) || (fearTarget && roleSeat && roleSeat.number === Number(fearTarget)) || (swallowed && roleSeat && roleSeat.number === Number(swallowed)))
  }

  const magicianPair = actionValue(game, 'magician').targets || []
  if (magicianPair.length === 2 && !game.special.magicianUsed) {
    game.special.magicianUsed = true
    game.special.magicianSwappedSeats = magicianPair.slice()
  }
  const fearTarget = rawNightTarget(game, 'nightmare')
  game.special.nightmareLastTarget = fearTarget || null
  const charmTarget = effectiveActionTarget(game, 'wolfBeauty', actor('wolfBeauty'))
  game.special.wolfBeautyTarget = charmTarget || null

  const merchantAction = actionValue(game, 'miracleMerchant')
  const merchant = actor('miracleMerchant')
  if (merchant && merchantAction.target && merchantAction.choice && !game.special.miracleMerchantUsed) {
    game.special.miracleMerchantUsed = true
    const lucky = game.seats.find(seat => seat.number === Number(merchantAction.target))
    if (lucky && roles[lucky.roleId].camp === 'wolf') addEvent(merchant.number, 'tradeFailure')
    else if (lucky) game.special.luckySkill = { seatNumber: lucky.number, skill: merchantAction.choice, used: false }
  }

  const consortTarget = rawNightTarget(game, 'timeWolfConsort')
  if (consortTarget) game.special.timeWolfConsort.lastTarget = consortTarget

  const king = actor('awakenedWolfKing')
  const inheritedClawTarget = rawNightTarget(game, 'awakenedWolfKing')
  if (king && inheritedClawTarget && king.abilities.clawCharges > 0) {
    const target = game.seats.find(seat => seat.number === inheritedClawTarget && seat.alive && roles[seat.roleId].camp === 'wolf')
    if (target && !target.abilities.receivedAwakenedClaw) {
      king.abilities.clawCharges -= 1
      target.abilities.clawCharges += 1
      target.abilities.receivedAwakenedClaw = true
      addLog(game, `觉醒狼王将一枚狼王爪亲传给${target.number}号`)
    }
  }

  const hidden = actor('awakenedHiddenWolf')
  const mimicTarget = rawNightTarget(game, 'awakenedHiddenWolf')
  if (hidden && mimicTarget && !game.special.awakenedHiddenWolf.mimickedRoleId) {
    const target = game.seats.find(seat => seat.number === mimicTarget)
    if (target) {
      game.special.awakenedHiddenWolf.mimickedRoleId = target.roleId
      game.special.awakenedHiddenWolf.mimicDay = game.day
      addLog(game, `觉醒隐狼模仿了${target.number}号的身份`)
    }
  }

  const maid = actor('eclipseMaid')
  const devouredNumber = effectiveActionTarget(game, 'eclipseMaid', maid)
  const devoured = devouredNumber && game.seats.find(seat => seat.number === devouredNumber)
  if (maid && devoured) {
    game.special.eclipseMaid.copiedRoleId = devoured.roleId
    game.special.eclipseMaid.copiedTargetNumber = devoured.number
  } else {
    game.special.eclipseMaid.copiedRoleId = null
    game.special.eclipseMaid.copiedTargetNumber = null
  }

  const normalGuard = !isFeared('guard') ? effectiveActionTarget(game, 'guard', actor('guard'), true) : null
  if (normalGuard && normalGuard === game.resources.lastGuardTarget) throw new Error('守卫不能连续两晚守护同一名玩家')
  const radiant = !isFeared('radiantCount') ? effectiveActionTarget(game, 'radiantCount', actor('radiantCount'), true) : null
  const dreamer = actor('dreamer')
  const dreamTarget = !isFeared('dreamer') ? effectiveActionTarget(game, 'dreamer', dreamer, true) : null
  const hiddenSkill = actionValue(game, 'hiddenWolfAbility')
  const hiddenRole = game.special.awakenedHiddenWolf.mimickedRoleId
  const hiddenSkillReady = hidden && game.day > Number(game.special.awakenedHiddenWolf.mimicDay || 0)
  const hiddenGuard = hiddenSkillReady && hiddenRole === 'guard' ? effectiveActionTarget(game, 'hiddenWolfAbility', hidden) : null
  const maidAbility = actionValue(game, 'eclipseMaidAbility')
  const maidRole = game.special.eclipseMaid.copiedRoleId
  const maidGuard = maid && maidRole === 'guard' ? effectiveActionTarget(game, 'eclipseMaidAbility', maid) : null
  const maidRadiant = maid && maidRole === 'radiantCount' ? effectiveActionTarget(game, 'eclipseMaidAbility', maid) : null
  const maidDream = maid && maidRole === 'dreamer' ? effectiveActionTarget(game, 'eclipseMaidAbility', maid) : null
  const luckyAction = actionValue(game, 'luckySkill')
  const luckyState = game.special.luckySkill
  const luckyGuard = luckyState && !luckyState.used && luckyState.skill === 'guard' ? effectiveActionTarget(game, 'luckySkill', game.seats.find(seat => seat.number === luckyState.seatNumber), true) : null
  const guardedTargets = [normalGuard, luckyGuard, maidGuard].filter(Boolean)
  const fullProtection = [radiant, dreamTarget, hiddenGuard, maidRadiant, maidDream].filter(Boolean)

  let wolfTarget = effectiveActionTarget(game, 'wolves', activeWolfTeam(game)[0])
  if (fearTarget && activeWolfTeam(game).some(seat => seat.number === Number(fearTarget))) wolfTarget = null
  const fogTargets = actionValue(game, 'alchemistWitch').targets || []
  if (fogTargets.length === 3 && game.special.alchemistWitch.fogAvailable) game.special.alchemistWitch.fogAvailable = false
  if (!wolfTarget && fogTargets.length === 3 && activeWolfTeam(game).length) wolfTarget = Number(fogTargets[Math.floor(Math.random() * fogTargets.length)])
  const copiedWitchChoice = maid && maidRole === 'witch' ? (maidAbility.choice || 'none') : 'none'
  const witchChoice = isFeared('witch') ? copiedWitchChoice : (actionValue(game, 'witch').choice || game.night.witchAction || 'none')
  const witchActor = copiedWitchChoice !== 'none' ? maid : actor('witch')
  const witchActionId = copiedWitchChoice !== 'none' ? 'eclipseMaidAbility' : 'witch'
  const witchTarget = effectiveActionTarget(game, witchActionId, witchActor, true)
  const saveUsed = witchChoice === 'save' && game.resources.antidote && wolfTarget
  if (saveUsed) {
    const saved = game.seats.find(seat => seat.number === wolfTarget)
    if (saved) saved.marks.silverWater = true
    game.resources.antidote = false
  }
  const poisonUsed = witchChoice === 'poison' && witchTarget && game.resources.poison && (witchActor === maid || !isFeared('witch'))
  if (poisonUsed) game.resources.poison = false

  const wolfVictim = wolfTarget && game.seats.find(seat => seat.number === wolfTarget)
  const wolfImmune = wolfVictim && ['cursedFox', 'evilKnight'].includes(wolfVictim.roleId)
  const guardedAndSaved = guardedTargets.includes(wolfTarget) && saveUsed
  const wolfProtected = fullProtection.includes(wolfTarget) || (guardedTargets.includes(wolfTarget) && !saveUsed) || (saveUsed && !guardedTargets.includes(wolfTarget))
  if (wolfVictim && !wolfImmune && (!wolfProtected || guardedAndSaved)) {
    const snake = actor('alchemistWitch')
    if (snake && game.special.alchemistWitch.snakeAvailable) game.special.alchemistWitch.pendingWolfTarget = wolfTarget
    else addEvent(wolfTarget, 'wolfAttack')
  } else game.special.alchemistWitch.pendingWolfTarget = null

  let poisonHitEvilKnight = false
  if (poisonUsed) {
    const target = game.seats.find(seat => seat.number === witchTarget)
    if (target && target.roleId === 'evilKnight') poisonHitEvilKnight = true
    else if (target && !['cursedFox', 'demonHunter'].includes(target.roleId) && !fullProtection.includes(witchTarget)) addEvent(witchTarget, 'poison')
  }

  const seer = actor('seer')
  const copiedSeer = maid && maidRole === 'seer'
  const seerTarget = copiedSeer ? effectiveActionTarget(game, 'eclipseMaidAbility', maid) : (!isFeared('seer') ? effectiveActionTarget(game, 'seer', seer, true) : null)
  const inspected = seerTarget && game.seats.find(seat => seat.number === seerTarget)
  if (inspected && inspected.roleId === 'cursedFox') addEvent(inspected.number, 'inspection')
  const seerHitEvilKnight = Boolean(inspected && inspected.roleId === 'evilKnight' && seer)
  if (seerHitEvilKnight) addEvent(seer.number, 'inspection')
  else if (poisonHitEvilKnight && witchActor) addEvent(witchActor.number, 'inspection')
  if (inspected && inspected && roles[effectiveRoleId(game, inspected)] && roles[effectiveRoleId(game, inspected)].camp !== 'wolf') inspected.marks.goldWater = true

  if (game.day >= 2) {
    const wolfWitchTarget = effectiveActionTarget(game, 'wolfWitch', actor('wolfWitch'))
    const pureTarget = effectiveActionTarget(game, 'pureWhiteGirl', actor('pureWhiteGirl'), true)
    const wolfWitchVictim = wolfWitchTarget && game.seats.find(seat => seat.number === wolfWitchTarget)
    const pureVictim = pureTarget && game.seats.find(seat => seat.number === pureTarget)
    if (wolfWitchVictim && wolfWitchVictim.roleId === 'pureWhiteGirl') addEvent(wolfWitchVictim.number, 'inspection')
    if (pureVictim && roles[pureVictim.roleId].camp === 'wolf') addEvent(pureVictim.number, 'inspection')
  }

  const crowClaw = rawNightTarget(game, 'wolfCrowClaw')
  if (crowClaw && game.special.wolfCrowClaw.clawAvailable) {
    addEvent(crowClaw, 'awakenedClaw')
    game.special.wolfCrowClaw.clawAvailable = false
    game.special.wolfCrowClaw.used = true
  }
  if (hiddenSkillReady && hiddenRole === 'witch' && hiddenSkill.choice === 'poison' && hiddenSkill.target && game.special.awakenedHiddenWolf.poisonAvailable) {
    addEvent(hiddenSkill.target, 'poison')
    game.special.awakenedHiddenWolf.poisonAvailable = false
  }
  if (hiddenSkillReady && hiddenRole === 'mirrorGirl' && hiddenSkill.target) game.special.awakenedHiddenWolf.inspectedTargets.push(Number(hiddenSkill.target))
  const hiddenExtra = hidden && game.special.awakenedHiddenWolf.joined && game.special.awakenedHiddenWolf.extraClawAvailable ? rawNightTarget(game, 'hiddenWolfAbility') : null
  if (hiddenRole === 'wolf' && hiddenExtra) {
    addEvent(hiddenExtra, 'awakenedClaw')
    game.special.awakenedHiddenWolf.extraClawAvailable = false
    game.special.awakenedHiddenWolf.extraClawUsed = true
  }

  const huntTarget = effectiveActionTarget(game, 'demonHunter', actor('demonHunter'), true)
  if (huntTarget) {
    const hunted = game.seats.find(seat => seat.number === huntTarget)
    if (hunted && roles[hunted.roleId].camp === 'wolf' && hunted.roleId !== 'evilKnight') addEvent(hunted.number, 'hunt')
    else if (hunted && roles[hunted.roleId].camp !== 'wolf') addEvent(actor('demonHunter').number, 'hunt')
  }

  if (dreamTarget && game.special.dreamerLastTarget === dreamTarget && radiant !== dreamTarget) addEvent(dreamTarget, 'dream')
  game.special.dreamerLastTarget = dreamTarget || null
  if (radiant) game.special.radiantCountLastTarget = radiant
  if (normalGuard) game.resources.lastGuardTarget = rawNightTarget(game, 'guard')
  const maidBacklash = maid && devoured && (devoured.roleId === 'radiantCount' || radiant === devoured.number)
  if (maidBacklash) addEvent(maid.number, 'backlash')
  if (maid && dreamTarget === maid.number && dreamer && events.some(event => event.number === maid.number)) addEvent(dreamTarget, 'dreamFollow')
  if (dreamer && events.some(event => event.number === dreamer.number) && dreamTarget && radiant !== dreamTarget) addEvent(dreamTarget, 'dreamFollow')

  if (luckyState && luckyAction.target && !luckyState.used) {
    if (luckyState.skill === 'poison') addEvent(luckyAction.target, 'poison')
    if (luckyState.skill === 'inspect') {
      const luckyInspected = game.seats.find(seat => seat.number === Number(luckyAction.target))
      if (luckyInspected && luckyInspected.roleId === 'cursedFox') addEvent(luckyInspected.number, 'inspection')
    }
    luckyState.used = true
  }
  const mirrorTarget = rawNightTarget(game, 'mirrorGirl')
  if (mirrorTarget && !game.special.mirrorGirlInspected.includes(mirrorTarget)) game.special.mirrorGirlInspected.push(mirrorTarget)
  const gargoyleTarget = rawNightTarget(game, 'gargoyle')
  if (gargoyleTarget && !game.special.gargoyleInspected.includes(gargoyleTarget)) game.special.gargoyleInspected.push(gargoyleTarget)
  game.special.crowTarget = rawNightTarget(game, 'crow') || null
  const delayedApostle = game.special.bloodApostleDelayed && game.seats.find(seat => seat.alive && seat.roleId === 'bloodApostle')
  if (delayedApostle) {
    addEvent(delayedApostle.number, 'exile')
    game.special.bloodApostleDelayed = false
  }

  const deaths = []
  events.forEach(event => {
    const seat = kill(game, event.number, event.cause)
    if (seat) deaths.push(seat)
  })
  game.latestNightDeathNumbers = deaths.map(item => item.number).sort((a, b) => a - b)
  const text = game.latestNightDeathNumbers.length ? game.latestNightDeathNumbers.map(number => `${number}号`).join('、') + '出局' : (game.special.alchemistWitch.pendingWolfTarget ? '狼刀待法老之蛇结算' : '平安夜')
  addLog(game, `第${game.day}夜：${text}`)
  game.phase = 'day'
  game.dayState = createDayState(game)
  game.special.goodSkillsSealedTonight = false
  evaluateWinner(game)
  return deaths
}

function resolveAlchemistSnake(game, useSnake) {
  ensureGameState(game)
  const number = game.special.alchemistWitch.pendingWolfTarget
  if (!number) throw new Error('当前没有待法老之蛇结算的狼刀目标')
  const alchemist = aliveSeatForRole(game, 'alchemistWitch')
  const canSelfSave = alchemist && alchemist.number === number && game.day === 1
  const use = Boolean(useSnake && alchemist && game.special.alchemistWitch.snakeAvailable && (alchemist.number !== number || canSelfSave))
  if (use) {
    game.special.alchemistWitch.snakeAvailable = false
    const saved = game.seats.find(seat => seat.number === number)
    if (saved) saved.marks.silverWater = true
    addLog(game, `炼金魔女使用法老之蛇救回${number}号`)
  } else {
    const seat = kill(game, number, 'wolfAttack')
    if (seat) game.latestNightDeathNumbers = [...new Set([...(game.latestNightDeathNumbers || []), number])].sort((a, b) => a - b)
    addLog(game, `炼金魔女未使用法老之蛇，${number}号确认出局`)
  }
  game.special.alchemistWitch.pendingWolfTarget = null
  evaluateWinner(game)
  return use
}

function canUseOrderPrince(game) {
  ensureGameState(game)
  return Boolean(aliveSeatForRole(game, 'orderPrince') && !game.special.orderPrince.used && game.dayState && !game.dayState.exilePk)
}

function resolveOrderPrince(game, activate) {
  ensureGameState(game)
  const state = game.dayState
  if (!state || state.stage !== 'orderPrinceDecision' || !state.pendingExileSeat) throw new Error('当前不在定序王子判定阶段')
  if (activate) {
    if (!canUseOrderPrince(game)) throw new Error('定序王子当前不能发动技能')
    game.special.orderPrince.used = true
    game.special.orderPrince.revealed = true
    state.stage = 'orderPrinceSpeech'
    addLog(game, `第${game.day}天：定序王子翻牌，重置本次放逐投票`)
    return null
  }
  const number = state.pendingExileSeat
  state.pendingExileSeat = null
  applyDayEvent(game, 'exile', number)
  return number
}

function resolveKnightDuel(game, targetNumber) {
  ensureGameState(game)
  const knight = aliveSeatForRole(game, 'knight')
  const state = game.dayState
  if (!knight || game.special.knightUsed || !state || !['discussion', 'alchemistDiscussion'].includes(state.stage)) throw new Error('骑士当前不能发动决斗')
  const target = game.seats.find(seat => seat.alive && seat.number === Number(targetNumber) && seat.number !== knight.number)
  if (!target) throw new Error('请选择其他存活玩家进行决斗')
  game.special.knightUsed = true
  if (roles[target.roleId].camp === 'wolf') {
    kill(game, target.number, 'knightDuel')
    state.afterDeathStage = 'selfExposeNight'
    state.endAfterDeathSkills = true
    addLog(game, `骑士翻牌决斗${target.number}号，目标属于狼人阵营`)
  } else {
    kill(game, knight.number, 'knightDuel')
    state.afterDeathStage = state.stage
    addLog(game, `骑士翻牌决斗${target.number}号，目标属于非狼人阵营，骑士出局`)
  }
  state.stage = 'deathSkills'
  evaluateWinner(game)
  return roles[target.roleId].camp
}

function createDayState(game) {
  const resumeElection = game.sheriffElectionInterrupted && !game.sheriffElectionDone && game.sheriffElectionSnapshot
  const snapshot = game.sheriffElectionSnapshot || {}
  const snakePending = Boolean(game.special && game.special.alchemistWitch && game.special.alchemistWitch.pendingWolfTarget)
  return {
    stage: resumeElection ? 'sheriffResumeWithdraw' : game.sheriffElectionDone ? (snakePending ? 'alchemistDiscussion' : 'announceNight') : 'sheriffSignup',
    sheriffCandidates: resumeElection ? (snapshot.sheriffCandidates || []) : [],
    sheriffInitialCandidates: resumeElection ? (snapshot.sheriffInitialCandidates || []) : [],
    sheriffWithdrawn: resumeElection ? (snapshot.sheriffWithdrawn || []) : [],
    sheriffVotes: {},
    exileMode: 'individual',
    exileVotes: {},
    simpleVoteCounts: {},
    discussionBeforeNight: false
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
      queueSheriffTransfer(game, seat, '愚者翻牌')
      addLog(game, `第${game.day}天：${seat.number}号愚者被放逐，翻牌但不出局`)
    } else if (seat.roleId === 'bloodApostle' && !game.seats.some(other => other.alive && other.number !== seat.number && roles[other.roleId] && roles[other.roleId].camp === 'wolf')) {
      game.special.bloodApostleDelayed = true
      addLog(game, `第${game.day}天：${number}号血夜使徒被放逐，延迟至下一次天亮出局`)
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
    if (seat.roleId === 'bloodApostle') game.special.goodSkillsSealedTonight = true
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
  game.night = emptyNight()
  game.dayState = null
  addLog(game, `进入第${game.day}夜`)
}

function evaluateWinner(game) {
  if (game.status === 'ended') {
    game.pendingSheriffTransfer = null
    return game.winner
  }
  if (game.pendingDeathSkills && game.pendingDeathSkills.length) return null
  if (game.pendingWolfKingClaw) return null
  if (game.special && game.special.alchemistWitch && game.special.alchemistWitch.pendingWolfTarget) return null
  if (game.seats.some(seat => !roles[seat.roleId])) return null
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
    game.pendingSheriffTransfer = null
    addLog(game, `游戏结束：${winner}获胜`)
  }
  return winner
}

module.exports = { makeGame, makeFirstNightIdentityGame, getIdentityAssignmentPrompt, toggleIdentityAssignmentSeat, completeIdentityAssignment, roleAlive, setLonelyGirlTarget, setNightActionTarget, setNightActionChoice, setWitchAction, toggleNightActionTarget, clearNightAction, getNightActionCards, getWolfTeamNumbers, inspectionResult, settleNight, resolveAlchemistSnake, canUseOrderPrince, resolveOrderPrince, resolveKnightDuel, applyDayEvent, nextNight, evaluateWinner, addLog, checkpointStep, restoreStep, createDayState, canUseDeathSkill, resolveDeathSkill, resolveSheriffTransfer, addVoteHistory, shouldHaveLastWords }
