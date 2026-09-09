const assert = require('assert')
const { getBoard } = require('../data/boards')
const { boards } = require('../data/boards')
const { roles: roleDefinitions } = require('../data/roles')
const engine = require('../utils/game-engine')

const roles = ['wolf', 'wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'fool']

function fresh() { return engine.makeGame(getBoard('standard12'), roles) }
const wolfKingRoles = ['wolf', 'wolf', 'wolf', 'wolfKing', 'villager', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter', 'guard']
function wolfKingFresh() { return engine.makeGame(getBoard('wolfKingMagician12'), wolfKingRoles) }
function boardRoles(boardId) {
  return Object.entries(getBoard(boardId).roleCounts).flatMap(([roleId, count]) => Array(count).fill(roleId))
}
function completeFirstNightIdentities(game, board) {
  while (!game.identityAssignment.complete) {
    const prompt = engine.getIdentityAssignmentPrompt(game)
    const available = game.seats.filter(seat => !seat.roleId).slice(0, prompt.required)
    available.forEach(seat => engine.toggleIdentityAssignmentSeat(game, board, seat.number))
    engine.completeIdentityAssignment(game, board)
  }
}
function resolveAllDeathPrompts(game) {
  while (game.pendingDeathSkills.length) engine.resolveDeathSkill(game, game.pendingDeathSkills[0].seatNumber, false)
}

{
  assert.equal(boards.length, 18, '文档中的18个板子都应可以开局')
  boards.forEach(board => {
    assert.equal(board.nightSequence[board.nightSequence.length - 1], board.roleCounts.seer ? 'seer' : board.id === 'pureWhiteNight12' ? 'pureWhiteGirl' : board.id === 'mirrorMystery12' ? 'mirrorGirl' : board.nightSequence[board.nightSequence.length - 1], `${board.name}的查验身份应收在夜间流程末尾`)
  })
  const hiddenOrder = getBoard('mirrorMystery12').nightSequence
  assert.ok(hiddenOrder.indexOf('awakenedHiddenWolf') < hiddenOrder.indexOf('wolves'), '觉醒隐狼必须先于狼刀行动')
  const kingOrder = getBoard('awakenedWolfKing12').nightSequence
  assert.equal(kingOrder.indexOf('awakenedWolfKing'), kingOrder.indexOf('wolves') + 1, '觉醒狼王必须紧跟狼刀行动')
  ;[['wolfBeautyKnight12', 'wolfBeauty'], ['gargoyleGravedigger12', 'gargoyle'], ['pureWhiteNight12', 'wolfWitch'], ['fogCrow12', 'wolfCrowClaw']].forEach(([boardId, actionId]) => {
    const order = getBoard(boardId).nightSequence
    assert.ok(order.indexOf(actionId) > order.indexOf('wolves'), `${actionId}应在狼刀后行动`)
  })
  boards.forEach(board => {
    const game = engine.makeFirstNightIdentityGame(board)
    completeFirstNightIdentities(game, board)
    assert.deepEqual(engine.getNightActionCards(game, board).map(card => card.id), board.nightSequence, `${board.name}两种身份确认时机必须复用同一夜间序列`)
  })
}

{
  const board = getBoard('standard12')
  const game = engine.makeFirstNightIdentityGame(board)
  assert.equal(game.identityAssignmentTiming, 'firstNight', '迷糊法官只改变身份确认时机')
  assert.equal(game.seats.every(seat => !seat.roleId && seat.roleName === '待确认身份'), true, '第一夜确认身份的开局不应预先生成号码身份')
  assert.throws(() => engine.settleNight(game), /先完成号码身份确认/, '身份未确认完整时不能结算第一夜')
  let prompt = engine.getIdentityAssignmentPrompt(game)
  assert.deepEqual({ name: prompt.roleName, required: prompt.required }, { name: '狼人', required: 4 }, '首轮应按板子人数登记狼人')
  ;[1, 2, 3, 4].forEach(number => engine.toggleIdentityAssignmentSeat(game, board, number))
  assert.throws(() => engine.toggleIdentityAssignmentSeat(game, board, 5), /只需登记4人/, '不能选取超过板子规定数量的号码')
  engine.completeIdentityAssignment(game, board)
  while (!game.identityAssignment.complete) {
    prompt = engine.getIdentityAssignmentPrompt(game)
    if (prompt) {
      const available = game.seats.filter(seat => !seat.roleId).slice(0, prompt.required)
      available.forEach(seat => engine.toggleIdentityAssignmentSeat(game, board, seat.number))
      engine.completeIdentityAssignment(game, board)
    }
  }
  assert.equal(game.identityAssignment.complete, true, '所有身份确认完成后应解除第一夜行动门槛')
  assert.equal(game.seats.every(seat => Boolean(seat.roleId)), true, '号码身份确认完成后每个号码都必须有身份')
  Object.entries(board.roleCounts).forEach(([roleId, count]) => assert.equal(game.seats.filter(seat => seat.roleId === roleId).length, count, `${roleId}人数应符合板子配置`))
  assert.deepEqual(engine.getNightActionCards(game, board).map(card => card.id), board.nightSequence, '身份确认时机不应改变板子的夜间流程')
  const knownGame = engine.makeGame(board, roles)
  assert.deepEqual(engine.getNightActionCards(knownGame, board).map(card => card.id), board.nightSequence, '提前确认身份也应使用同一份夜间流程')
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setWitchAction(game, 'none')
  engine.settleNight(game)
  assert.equal(game.phase, 'day', '完成同一份第一夜行动后应正常进入白天')
}

{
  const game = fresh()
  game.night.wolfTarget = 5
  game.night.witchAction = 'save'
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, true)
}

{
  const board = getBoard('miracleMerchant12')
  const game = engine.makeGame(board, boardRoles(board.id))
  const merchant = game.seats.find(seat => seat.roleId === 'miracleMerchant')
  engine.setNightActionChoice(game, 'miracleMerchant', 'inspect')
  engine.setNightActionTarget(game, 'miracleMerchant', 1)
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setWitchAction(game, 'none')
  engine.settleNight(game)
  assert.equal(merchant.alive, false, '奇迹商人把技能交易给狼人后应于次日出局')
  assert.equal(merchant.deathCause, '交易失败', '交易失败应使用独立出局原因')
}

{
  const board = getBoard('eternalOrder12')
  const game = engine.makeGame(board, boardRoles(board.id))
  const guard = game.seats.find(seat => seat.roleId === 'guard')
  engine.setNightActionTarget(game, 'timeWolfConsort', 5)
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setNightActionTarget(game, 'guard', 5)
  engine.setWitchAction(game, 'none')
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, false, '蚀时狼妃封锁目标后，守护应反弹而不能保护原目标')
  assert.equal(guard.alive, true, '反弹守护应作用于守卫自己')
  assert.equal(game.special.timeWolfConsort.disabled, true, '成功反弹技能后蚀时狼妃应永久失去技能')
}

{
  const board = getBoard('bloodDemonHunter12')
  const game = engine.makeGame(board, boardRoles(board.id))
  game.seats.filter(seat => roleDefinitions[seat.roleId].camp === 'wolf' && seat.roleId !== 'bloodApostle').forEach(seat => { seat.alive = false })
  const apostle = game.seats.find(seat => seat.roleId === 'bloodApostle')
  engine.applyDayEvent(game, 'exile', apostle.number)
  assert.equal(apostle.alive, true, '最后一狼血夜使徒被放逐后应延迟到下一次天亮出局')
  assert.equal(game.special.bloodApostleDelayed, true)
  engine.nextNight(game)
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setWitchAction(game, 'none')
  engine.setNightActionTarget(game, 'seer', apostle.number)
  engine.setNightActionTarget(game, 'demonHunter', 5)
  engine.settleNight(game)
  assert.equal(apostle.alive, false, '血夜使徒应在下一次天亮时确认出局')
}

{
  const board = getBoard('pureWhiteNight12')
  const game = engine.makeGame(board, boardRoles(board.id))
  game.day = 2
  const wolfWitch = game.seats.find(seat => seat.roleId === 'wolfWitch')
  const pure = game.seats.find(seat => seat.roleId === 'pureWhiteGirl')
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setNightActionTarget(game, 'guard', 5)
  engine.setNightActionTarget(game, 'wolfWitch', pure.number)
  engine.setNightActionTarget(game, 'pureWhiteGirl', wolfWitch.number)
  engine.setWitchAction(game, 'none')
  engine.settleNight(game)
  assert.equal(wolfWitch.alive, false, '第二夜纯白之女验到狼巫应使狼巫出局')
  assert.equal(pure.alive, false, '第二夜狼巫验到纯白之女应使纯白之女出局')
}

{
  const board = getBoard('awakenedWolfKing12')
  const game = engine.makeGame(board, boardRoles(board.id))
  const king = game.seats.find(seat => seat.roleId === 'awakenedWolfKing')
  const wolf = game.seats.find(seat => seat.roleId === 'wolf')
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setNightActionTarget(game, 'awakenedWolfKing', wolf.number)
  engine.setWitchAction(game, 'none')
  engine.settleNight(game)
  assert.equal(king.abilities.clawCharges, 1, '觉醒狼王亲传后应消耗一枚狼王爪')
  assert.equal(wolf.abilities.clawCharges, 1, '被亲传的狼队友应获得一枚狼王爪')
}

{
  const board = getBoard('mirrorMystery12')
  const game = engine.makeGame(board, boardRoles(board.id))
  const hidden = game.seats.find(seat => seat.roleId === 'awakenedHiddenWolf')
  assert.equal(engine.getWolfTeamNumbers(game).includes(hidden.number), false, '觉醒隐狼开局不应出现在共同睁眼的狼队名单中')
  game.seats.filter(seat => seat.roleId === 'wolf').forEach(seat => { seat.alive = false })
  engine.getNightActionCards(game, board)
  assert.deepEqual(engine.getWolfTeamNumbers(game), [hidden.number], '其他狼人出局后觉醒隐狼才接管狼刀')
}

{
  const board = getBoard('fogCrow12')
  const game = engine.makeGame(board, boardRoles(board.id))
  engine.setNightActionTarget(game, 'wolves', 5)
  engine.setNightActionTarget(game, 'dreamer', 6)
  engine.settleNight(game)
  assert.equal(game.seats[4].alive, true, '法老之蛇决定前狼刀目标应暂缓确认出局')
  assert.equal(game.special.alchemistWitch.pendingWolfTarget, 5, '法老之蛇阶段应保留狼刀目标')
  engine.resolveAlchemistSnake(game, false)
  assert.equal(game.seats[4].alive, false, '炼金魔女不使用法老之蛇时应确认狼刀出局')
}

{
  const board = getBoard('eternalOrder12')
  const game = engine.makeGame(board, boardRoles(board.id))
  game.phase = 'day'
  game.sheriffElectionDone = true
  game.dayState = engine.createDayState(game)
  game.dayState.stage = 'orderPrinceDecision'
  game.dayState.pendingExileSeat = 5
  engine.resolveOrderPrince(game, true)
  assert.equal(game.special.orderPrince.used, true, '定序王子发动后应消耗全局唯一次数')
  assert.equal(game.dayState.stage, 'orderPrinceSpeech', '定序王子发动后应先获得额外发言')
  assert.equal(game.seats[4].alive, true, '逆转投票后原放逐目标不应出局')
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
  assert.equal(fox.deathCause, '查验出局', '狼刀与毒药不应覆盖咒狐的查验出局原因')
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
  game.sheriffSeat = 5
  game.sheriffElectionDone = true
  engine.applyDayEvent(game, 'exile', 5)
  assert.deepEqual(game.pendingSheriffTransfer, { seatNumber: 5, cause: '放逐' }, '警长出局后应等待处理警徽')
  assert.equal(game.sheriffSeat, 5, '警徽结算前应保留原警长信息')
  assert.throws(() => engine.resolveSheriffTransfer(game, 6), /先完成全部出局技能/, '出局技能和胜负校验完成前不能处理警徽')
  resolveAllDeathPrompts(game)
  engine.resolveSheriffTransfer(game, 6)
  assert.equal(game.sheriffSeat, 6, '移交警徽后目标玩家应成为新警长')
  assert.equal(game.pendingSheriffTransfer, null, '警徽移交后应清除待处理状态')
  assert.equal(game.logs[0].text.includes('移交给6号'), true, '警徽移交应写入对局记录')
}

{
  const game = fresh()
  game.sheriffSeat = 5
  engine.applyDayEvent(game, 'shot', 5)
  game.seats[11].foolRevealed = true
  resolveAllDeathPrompts(game)
  assert.throws(() => engine.resolveSheriffTransfer(game, 12), /可接警徽/, '翻牌愚者不能接警徽')
  engine.resolveSheriffTransfer(game, null)
  assert.equal(game.sheriffSeat, null, '撕毁警徽后场上应没有警长')
  assert.equal(game.logs[0].text.includes('撕毁警徽'), true, '撕毁警徽应写入对局记录')
}

{
  const game = fresh()
  game.sheriffSeat = 12
  engine.applyDayEvent(game, 'exile', 12)
  assert.equal(game.seats[11].alive, true, '愚者翻牌后仍然存活')
  assert.equal(game.pendingSheriffTransfer.seatNumber, 12, '警长愚者翻牌时也应处理警徽')
  engine.resolveSheriffTransfer(game, 5)
  assert.equal(game.sheriffSeat, 5, '愚者应能将警徽移交给其他存活玩家')
}

{
  const game = fresh()
  game.sheriffSeat = 9
  ;[10, 11, 12].forEach(number => { game.seats[number - 1].alive = false })
  engine.applyDayEvent(game, 'shot', 9)
  assert.equal(game.winner, null, '最后一个神职警长的出局技能尚未询问时不能提前判胜')
  assert.equal(game.pendingSheriffTransfer.seatNumber, 9, '技能结算前可以记录待判定的警徽去向')
  resolveAllDeathPrompts(game)
  assert.equal(game.winner, '狼人阵营', '最后一个神职出局且技能结算完成后应立即判定狼人获胜')
  assert.equal(game.pendingSheriffTransfer, null, '出局已经导致游戏结束时不得再进入警徽传承')
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
