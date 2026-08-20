const { boards } = require('../../data/boards')
const { roleDocuments } = require('../../data/role-documents')

Page({
  data: {
    boardCount: boards.length,
    roleCount: Object.keys(roleDocuments).length
  },

  openBoardCatalog() { wx.navigateTo({ url: '/pages/board-list/board-list' }) },
  openRoleCatalog() { wx.navigateTo({ url: '/pages/role-list/role-list' }) }
})
