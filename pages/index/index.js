const { boards } = require('../../data/boards')

Page({
  data: { boards, currentGame: null },

  onShow() {
    this.setData({ currentGame: getApp().globalData.game })
  },

  chooseBoard(event) {
    wx.navigateTo({ url: `/pages/setup/setup?boardId=${event.currentTarget.dataset.id}` })
  },

  continueGame() {
    wx.navigateTo({ url: '/pages/game/game' })
  },

  openRules() {
    wx.navigateTo({ url: '/pages/rules/rules' })
  },

  resetGame() {
    wx.showModal({
      title: '结束当前对局？',
      content: '本局记录将被清除。',
      success: result => {
        if (result.confirm) {
          getApp().clearGame()
          this.setData({ currentGame: null })
        }
      }
    })
  }
})
