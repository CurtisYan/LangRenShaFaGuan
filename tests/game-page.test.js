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
page._holdReady = false
page.completeHold.call(page, { currentTarget: { dataset: { holdKey: 'back' } } })
assert.equal(page._holdReady, true, '扩散动画完成后才应允许触发长按操作')
page.openBoardDetail.call(page)
assert.equal(navigations[0], '/pages/board-detail/board-detail?boardId=standard12', '顶部板子名应跳转至对应板子说明')

console.log('game-page flow tests passed')
