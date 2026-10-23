const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { getBoard } = require('../data/boards')
const engine = require('../utils/game-engine')

const gameTemplate = fs.readFileSync(path.join(__dirname, '../pages/game/game.wxml'), 'utf8')
assert.equal(gameTemplate.includes('请{{identityRole.name}}玩家睁眼'), false, '身份确认主持词不应出现生硬的“请某身份玩家睁眼”')
assert.equal(gameTemplate.includes('class="identity-panel"'), false, '不得单独显示一套身份确认页面')
assert.equal(gameTemplate.includes('action.awaitingIdentity'), true, '选身份应嵌入夜间主持行动卡')
assert.equal(gameTemplate.includes('天黑请闭眼。'), true, '身份确认时仍使用完整夜间主持页面')
assert.equal(gameTemplate.includes('catchtap="withdrawSheriffCandidate"'), true, '候选号码右上角的×应直接点击退水')
assert.equal(gameTemplate.includes('data-hold-key="withdraw-'), false, '退水号码不再使用长按操作')

let page
global.Page = config => { page = config }
const navigations = []
const toastMessages = []
global.wx = { showToast({ title }) { toastMessages.push(title) }, redirectTo() {}, navigateTo({ url }) { navigations.push(url) } }
require('../pages/game/game')

page.setData = function setData(update, callback) {
  Object.assign(this.data, update)
  if (callback) callback()
}

const board = getBoard('standard12')
const roles = Object.entries(board.roleCounts).flatMap(([roleId, count]) => Array(count).fill(roleId))
const game = engine.makeGame(board, roles)
game.phase = 'day'
game.dayState = {
  stage: 'sheriffSpeech',
  sheriffCandidates: [1, 2],
  sheriffInitialCandidates: [1, 2],
  sheriffWithdrawn: [],
  sheriffVotes: {},
  exileMode: 'individual',
  exileVotes: {},
  simpleVoteCounts: {},
  sheriffPk: true
}

const app = {
  globalData: { game },
  saveGame(nextGame) { this.globalData.game = nextGame }
}
global.getApp = () => app

page.refresh.call(page)
page.withdrawSheriffCandidate.call(page, { currentTarget: { dataset: { number: 1 } } })
assert.equal(app.globalData.game.sheriffSeat, 2, 'PK 退水后仅剩一人应自动当选警长')
assert.equal(app.globalData.game.dayState.stage, 'announceNight', '自动当选后应先公布死讯')
assert.equal(app.globalData.game.stepHistory.length, 1, '退水前应保留可回退检查点')

page.goBackStep.call(page)
assert.equal(app.globalData.game.sheriffSeat, null, '返回上一步应撤销自动当选')
assert.deepEqual(app.globalData.game.dayState.sheriffCandidates, [1, 2], '返回上一步应恢复 PK 候选人')
assert.equal(app.globalData.game.stepHistory.length, 0, '已返回的检查点应从历史移除')

const groupedVotes = page.groupVoteRecords.call(page, [1, 2, 3, 4], { 1: 12, 2: 12, 3: 12 }, 2)
assert.deepEqual(groupedVotes, [
  { target: '12号', voters: '1号 ⬡2号 3号' },
  { target: '弃票', voters: '4号' }
], '投票记录应按投向归组，并保留警长票标记')

// 所有警长板子均先公布死讯，完成技能及遗言后再决定发言顺序。
for (const sheriffBoard of require('../data/boards').boards.filter(item => item.dayRules.sheriff)) {
  const seatRoles = Object.entries(sheriffBoard.roleCounts).flatMap(([id, count]) => Array(count).fill(id))
  const firstDay = engine.makeGame(sheriffBoard, seatRoles)
  const victim = firstDay.seats.find(seat => seat.roleId === 'villager')
  engine.setNightActionTarget(firstDay, 'wolves', victim.number)
  if (sheriffBoard.roleCounts.lonelyGirl) engine.setLonelyGirlTarget(firstDay, firstDay.seats.find(seat => seat.roleId === 'wolf').number)
  engine.settleNight(firstDay)
  firstDay.dayState = engine.createDayState(firstDay)
  app.globalData.game = firstDay
  page.refresh()
  const elected = firstDay.seats.find(seat => seat.roleId === 'wolf')
  page.electSheriff(firstDay, elected.number, '测试当选')
  if (firstDay.dayState.stage === 'alchemistSnake') page.resolveAlchemistSnake({ currentTarget: { dataset: { use: 'no' } } })
  assert.equal(firstDay.dayState.stage, 'announceNight', `${sheriffBoard.name}当选后先报死讯`)
  page.announceNightDeaths()
  assert.equal(firstDay.dayState.stage, 'deathSkills', `${sheriffBoard.name}先询问出局技能`)
  while (firstDay.pendingDeathSkills.length) page.declineDeathSkill()
  assert.equal(firstDay.dayState.stage, 'lastWords', `${sheriffBoard.name}首夜出局玩家应有遗言`)
  while (firstDay.pendingLastWords.length) page.nextLastWord()
  assert.equal(firstDay.dayState.stage, 'sheriffOrder', `${sheriffBoard.name}遗言后才决定顺序`)
  page.setSpeakingOrder({ currentTarget: { dataset: { direction: 'clockwise' } } })
  assert.equal(firstDay.dayState.stage, 'discussion', `${sheriffBoard.name}决定顺序后直接发言，不重复报死讯`)
}
app.globalData.game = game
page.refresh()

for (const tearBadge of [false, true]) {
  const chainGame = engine.makeGame(board, roles)
  engine.setNightActionTarget(chainGame, 'wolves', 11)
  engine.settleNight(chainGame)
  chainGame.dayState = engine.createDayState(chainGame)
  app.globalData.game = chainGame
  page.refresh()
  page.electSheriff(chainGame, 1, '测试技能连锁')
  page.announceNightDeaths()
  page.setData({ selectedSkillTargetIndex: page.data.aliveSeats.findIndex(seat => seat.number === 1) })
  page.confirmDeathSkillTarget()
  assert.equal(chainGame.seats[0].alive, false, '首夜猎人开枪可带走刚当选的警长')
  assert.equal(page.data.pendingSheriffTransfer, null, '连锁出局技能未结算前不能传警徽')
  while (chainGame.pendingDeathSkills.length) page.declineDeathSkill()
  assert.equal(page.data.pendingSheriffTransfer.number, 1, '技能连锁完成后先处理警徽')
  if (tearBadge) page.tearSheriffBadge()
  else {
    page.setData({ selectedSheriffTransferIndex: page.data.sheriffTransferTargets.findIndex(seat => seat.number === 9) })
    page.transferSheriffBadge()
  }
  assert.equal(chainGame.dayState.stage, 'lastWords', '警徽结算后继续遗言')
  while (chainGame.pendingLastWords.length) page.nextLastWord()
  assert.equal(chainGame.dayState.stage, tearBadge ? 'discussion' : 'sheriffOrder', '遗言后由新警长决定顺序；撕毁警徽则按无警长流程')
  assert.equal(chainGame.sheriffSeat, tearBadge ? null : 9)
}
const peacefulDay = engine.makeGame(board, roles)
peacefulDay.phase = 'day'
peacefulDay.dayState = engine.createDayState(peacefulDay)
app.globalData.game = peacefulDay
page.refresh()
page.electSheriff(peacefulDay, 9, '平安夜')
assert.equal(peacefulDay.dayState.stage, 'announceNight')
page.announceNightDeaths()
assert.equal(peacefulDay.dayState.stage, 'sheriffOrder', '平安夜报完信息即可决定顺序')
app.globalData.game = game
page.refresh()

app.globalData.game.dayState = {
  stage: 'sheriffVote', sheriffCandidates: [1, 2], sheriffInitialCandidates: [1, 2], sheriffWithdrawn: [], sheriffVotes: { 3: 1 },
  exileMode: 'individual', exileVotes: {}, simpleVoteCounts: {}, sheriffPk: false
}
page.refresh.call(page)
const recordedSheriffVoterIndex = page.data.dayVoters.findIndex(seat => seat.number === 3)
assert.equal(page.data.dayVoters[recordedSheriffVoterIndex].voted, true, '已经完成警长投票的玩家应标记为已投')
page.selectDayVoter.call(page, { currentTarget: { dataset: { index: recordedSheriffVoterIndex } } })
assert.equal(page.data.selectedVoterIndices.length, 0, '已经完成警长投票的玩家不能再次选中')
assert.equal(toastMessages.pop(), '3号已经投过票', '重复选择已投玩家时应明确提示')
page.setData({ selectedVoterIndices: [recordedSheriffVoterIndex], selectedVoteTargetIndex: 1 })
page.recordVote.call(page)
assert.equal(app.globalData.game.dayState.sheriffVotes[3], 1, '再次记录不能覆盖玩家原有的警长投向')
assert.equal(toastMessages.pop(), '所选玩家中有人已经投过票', '记录层也应拦截重复警长投票')

app.globalData.game.dayState = {
  stage: 'exileVote', exileMode: 'individual', exilePk: true, exileTieCandidates: [1, 2], exileVotes: {},
  sheriffCandidates: [], sheriffInitialCandidates: [], sheriffWithdrawn: [], sheriffVotes: {}, simpleVoteCounts: {}
}
const pkView = page.makeDayView.call(page, app.globalData.game, board, app.globalData.game.seats.filter(seat => seat.alive))
assert.equal(pkView.dayVoters.some(seat => seat.number === 1 || seat.number === 2), false, '放逐PK对象不能参与本轮投票')

page.refresh.call(page)
page.selectDayVoter.call(page, { currentTarget: { dataset: { index: 0 } } })
page.selectDayVoter.call(page, { currentTarget: { dataset: { index: 1 } } })
assert.equal(page.data.selectedVoterIndices.length, 2, '逐票记录应允许同时选择多名投票玩家')
page.recordVote.call(page)
assert.equal(Object.keys(app.globalData.game.dayState.exileVotes).length, 2, '逐票记录应一次写入多名投票玩家')

page._holdKey = 'back'
let backTriggerCount = 0
const originalGoBackStep = page.goBackStep
page.goBackStep = () => { backTriggerCount += 1 }
page.data.canGoBack = true
page.startHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
page.endHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
assert.equal(toastMessages.pop(), '请长按返回上一步', '短按返回按钮应提示需要长按')
page.startHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
page.completeHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
assert.equal(backTriggerCount, 1, '返回按钮放大完成时应立即执行返回')
assert.equal(toastMessages.length, 0, '长按返回成功时不应显示长按提示')
page.goBackStep = originalGoBackStep

const individualExileGame = engine.makeGame(board, roles)
individualExileGame.phase = 'day'
individualExileGame.sheriffElectionDone = true
individualExileGame.dayState = engine.createDayState(individualExileGame)
individualExileGame.dayState.stage = 'exileVote'
individualExileGame.dayState.exileVotes = { 1: 5 }
app.globalData.game = individualExileGame
page.refresh.call(page)
page.resolveExileVote.call(page)
assert.equal(Object.keys(app.globalData.game.dayState.exileVotes).length, 12, '结束逐票放逐时应为所有可投票玩家补齐票据')
assert.equal(app.globalData.game.dayState.exileVotes[2], null, '没有记录投向的玩家应自动记为弃票')
assert.equal(app.globalData.game.voteHistory[0].votes[12], null, '投票历史应保存自动补齐的弃票')

const allAbstainGame = engine.makeGame(board, roles)
allAbstainGame.phase = 'day'
allAbstainGame.sheriffElectionDone = true
allAbstainGame.dayState = engine.createDayState(allAbstainGame)
allAbstainGame.dayState.stage = 'exileVote'
app.globalData.game = allAbstainGame
page.refresh.call(page)
page.resolveExileVote.call(page)
assert.equal(app.globalData.game.dayState.stage, 'exileDone', '全员未投时应按全员弃票结算为无人出局')
assert.equal(Object.values(app.globalData.game.dayState.exileVotes).every(target => target === null), true, '全员未投时每名玩家都应留下弃票记录')

const firstNightIdentityGame = engine.makeFirstNightIdentityGame(board)
app.globalData.game = firstNightIdentityGame
page.refresh.call(page)
assert.equal(page.data.identityAssignmentPending, true, '第一夜行动前应先显示号码身份确认')
assert.equal(page.data.identityRole.name, '狼人', '身份确认卡片应显示当前需要确认的身份')
assert.equal(page.data.nightActionCards[0].awaitingIdentity, true, '身份选择应在当前夜间行动卡内显示')
assert.equal(page.data.nightActionCards[0].hostLine, '狼人请睁眼。', '号码选择与行动共用角色主持词')
assert.equal(page.data.nightFlowProgressText, '第 1 / 3 项', '选择身份期间应显示当前夜间环节进度')
page.data.identitySeatCards.filter(seat => !seat.assigned).slice(0, page.data.identityRole.required).forEach(seat => page.toggleIdentitySeat.call(page, { currentTarget: { dataset: { number: seat.number } } }))
page.confirmIdentityRole.call(page)
assert.equal(page.data.identityAssignmentPending, false, '确认狼人号码后不应继续登记下一身份')
assert.equal(page.data.nightActionCards.length, 1, '迷糊法官每次只应显示当前夜间行动')
assert.equal(page.data.nightActionCards[0].id, 'wolves', '确认狼人号码后应立即进行狼人行动')
assert.equal(page.data.nightActionCards[0].hostLine, '狼人请睁眼。', '确认身份后主持词保持一致，在原行动卡继续操作')
page.selectNightActionTarget.call(page, { currentTarget: { dataset: { actionId: 'wolves' } }, detail: { value: 4 } })
page.completeGuidedNightAction.call(page)
assert.equal(page.data.identityAssignmentPending, true, '狼人行动完成后才应确认下一张身份牌')
assert.equal(page.data.identityRole.name, '女巫', '狼人行动后应按板子顺序确认女巫')

let remainingSteps = 30
while (!engine.guidedFirstNightReadyToSettle(app.globalData.game, board) && remainingSteps > 0) {
  remainingSteps -= 1
  if (!page.data.identityAssignmentPending) {
    page.completeGuidedNightAction.call(page)
    continue
  }
  const available = page.data.identitySeatCards.filter(seat => !seat.assigned).slice(0, page.data.identityRole.required)
  available.forEach(seat => page.toggleIdentitySeat.call(page, { currentTarget: { dataset: { number: seat.number } } }))
  assert.equal(page.data.identityCanConfirm, true, '选满当前身份人数后应允许确认')
  page.confirmIdentityRole.call(page)
}
assert.ok(remainingSteps > 0, '迷糊法官第一夜页面流程不应卡住')
assert.equal(app.globalData.game.identityAssignment.complete, true, '逐项行动结束前应确认完全部身份')
assert.equal(app.globalData.game.night.wolfTarget, 5, '狼人身份确认后紧接的行动应记录刀口')
assert.equal(page.data.nightActionCards.length, 0, '逐项完成后不应重新显示整张夜间行动表')
assert.equal(page.data.guidedNightActionPending, false, '逐项完成后应允许直接结算第一夜')
assert.equal(page.data.wolfMembers, '1号、2号、3号、4号', '确认完成后应读取狼人号码')

const mirrorBoard = getBoard('mirrorMystery12')
app.globalData.game = engine.makeFirstNightIdentityGame(mirrorBoard)
page.refresh()
assert.equal(page.data.nightActionCards[0].hostLine, '魔镜少女请保持闭眼，举手示意。')
assert.equal(page.data.nightActionCards[0].awaitingIdentity, true)
page.toggleIdentitySeat({ currentTarget: { dataset: { number: 5 } } })
page.confirmIdentityRole()
assert.equal(page.data.identityRole.name, '守卫', '闭眼示意确认号码后直接进入守卫，不重复出现示意行动页')
assert.equal(app.globalData.game.identityAssignment.actionIndex, 1)
assert.equal(page.data.nightActionCards[0].hostLine, '守卫请睁眼。')
page.goBackStep()
assert.equal(page.data.identityRole.name, '魔镜少女', '返回上一步可撤销示意登记及推进')
assert.equal(app.globalData.game.seats[4].roleId, '')

const nightGame = engine.makeGame(board, roles)
app.globalData.game = nightGame
page.refresh.call(page)
assert.equal(page.data.canGoBack, false, '第一夜刚开局且没有回退记录时不应显示返回按钮')
page.updateNightTarget.call(page, { currentTarget: { dataset: { field: 'wolfTarget' } }, detail: { value: 0 } })
assert.equal(app.globalData.game.stepHistory.length, 1, '记录夜间行动前应建立回退点')
assert.equal(page.data.canGoBack, true, '记录夜间行动后，黑夜返回按钮应可用')
const nightTarget = app.globalData.game.night.wolfTarget
assert.equal(Boolean(nightTarget), true, '夜间行动应已记录目标')
page.finishNight.call(page)
assert.equal(app.globalData.game.phase, 'day', '夜间结算后应进入白天')
page.goBackStep.call(page)
assert.equal(app.globalData.game.phase, 'night', '从白天返回后应恢复黑夜页面')
assert.equal(page.data.canGoBack, true, '返回黑夜后仍应保留更早的夜间回退点')
assert.equal(app.globalData.game.night.wolfTarget, nightTarget, '从白天返回黑夜时应恢复已记录的夜间目标')
page.goBackStep.call(page)
assert.equal(app.globalData.game.night.wolfTarget, null, '黑夜返回应恢复记录目标前的状态')
assert.equal(page.data.canGoBack, false, '恢复第一夜初始状态后应再次隐藏返回按钮')

const exileFlowGame = engine.makeGame(board, roles)
exileFlowGame.phase = 'day'
exileFlowGame.sheriffElectionDone = true
exileFlowGame.dayState = engine.createDayState(exileFlowGame)
exileFlowGame.dayState.stage = 'exileVote'
exileFlowGame.dayState.exileMode = 'simple'
app.globalData.game = exileFlowGame
page.refresh.call(page)
page.setData({ selectedVoteTargetIndex: 1, simpleVoteCount: '3' })
page.recordSimpleVote.call(page)
assert.equal(app.globalData.game.dayState.simpleVoteCounts[2], 3, '简易计票应保存2号获得的票数')
assert.deepEqual(page.data.voteTally, [{ number: '2', value: 3 }], '简易计票记录后应立即在当前统计中显示')
app.globalData.game.dayState.simpleVoteCounts = { 5: 4 }
page.refresh.call(page)
page.resolveExileVote.call(page)
assert.equal(app.globalData.game.dayState.stage, 'deathSkills', '白天放逐后应先进入统一的出局技能询问')
assert.equal(page.data.pendingSkill.number, 5, '被放逐玩家即使无法发动技能也必须完成询问')
page.declineDeathSkill.call(page)
assert.equal(page.data.pendingLastWord.number, 5, '胜负未定时，出局技能结算后应继续被放逐玩家的遗言')
page.nextLastWord.call(page)
assert.equal(app.globalData.game.dayState.stage, 'exileDone', '放逐遗言结束后应回到放逐结算阶段')

const sheriffTransferGame = engine.makeGame(board, roles)
sheriffTransferGame.phase = 'day'
sheriffTransferGame.sheriffSeat = 5
sheriffTransferGame.sheriffElectionDone = true
sheriffTransferGame.dayState = engine.createDayState(sheriffTransferGame)
sheriffTransferGame.dayState.stage = 'deathSkills'
engine.applyDayEvent(sheriffTransferGame, 'shot', 5)
app.globalData.game = sheriffTransferGame
page.refresh.call(page)
assert.equal(page.data.pendingSheriffTransfer, null, '警长出局后应先完成出局技能询问')
assert.equal(page.data.pendingSkill.number, 5, '警徽传承前应显示该玩家的出局技能询问')
page.declineDeathSkill.call(page)
assert.equal(page.data.pendingSheriffTransfer.number, 5, '技能结算且胜负未定时才应显示警徽结算')
assert.equal(page.data.sheriffTransferTargets.some(seat => seat.number === 5), false, '原警长不能成为警徽移交目标')
const transferTarget = page.data.sheriffTransferTargets[0]
page.transferSheriffBadge.call(page)
assert.equal(app.globalData.game.sheriffSeat, transferTarget.number, '确认移交后页面应保存新警长')
assert.equal(app.globalData.game.pendingSheriffTransfer, null, '完成移交后页面应结束警徽结算')
page.openBoardDetail.call(page)
assert.equal(navigations[0], '/pages/board-detail/board-detail?boardId=standard12', '顶部板子名应跳转至对应板子说明')

console.log('game-page flow tests passed')

const { buildCustomBoard } = require('../data/custom-board')
const customCounts = { wolf: 2, villager: 8, seer: 1, witch: 1 }
global.wx.showActionSheet = ({ success }) => success({ tapIndex: 0 })
for (const exposure of ['single', 'double']) {
  const customBoard = buildCustomBoard(customCounts, { sheriff: true, exposure })
  const customGame = engine.makeGame(customBoard, Object.entries(customCounts).flatMap(([id, count]) => Array(count).fill(id)))
  customGame.phase = 'day'
  customGame.dayState = engine.createDayState(customGame)
  customGame.dayState.stage = 'sheriffSpeech'
  customGame.dayState.sheriffCandidates = [1, 3]
  app.globalData.game = customGame
  page.refresh()
  page.triggerSelfExpose()
  assert.equal(customGame.sheriffElectionDone, exposure === 'single')
  assert.equal(customGame.sheriffElectionInterrupted, exposure === 'double')
  assert.equal(customGame.dayState.endAfterDeathSkills, true)
  assert.equal(customGame.dayState.stage, 'announceNight')
}
const manualBoard = buildCustomBoard(customCounts, { winMode: 'manual' })
const manualGame = engine.makeGame(manualBoard, Object.entries(customCounts).flatMap(([id, count]) => Array(count).fill(id)))
app.globalData.game = manualGame
page.refresh()
global.wx.showModal = ({ success }) => success({ confirm: false })
page.recordManualWinner()
assert.equal(manualGame.status, 'playing', '取消人工裁决应继续对局')
global.wx.showModal = ({ success }) => success({ confirm: true })
page.recordManualWinner()
assert.equal(manualGame.status, 'ended')
assert.equal(manualGame.winner, '好人阵营')
assert.equal(manualGame.logs.some(log => log.text.includes('场上裁决')), true)
