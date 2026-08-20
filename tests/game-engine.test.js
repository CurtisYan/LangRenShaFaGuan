const assert = require('assert')
const { getBoard } = require('../data/boards')
const engine = require('../utils/game-engine')

const roles = ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'fool']

function fresh() { return engine.makeGame(getBoard('standard12'), roles) }
const wolfKingRoles = ['wolf', 'wolf', 'wolf', 'wolfKing', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard']
function wolfKingFresh() { return engine.makeGame(getBoard('wolfKingMagician12'), wolfKingRoles) }
function boardRoles(boardId) {
  return Object.entries(getBoard(boardId).roleCounts).flatMap(([roleId, count]) => Array(count).fill(roleId))
}
function resolveAllDeathPrompts(game) {
  while (game.pendingDeathSkills.length) engine.resolveDeathSkill(game, game.pendingDeathSkills[0].seatNumber, false)
}

{
  const game = fresh()
  game.night.wolfTarget = 5
  game.night.witchAction = 'save'
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, true)
}

{
  const standard = getBoard('standard12')
  const evilKnight = getBoard('evilKnightGuard12')
  assert.equal(standard.dayRules.selfExposeRoleIds.includes('wolf'), true, '普通狼人应可以自曝')
  assert.equal(evilKnight.dayRules.selfExposeRoleIds.includes('evilKnight'), false, '恶灵骑士不能自曝')
  const game = fresh()
  assert.throws(() => engine.applyDayEvent(game, 'selfExpose', 5), /不能自曝/, '非自曝身份不能通过引擎自曝')
  engine.applyDayEvent(game, 'selfExpose', 1)
  assert.equal(game.seats[0].alive, false, '可自曝狼人应正常出局')
}

{
  const board = getBoard('lonelyGirl12')
  assert.equal(board.playerCount, 12, '孤独少女场应可正常开局')
  const game = engine.makeGame(board, boardRoles('lonelyGirl12'))
  const lonelyGirl = game.seats.find(seat => seat.roleId === 'lonelyGirl')
  engine.setLonelyGirlTarget(game, 1)
  assert.equal(game.special.lonelyGirlTarget, 1, '应记录孤独少女的崇拜对象')
  ;[5, 6, 7].forEach(number => engine.applyDayEvent(game, 'shot', number))
  resolveAllDeathPrompts(game)
  assert.equal(game.winner, null, '孤独少女存活时，狼人不能仅因平民全部出局获胜')
  engine.applyDayEvent(game, 'shot', lonelyGirl.number)
  resolveAllDeathPrompts(game)
  assert.equal(game.winner, '狼人阵营', '孤独少女出局后应重新按胜负条件结算')
}

{
  const game = engine.makeGame(getBoard('brotherFoxCrow12'), boardRoles('brotherFoxCrow12'))
  const fox = game.seats.find(seat => seat.roleId === 'cursedFox')
  game.night.wolfTarget = fox.number
  game.night.witchAction = 'poison'
  game.night.witchTarget = fox.number
  game.night.seerTarget = fox.number
  engine.settleNight(game)
  assert.equal(fox.alive, false, '咒狐被查验时应出局')
  assert.equal(fox.deathCause, '预言家查验', '狼刀与毒药不应覆盖咒狐的查验出局原因')
}

{
  const game = engine.makeGame(getBoard('brotherFoxCrow12'), boardRoles('brotherFoxCrow12'))
  ;[4, 5, 6, 7].forEach(number => engine.applyDayEvent(game, 'shot', number))
  resolveAllDeathPrompts(game)
  assert.equal(game.winner, '咒狐', '咒狐存活时任一阵营达成条件应由咒狐获胜')
}

{
  const game = wolfKingFresh()
  game.night.wolfTarget = 5
  game.night.guardTarget = 5
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, true, '守卫应挡住狼刀')
}

{
  const game = wolfKingFresh()
  game.night.wolfTarget = 5
  game.night.guardTarget = 5
  game.night.witchAction = 'save'
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, false, '同守同救仍应出局')
}

{
  const game = wolfKingFresh()
  game.resources.lastGuardTarget = 5
  game.night.guardTarget = 5
  assert.throws(() => engine.settleNight(game), /不能连续/)
}

{
  const game = wolfKingFresh()
  engine.applyDayEvent(game, 'exile', 4)
  assert.equal(game.pendingWolfKingClaw, true)
  engine.applyDayEvent(game, 'wolfKingClaw', 5)
  assert.equal(game.seats[4].alive, false)
  assert.equal(game.pendingWolfKingClaw, false)
}

{
  const game = wolfKingFresh()
  game.night.witchAction = 'poison'
  game.night.witchTarget = 4
  engine.settleNight(game)
  assert.equal(game.pendingWolfKingClaw, false, '狼王被毒死不能发动爪击')
}

{
  const game = fresh()
  game.night.wolfTarget = 5
  game.night.witchAction = 'poison'
  game.night.witchTarget = 1
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, false)
  assert.equal(game.seats[0].alive, false)
}

{
  const game = fresh()
  engine.applyDayEvent(game, 'exile', 12)
  assert.equal(game.seats[11].alive, true)
  assert.equal(game.seats[11].foolRevealed, true)
}

{
  const game = fresh()
  ;[1, 2, 3, 4].forEach(number => engine.applyDayEvent(game, 'shot', number))
  assert.equal(game.winner, null, '所有死亡技能询问完成前不能判胜')
  resolveAllDeathPrompts(game)
  assert.equal(game.winner, '好人阵营')
}

{
  const game = fresh()
  engine.applyDayEvent(game, 'exile', 11)
  assert.equal(game.pendingDeathSkills[0].seatNumber, 11, '每个出局玩家均应进入询问队列')
  assert.equal(engine.canUseDeathSkill(game, game.pendingDeathSkills[0]), true)
  engine.resolveDeathSkill(game, 11, true, 1)
  assert.equal(game.seats[0].alive, false, '猎人发动技能应带走目标')
}

{
  const game = fresh()
  game.night.witchAction = 'poison'
  game.night.witchTarget = 11
  engine.settleNight(game)
  assert.equal(engine.canUseDeathSkill(game, game.pendingDeathSkills[0]), false, '猎人被毒死不能发动技能')
}

{
  const game = fresh()
  game.night.wolfTarget = 5
  engine.settleNight(game)
  assert.equal(game.pendingLastWords[0].seatNumber, 5, '首夜倒牌应有遗言')
  game.day = 2
  engine.applyDayEvent(game, 'shot', 6)
  assert.equal(game.pendingLastWords.some(item => item.seatNumber === 6), false, '第二天技能带走不应有遗言')
  engine.applyDayEvent(game, 'exile', 7)
  assert.equal(game.pendingLastWords.some(item => item.seatNumber === 7), true, '放逐对象应有遗言')
}

{
  const game = fresh()
  engine.checkpointStep(game, '进入白天')
  game.day = 2
  game.phase = 'day'
  engine.applyDayEvent(game, 'shot', 5)
  const restored = engine.restoreStep(game)
  assert.equal(restored.label, '进入白天')
  assert.equal(restored.game.day, 1, '返回步骤应恢复原天数')
  assert.equal(restored.game.phase, 'night', '返回步骤应恢复原阶段')
  assert.equal(restored.game.seats[4].alive, true, '返回步骤应恢复座位状态')
  assert.equal(restored.game.stepHistory.length, 0, '已返回的步骤不应再次留在历史中')
}

console.log('game-engine tests passed')
