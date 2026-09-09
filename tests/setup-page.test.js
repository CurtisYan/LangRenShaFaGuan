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
page.startBlindGame.call(page)

assert.equal(app.globalData.game.dealMode, 'blind', '线下发牌卡片应创建盲发对局')
assert.equal(app.globalData.game.phase, 'night', '线下发牌应直接进入第一夜')
assert.equal(app.globalData.game.identityRegistration.complete, false, '第一夜应先处于身份登记状态')
assert.equal(app.globalData.game.seats.every(seat => !seat.roleId), true, '点击盲发入口不应使用当前身份配置草稿')
assert.equal(redirects[0], '/pages/game/game', '线下发牌入口应直接打开主持对局页')

console.log('setup page tests passed')
