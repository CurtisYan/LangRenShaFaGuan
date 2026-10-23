const { boards: presetBoards } = require('../../data/boards')
const boards = [{ id: 'custom', name: '自定义板子', summary: '自由选角色 · 房间规则设置', isCustom: true }, ...presetBoards.slice().sort((left, right) => left.playerCount - right.playerCount)]
const CUSTOM_PIN_MIGRATION_KEY = 'customBoardPinMigrationV1'
const PINNED_BOARDS_KEY = 'pinnedBoardIds'
const normalizePins = value => Array.isArray(value) ? [...new Set(value)].filter(id => boards.some(board => board.id === id)).slice(0, 5) : []
const sortedBoards = ids => ids.map(id => ({ ...boards.find(board => board.id === id), pinned: true })).concat(boards.filter(board => !ids.includes(board.id)))
const pinChoicesFor = ids => boards.map(board => ({ ...board, pinned: ids.includes(board.id), pinOrder: ids.indexOf(board.id) + 1 }))

Page({
  data: { boards, currentGame: null, pinnedBoardIds: [], pinManagerOpen: false, pinManagerClosing: false, pinDraftIds: [], pinChoices: [] },

  onShow() {
    let pinnedBoardIds = []
    try { pinnedBoardIds = normalizePins(wx.getStorageSync(PINNED_BOARDS_KEY)) } catch (error) { /* 无缓存时使用默认顺序。 */ }
    try {
      if (!wx.getStorageSync(CUSTOM_PIN_MIGRATION_KEY)) {
        pinnedBoardIds = ['custom', ...pinnedBoardIds.filter(id => id !== 'custom')].slice(0, 5)
        wx.setStorageSync(PINNED_BOARDS_KEY, pinnedBoardIds)
        wx.setStorageSync(CUSTOM_PIN_MIGRATION_KEY, true)
      }
    } catch (error) { /* 缓存写入失败时仍显示本次迁移结果，下次重试。 */ }
    this.setData({ currentGame: getApp().globalData.game, pinnedBoardIds, boards: sortedBoards(pinnedBoardIds), pinManagerOpen: false, pinManagerClosing: false })
  },

  openPinManager() {
    const pinDraftIds = this.data.pinnedBoardIds.slice()
    this.setData({ pinManagerOpen: true, pinManagerClosing: false, pinDraftIds, pinChoices: pinChoicesFor(pinDraftIds) })
  },
  closePinManager() {
    if (!this.data.pinManagerOpen || this.data.pinManagerClosing) return
    this.setData({ pinManagerClosing: true })
  },
  onPinSheetAnimationEnd() {
    if (!this.data.pinManagerClosing) return
    this.setData({ pinManagerOpen: false, pinManagerClosing: false, pinDraftIds: [], pinChoices: [] })
  },
  stopTap() {},
  togglePinnedBoard(event) {
    if (this.data.pinManagerClosing) return
    const id = event.currentTarget.dataset.id
    if (!boards.some(board => board.id === id)) return
    const pinDraftIds = this.data.pinDraftIds.slice()
    const index = pinDraftIds.indexOf(id)
    if (index >= 0) pinDraftIds.splice(index, 1)
    else {
      if (pinDraftIds.length >= 5) return wx.showToast({ title: '最多置顶5个板子', icon: 'none' })
      pinDraftIds.push(id)
    }
    this.setData({ pinDraftIds, pinChoices: pinChoicesFor(pinDraftIds) })
  },
  savePinnedBoards() {
    if (this.data.pinManagerClosing) return
    const pinnedBoardIds = normalizePins(this.data.pinDraftIds)
    try { wx.setStorageSync(PINNED_BOARDS_KEY, pinnedBoardIds) } catch (error) {
      return wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
    this.setData({ pinnedBoardIds, boards: sortedBoards(pinnedBoardIds) })
    this.closePinManager()
  },

  chooseBoard(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: id === 'custom' ? '/pages/custom-board/custom-board' : `/pages/setup/setup?boardId=${id}` })
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
