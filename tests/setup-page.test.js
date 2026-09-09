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

console.log('setup page tests passed')
