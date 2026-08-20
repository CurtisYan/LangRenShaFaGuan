const assert = require('assert')
const { getBoard } = require('../data/boards')
const engine = require('../utils/game-engine')

let page
global.Page = config => { page = config }
global.wx = { showToast() {}, redirectTo() {} }
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

console.log('game-page flow tests passed')
