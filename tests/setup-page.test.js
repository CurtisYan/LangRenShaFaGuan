const assert = require('assert')

let page
global.Page = config => { page = config }
const redirects = []
const storage = {}
global.wx = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  redirectTo({ url }) { redirects.push(url) },
  showToast() {},
  showModal() {}
}

const app = {
  globalData: { game: null },
  saveGame(game) { this.globalData.game = game }
}
global.getApp = () => app

require('../pages/setup/setup')

page.setData = function setData(update, callback) {
  Object.assign(this.data, update)
  if (callback) callback()
}

page.onLoad.call(page, { boardId: 'standard12' })
page.startFirstNightIdentityGame.call(page)

assert.equal(app.globalData.game.identityAssignmentTiming, 'firstNight', '迷糊法官入口只应改变身份确认时机')
assert.equal(app.globalData.game.phase, 'night', '迷糊法官入口应进入同一个第一夜流程')
assert.equal(app.globalData.game.identityAssignment.complete, false, '第一夜行动前应先确认号码身份')
assert.equal(app.globalData.game.seats.every(seat => !seat.roleId), true, '点击盲发入口不应使用当前身份配置草稿')
assert.equal(redirects[0], '/pages/game/game', '线下发牌入口应直接打开主持对局页')

page.onLoad.call(page, { boardId: 'hidden9' })
assert.equal(page.data.board.playerCount, 9, '9人暗牌场配置页应生成9个座位')
assert.equal(page.data.seats.length, 9, '9人暗牌场不应沿用12人座位数量')
page.startFirstNightIdentityGame.call(page)
assert.equal(app.globalData.game.seats.length, 9, '9人暗牌场迷糊法官模式应以9个座位开局')

console.log('setup page tests passed')

const { buildCustomBoard } = require('../data/custom-board')
storage.customBoardConfig = buildCustomBoard({ wolf: 1, villager: 1, seer: 1 })
page.onLoad({ boardId: 'custom' })
assert.equal(page.data.seats.length, 3)
page.assignRole(1, 'wolf')
page.assignRole(2, 'villager')
page.assignRole(3, 'seer')
page.startGame()
assert.equal(app.globalData.game.boardConfig.winMode, 'edge')
assert.equal(app.globalData.game.sheriffElectionDone, true)
page.onLoad({ boardId: 'custom' })
assert.equal(page.data.assignedCount, 3, '同配置恢复配号草稿')
storage.customBoardConfig = buildCustomBoard({ wolf: 1, villager: 1, witch: 1 })
page.onLoad({ boardId: 'custom' })
assert.equal(page.data.assignedCount, 0, '同人数但更换角色时不能误用旧配号')
page.startFirstNightIdentityGame()
assert.equal(app.globalData.game.boardConfig.roleCounts.witch, 1)
assert.equal(app.globalData.game.identityAssignment.complete, false)
