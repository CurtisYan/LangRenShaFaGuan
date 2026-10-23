const assert = require('assert')
const { buildCustomBoard } = require('../data/custom-board')
const { nightActionDefinitions } = require('../data/night-actions')
const engine = require('../utils/game-engine')
const { getBoard } = require('../data/boards')
const create = (counts, options = {}) => {
  const board = buildCustomBoard(counts, options)
  const game = engine.makeGame(board, Object.entries(counts).flatMap(([role, count]) => Array(count).fill(role)))
  return { board, game }
}
const number = (game, role) => game.seats.find(seat => seat.roleId === role).number
const drain = game => { while (game.pendingDeathSkills.length) engine.resolveDeathSkill(game, game.pendingDeathSkills[0].seatNumber, false) }

// 自由选角仍必须遵守文档中技能的先后依赖。
const mirror = create({ wolf: 2, awakenedHiddenWolf: 1, villager: 2, guard: 1, witch: 1, hunter: 1, mirrorGirl: 1 })
assert.deepEqual(mirror.board.firstNightSequence, ['mirrorGirlSignal', 'guard', 'wolves', 'witch', 'hunterStatus', 'awakenedHiddenWolf', 'mirrorGirl'])
assert.deepEqual(engine.getNightActionCards(mirror.game, mirror.board).map(card => card.id), mirror.board.firstNightSequence)
mirror.game.day = 2
mirror.game.special.awakenedHiddenWolf.mimickedRoleId = 'witch'
mirror.game.special.awakenedHiddenWolf.mimicDay = 1
assert.deepEqual(engine.getNightActionCards(mirror.game, mirror.board).map(card => card.id), ['guard', 'hiddenWolfStatus', 'wolves', 'witch', 'mirrorGirl', 'hiddenWolfAbility', 'hunterStatus'])
assert.throws(() => buildCustomBoard({ wolf: 1, whiteWolfKing: 1, awakenedHiddenWolf: 1, villager: 2 }), /最多选择一名大狼/)
const mimic = create({ wolf: 1, awakenedHiddenWolf: 1, villager: 1, seer: 1, witch: 1 })
assert.ok(mimic.board.warnings.some(warning => warning.includes('预言家')))
const mimicCard = engine.getNightActionCards(mimic.game, mimic.board).find(card => card.id === 'awakenedHiddenWolf')
assert.equal(mimicCard.targetNumbers.includes(number(mimic.game, 'seer')), false)
assert.equal(mimicCard.targetNumbers.includes(number(mimic.game, 'witch')), true)
assert.equal(Object.prototype.hasOwnProperty.call(nightActionDefinitions.awakenedHiddenWolf.copiedSkills, 'seer'), false)

// 模仿猎人的技能从当夜结束后的天亮即可用；不需要再等一整夜。
const hiddenHunter = create({ wolf: 1, awakenedHiddenWolf: 1, hunter: 1, villager: 2 })
engine.setNightActionTarget(hiddenHunter.game, 'awakenedHiddenWolf', number(hiddenHunter.game, 'hunter'))
engine.setNightActionTarget(hiddenHunter.game, 'wolves', number(hiddenHunter.game, 'awakenedHiddenWolf'))
engine.settleNight(hiddenHunter.game)
const hiddenPrompt = hiddenHunter.game.pendingDeathSkills.find(prompt => prompt.seatNumber === number(hiddenHunter.game, 'awakenedHiddenWolf'))
assert.equal(engine.canUseDeathSkill(hiddenHunter.game, hiddenPrompt), true)

// 恐惧在夜间限制猎人，白天被放逐不受上一夜恐惧限制。
const feared = create({ wolf: 1, nightmare: 1, hunter: 1, villager: 2 })
assert.equal(feared.board.firstNightSequence[0], 'nightmare')
engine.setNightActionTarget(feared.game, 'nightmare', number(feared.game, 'hunter'))
engine.setNightActionTarget(feared.game, 'wolves', number(feared.game, 'hunter'))
engine.settleNight(feared.game)
assert.equal(engine.canUseDeathSkill(feared.game, feared.game.pendingDeathSkills[0]), false)
const dayHunter = create({ wolf: 1, nightmare: 1, hunter: 1, villager: 2 })
engine.setNightActionTarget(dayHunter.game, 'nightmare', number(dayHunter.game, 'hunter'))
engine.settleNight(dayHunter.game)
engine.applyDayEvent(dayHunter.game, 'exile', number(dayHunter.game, 'hunter'))
assert.equal(engine.canUseDeathSkill(dayHunter.game, dayHunter.game.pendingDeathSkills[0]), true)
const charmed = create({ wolf: 1, wolfBeauty: 1, hunter: 1, villager: 2 })
engine.setNightActionTarget(charmed.game, 'wolfBeauty', number(charmed.game, 'hunter'))
engine.setNightActionTarget(charmed.game, 'wolves', number(charmed.game, 'wolfBeauty'))
engine.settleNight(charmed.game)
assert.equal(engine.canUseDeathSkill(charmed.game, charmed.game.pendingDeathSkills.find(prompt => prompt.seatNumber === number(charmed.game, 'hunter'))), false)

// 预先录入过的技能在被恐惧后不得残留生效。
const fearedHunt = create({ wolf: 1, nightmare: 1, demonHunter: 1, villager: 2 })
fearedHunt.game.day = 2
engine.setNightActionTarget(fearedHunt.game, 'nightmare', number(fearedHunt.game, 'demonHunter'))
engine.setNightActionTarget(fearedHunt.game, 'demonHunter', number(fearedHunt.game, 'wolf'))
assert.equal(engine.getNightActionCards(fearedHunt.game, fearedHunt.board).find(card => card.id === 'demonHunter').enabled, false)
engine.settleNight(fearedHunt.game)
assert.equal(fearedHunt.game.seats[number(fearedHunt.game, 'wolf') - 1].alive, true)

// 可查验身份已全部验过时，必选查验不能使后续夜晚卡住。
const exhausted = create({ wolf: 1, mirrorGirl: 1, villager: 1 })
exhausted.game.day = 3
exhausted.game.special.mirrorGirlInspected = exhausted.game.seats.filter(seat => seat.roleId !== 'mirrorGirl').map(seat => seat.number)
const exhaustedCard = engine.getNightActionCards(exhausted.game, exhausted.board).find(card => card.id === 'mirrorGirl')
assert.equal(exhaustedCard.enabled, false)
assert.equal(exhaustedCard.targetNumbers.length, 0)

// 守墓人获知上次真正被放逐出局者；平安日和愚者翻牌不能沿用旧结果。
const grave = create({ wolf: 2, villager: 2, gravedigger: 1, fool: 1 })
grave.game.phase = 'day'
engine.applyDayEvent(grave.game, 'exile', 1)
drain(grave.game)
assert.equal(grave.game.special.lastExiledSeat, 1)
engine.nextNight(grave.game)
assert.match(engine.getNightActionCards(grave.game, grave.board).find(card => card.id === 'gravedigger').result, /狼人阵营/)
engine.applyDayEvent(grave.game, 'none')
assert.equal(grave.game.special.lastExiledSeat, null)
engine.applyDayEvent(grave.game, 'exile', number(grave.game, 'fool'))
assert.equal(grave.game.special.lastExiledSeat, null)

// 第一日不开警长时，法老之蛇也必须先于死讯和全场发言处理。
const snake = create({ wolf: 1, villager: 2, alchemistWitch: 1 })
engine.setNightActionTarget(snake.game, 'wolves', number(snake.game, 'villager'))
engine.settleNight(snake.game)
assert.equal(snake.game.dayState.stage, 'alchemistSnake')

// 双曝后恢复竞选只保留存活候选人，自动处理仅剩一人及无人可选。
for (const remaining of [0, 1, 2]) {
  const { game } = create({ wolf: 2, villager: 8, seer: 1 }, { sheriff: true })
  game.day = 2
  game.phase = 'day'
  game.sheriffElectionInterrupted = true
  game.sheriffElectionSnapshot = { sheriffCandidates: [1, 3], sheriffInitialCandidates: [1, 3], sheriffWithdrawn: [] }
  if (remaining < 2) game.seats[0].alive = false
  if (remaining === 0) game.seats[2].alive = false
  game.dayState = engine.createDayState(game)
  assert.equal(game.sheriffElectionDone, remaining < 2)
  assert.equal(game.dayState.stage, remaining === 2 ? 'sheriffResumeWithdraw' : 'announceNight')
  if (remaining === 1) assert.equal(game.sheriffSeat, 3)
  if (remaining === 0) assert.equal(game.sheriffSeat, null)
}

// 实际页面流转：所有人退水、警长PK再次平票、放逐PK再次平票。
let page
let toast = ''
let app = { globalData: { game: null }, saveGame(game) { this.globalData.game = game } }
global.getApp = () => app
global.Page = config => { page = config }
global.wx = { showToast: ({ title }) => { toast = title }, showActionSheet: ({ success }) => success({ tapIndex: 0 }) }
require('../pages/game/game')
page.setData = update => Object.assign(page.data, update)
const loadDay = () => {
  const { game } = create({ wolf: 2, villager: 8, seer: 1 }, { sheriff: true })
  game.phase = 'day'
  game.dayState = engine.createDayState(game)
  app.globalData.game = game
  page.refresh()
  return game
}
let day = loadDay()
day.dayState.stage = 'sheriffSpeech'
page.beginSheriffVote()
assert.equal(day.sheriffElectionDone, true)
assert.equal(day.dayState.stage, 'announceNight')
day = loadDay()
day.dayState.stage = 'sheriffVote'
day.dayState.sheriffCandidates = [1, 3]
day.dayState.sheriffInitialCandidates = [1, 3]
day.dayState.sheriffVotes = { 2: 1, 4: 3 }
day.dayState.sheriffPk = true
page.resolveSheriffVote()
assert.equal(day.sheriffElectionDone, true)
assert.equal(day.sheriffSeat, null)
assert.equal(day.dayState.stage, 'announceNight')
day = loadDay()
day.dayState.stage = 'exileVote'
day.dayState.exilePk = true
day.dayState.exileTieCandidates = [1, 3]
day.dayState.exileVotes = { 2: 1, 4: 3 }
page.resolveExileVote()
assert.equal(day.dayState.stage, 'exileDone')
assert.equal(day.seats.every(seat => seat.alive), true)
console.log('custom flow regression tests passed')

// 没有普通狼、仅有一名不入狼队大狼时，首夜仍要先确认它，再让它接刀。
for (const isolated of ['gargoyle', 'awakenedHiddenWolf']) {
  const board = buildCustomBoard({ [isolated]: 1, villager: 2, witch: 1 })
  const game = engine.makeFirstNightIdentityGame(board)
  const prompt = engine.getIdentityAssignmentPrompt(game, board)
  assert.equal(prompt.roleId, isolated)
  engine.toggleIdentityAssignmentSeat(game, board, 1)
  engine.completeIdentityAssignment(game, board)
  assert.equal(engine.getGuidedFirstNightAction(game, board).id, 'wolves')
  assert.equal(engine.getGuidedFirstNightAction(game, board).enabled, true)
}
assert.throws(() => engine.setNightActionTarget(mimic.game, 'awakenedHiddenWolf', number(mimic.game, 'seer')), /不能模仿/)
assert.throws(() => engine.makeGame(mimic.board, ['wolf']), /人数不一致/)
assert.throws(() => engine.makeGame(mimic.board, ['wolf', 'wolf', 'villager', 'seer', 'witch']), /角色数量不一致/)

// 首夜出局技能连锁有遗言时，按号码排序；白天放逐连锁跟随技能发动者。
for (const night of [true, false]) {
  const chain = create({ wolf: 2, wolfKing: 1, hunter: 1, villager: 3, seer: 1 })
  const h = number(chain.game, 'hunter')
  const k = number(chain.game, 'wolfKing')
  if (night) { engine.setNightActionTarget(chain.game, 'wolves', h); engine.settleNight(chain.game) }
  else { chain.game.phase = 'day'; chain.game.dayState = engine.createDayState(chain.game); engine.applyDayEvent(chain.game, 'exile', h) }
  engine.resolveDeathSkill(chain.game, h, true, k)
  assert.equal(chain.game.pendingDeathSkills[0].seatNumber, k)
  engine.resolveDeathSkill(chain.game, k, true, 5)
  assert.deepEqual(chain.game.pendingLastWords.map(item => item.seatNumber), night ? [k, h, 5] : [h, k, 5])
}

// 白狼王在警上发动爪击，立即吞徽，不等第二次自曝。
const white = create({ wolf: 2, whiteWolfKing: 1, villager: 7, seer: 1 }, { sheriff: true })
white.game.phase = 'day'
white.game.dayState = engine.createDayState(white.game)
white.game.dayState.stage = 'sheriffSpeech'
engine.applyDayEvent(white.game, 'selfExpose', number(white.game, 'whiteWolfKing'))
white.game.sheriffElectionInterrupted = true
engine.resolveDeathSkill(white.game, number(white.game, 'whiteWolfKing'), true, 4)
assert.equal(white.game.sheriffElectionDone, true)
assert.equal(white.game.sheriffElectionInterrupted, false)
assert.equal(white.game.dayState.afterDeathStage, 'selfExposeNight')

// 首夜吃毒的普通狼警上仍能自曝，且不能把毒死改记成白天自曝死亡。
day = loadDay()
day.seats[0].alive = false
day.seats[0].deathCause = '女巫毒药'
day.seats[0].deathCauseId = 'poison'
day.latestNightDeathNumbers = [1]
day.dayState.stage = 'sheriffSpeech'
page.refresh()
assert.equal(page.data.selfExposeCandidates.some(seat => seat.number === 1), true)
global.wx.showActionSheet = ({ success }) => success({ tapIndex: page.data.selfExposeCandidates.findIndex(seat => seat.number === 1) })
page.triggerSelfExpose()
assert.equal(day.selfExposeCount, 1)
assert.equal(day.sheriffElectionInterrupted, true)
assert.equal(day.dayState.endAfterDeathSkills, true)
assert.equal(day.seats[0].deathCauseId, 'poison')

console.log('custom identity, chain and exposure regression tests passed')

// 完整弃票和配置限制不能卡在当前页面。
day = loadDay()
day.dayState.stage = 'sheriffVote'
day.dayState.sheriffCandidates = [1, 3]
day.dayState.sheriffInitialCandidates = [1, 3]
day.dayState.sheriffVotes = { 2: null, 4: null }
page.refresh()
page.resolveSheriffVote()
assert.equal(day.sheriffElectionDone, true)
assert.equal(day.sheriffSeat, null)
assert.match(day.voteHistory[0].label, /全员弃票/)
assert.throws(() => buildCustomBoard({ wolf: 1, eclipseMaid: 1, hunter: 1, villager: 2 }), /不能.*同时选入/)

for (const size of [6, 8, 9, 10, 11, 12]) {
  const board = buildCustomBoard({ wolf: 2, villager: size - 3, seer: 1 }, { sheriff: true, exposure: 'double' })
  assert.equal(board.dayRules.sheriff, size >= 9)
  assert.equal(board.settings.exposure, size <= 10 ? 'single' : 'double')
  assert.equal(board.dayRules.exposure, size < 9 ? 'none' : size <= 10 ? 'single' : 'double')
}

const copied = role => {
  const context = create({ wolf: 2, eclipseMaid: 1, [role]: 1, villager: 3, seer: 1 })
  context.game.day = 2
  engine.setNightActionTarget(context.game, 'eclipseMaid', 4)
  return context
}
let copy = copied('magician')
engine.toggleNightActionTarget(copy.game, 'eclipseMaidAbility', 5, 2)
engine.toggleNightActionTarget(copy.game, 'eclipseMaidAbility', 6, 2)
engine.setNightActionTarget(copy.game, 'wolves', 5)
let copyCard = engine.getNightActionCards(copy.game, copy.board).find(card => card.id === 'eclipseMaidAbility')
assert.equal(copyCard.kind, 'multiTarget')
assert.equal(copyCard.targetCount, 2)
assert.equal(copyCard.hostLine, '蚀日侍女请睁眼。', '主持词不能泄露吞噬到的角色')
engine.settleNight(copy.game)
assert.equal(copy.game.seats[5].alive, false, '继承的魔术交换必须实际改变狼刀承受者')
assert.equal(copy.game.seats[4].alive, true)
assert.equal(copy.game.special.magicianUsed, true)
copy = copied('crow')
engine.setNightActionTarget(copy.game, 'eclipseMaidAbility', 5)
engine.settleNight(copy.game)
assert.equal(copy.game.special.crowTarget, 5, '继承乌鸦必须实际记录诅咒')
copy = copied('dreamer')
copy.game.special.dreamerLastTarget = 5
engine.setNightActionTarget(copy.game, 'eclipseMaidAbility', 5)
engine.settleNight(copy.game)
assert.equal(copy.game.seats[4].alive, false, '继承摄梦人连续梦同一人也应梦亡')
assert.equal(copy.game.special.dreamerLastTarget, 5)
copy = copied('miracleMerchant')
engine.setNightActionChoice(copy.game, 'eclipseMaidAbility', 'poison')
engine.setNightActionTarget(copy.game, 'eclipseMaidAbility', 5)
engine.setNightActionTarget(copy.game, 'luckySkill', 1)
copyCard = engine.getNightActionCards(copy.game, copy.board).find(card => card.id === 'eclipseMaidAbility')
assert.equal(copyCard.kind, 'skillTarget')
assert.deepEqual(copyCard.choiceValues, ['inspect', 'poison', 'guard'])
engine.settleNight(copy.game)
assert.equal(copy.game.special.miracleMerchantUsed, true)
assert.equal(copy.game.seats[0].alive, false, '继承交易赋予的毒药应生效')
copy = copied('alchemistWitch')
;[5, 6, 7].forEach(target => engine.toggleNightActionTarget(copy.game, 'eclipseMaidAbility', target, 3))
engine.setNightActionTarget(copy.game, 'wolves', 5)
copyCard = engine.getNightActionCards(copy.game, copy.board).find(card => card.id === 'eclipseMaidAbility')
assert.equal(copyCard.targetCount, 3)
engine.settleNight(copy.game)
assert.equal(copy.game.special.alchemistWitch.fogAvailable, false)
assert.equal(copy.game.special.alchemistWitch.handlerSeat, 3)
engine.resolveAlchemistSnake(copy.game, true)
assert.equal(copy.game.seats[4].alive, true)
assert.equal(copy.game.special.alchemistWitch.snakeAvailable, false)

const partial = create({ wolf: 1, witch: 1, villager: 2 })
engine.setWitchAction(partial.game, 'poison')
assert.throws(() => engine.settleNight(partial.game), /完整记录/)
assert.equal(partial.game.resources.poison, true, '缺目标时不能消耗毒药')

console.log('custom inherited skills and player-limit regression tests passed')

// 行动查询必须保留状态引用，不能让结算写入已被替换的旧对象。
const stable = create({ wolf: 1, crow: 1, villager: 2 })
const specialRef = stable.game.special
const nestedRef = stable.game.special.awakenedHiddenWolf
engine.getNightActionCards(stable.game, stable.board)
assert.strictEqual(stable.game.special, specialRef)
assert.strictEqual(stable.game.special.awakenedHiddenWolf, nestedRef)
engine.setNightActionTarget(stable.game, 'crow', 3)
engine.settleNight(stable.game)
assert.equal(stable.game.special.crowTarget, 3)

// 恶灵骑士不能被新组合中的夜间查验击杀，反伤也只能触发一次。
const evil = create({ wolf: 1, evilKnight: 1, pureWhiteGirl: 1, villager: 2 })
evil.game.day = 2
engine.setNightActionTarget(evil.game, 'pureWhiteGirl', 2)
engine.settleNight(evil.game)
assert.equal(evil.game.seats[1].alive, true)
const backlash = create({ wolf: 1, evilKnight: 1, seer: 1, witch: 1, villager: 2 })
backlash.game.special.evilKnightBacklashUsed = true
engine.setNightActionTarget(backlash.game, 'seer', 2)
engine.settleNight(backlash.game)
assert.equal(backlash.game.seats[2].alive, true)
console.log('state-reference and night-immunity regression tests passed')
