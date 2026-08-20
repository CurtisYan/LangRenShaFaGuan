App({
  globalData: {
    game: null
  },

  onLaunch() {
    this.globalData.game = wx.getStorageSync('currentGame') || null
  },

  saveGame(game) {
    this.globalData.game = game
    wx.setStorageSync('currentGame', game)
  },

  clearGame() {
    this.globalData.game = null
    wx.removeStorageSync('currentGame')
  }
})
