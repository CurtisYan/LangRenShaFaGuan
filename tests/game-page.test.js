const assert = require('assert')
const { getBoard } = require('../data/boards')
const engine = require('../utils/game-engine')

let page
global.Page = config => { page = config }
const navigations = []
global.wx = { showToast() {}, redirectTo() {}, navigateTo({ url }) { navigations.push(url) } }
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
assert.equal(app.globalData.game.dayState.stage, 'sheriffOrder', '自动当选后应直接决定发言顺序')
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
page.completeHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
assert.equal(backTriggerCount, 1, '返回按钮放大完成时应立即执行返回')
page.goBackStep = originalGoBackStep

let withdrawnNumber = null
const originalWithdraw = page.withdrawSheriffCandidate
page.withdrawSheriffCandidate = number => { withdrawnNumber = number }
page.startHold.call(page, { currentTarget: { dataset: { holdKey: 'withdraw-2', number: 2 } } })
assert.equal(page.data.confirmationPulse, 'withdraw-2', '按下退水号码牌后应立即进入放大状态')
page.endHold.call(page, { currentTarget: { dataset: { holdKey: 'withdraw-2', number: 2 } } })
assert.equal(page.data.confirmationPulse, '', '未按满时松手应取消退水并恢复号码牌')
assert.equal(withdrawnNumber, null, '短按退水号码牌不应误触发退水')
page.startHold.call(page, { currentTarget: { dataset: { holdKey: 'withdraw-2', number: 2 } } })
page.completeHold.call(page, { currentTarget: { dataset: { holdKey: 'withdraw-2', number: 2 } } })
assert.equal(withdrawnNumber, 2, '退水按钮放大完成时应立即执行退水')
page.withdrawSheriffCandidate = originalWithdraw

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
page.openBoardDetail.call(page)
assert.equal(navigations[0], '/pages/board-detail/board-detail?boardId=standard12', '顶部板子名应跳转至对应板子说明')

console.log('game-page flow tests passed')
