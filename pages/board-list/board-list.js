const { boards } = require('../../data/boards')

Page({
  data: { boards: boards.map(board => ({ ...board, roleKinds: Object.keys(board.roleCounts).length })) },
  openBoard(event) { wx.navigateTo({ url: `/pages/board-detail/board-detail?boardId=${event.currentTarget.dataset.id}` }) }
})
