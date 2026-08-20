const { getBoard } = require('../../data/boards')
const { roles } = require('../../data/roles')
const { roleDocuments } = require('../../data/role-documents')
const { boardDocuments } = require('../../data/board-documents')

const actionNames = { wolves: '狼人行动', guard: '守卫行动', seer: '预言家查验', witch: '女巫行动', magician: '魔术师行动', gargoyle: '石像鬼查验', gravedigger: '守墓人查验', demonHunter: '猎魔人狩猎', crow: '乌鸦诅咒', nightmare: '噩梦之影恐惧', dreamer: '摄梦人行动' }
const toneFor = role => role.camp === 'wolf' ? 'wolf' : role.camp === 'third' ? 'third' : role.group === '平民' ? 'villager' : 'god'
function parseBoardDocument(document) {
  if (!document) return []
  return document.markdown.split(/^### /m).filter(Boolean).map(part => {
    const lineEnd = part.indexOf('\n')
    return { title: part.slice(0, lineEnd).trim(), paragraphs: part.slice(lineEnd + 1).trim().split(/\n\s*\n/).map(text => text.replace(/\*\*/g, '').trim()).filter(Boolean) }
  }).filter(section => section.title !== '板子配置')
}

Page({
  data: { board: null, roleCards: [], nightActions: [], detailSections: [] },
  onLoad(query) {
    const board = getBoard(query.boardId)
    if (!board) return wx.navigateBack()
    const roleCards = Object.keys(board.roleCounts).map(id => ({ id, name: roles[id].name, count: board.roleCounts[id], tone: toneFor(roles[id]), hasDocument: Boolean(roleDocuments[id]) }))
    this.setData({ board, roleCards, nightActions: board.nightActions.map(id => actionNames[id] || id), detailSections: parseBoardDocument(boardDocuments[board.id]) })
    wx.setNavigationBarTitle({ title: board.name })
  },
  openRole(event) { wx.navigateTo({ url: `/pages/role-detail/role-detail?roleId=${event.currentTarget.dataset.id}` }) }
})
