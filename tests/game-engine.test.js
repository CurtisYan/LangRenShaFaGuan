const assert = require('assert')
const { getBoard } = require('../data/boards')
const engine = require('../utils/game-engine')

const roles = ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'fool']

function fresh() { return engine.makeGame(getBoard('standard12'), roles) }
const wolfKingRoles = ['wolf', 'wolf', 'wolf', 'wolfKing', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard']
function wolfKingFresh() { return engine.makeGame(getBoard('wolfKingMagician12'), wolfKingRoles) }
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

console.log('game-engine tests passed')
