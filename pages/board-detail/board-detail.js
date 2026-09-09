const { getBoard } = require('../../data/boards')
const { roles } = require('../../data/roles')
const { roleDocuments } = require('../../data/role-documents')
const { boardDocuments } = require('../../data/board-documents')
const { nightActionDefinitions } = require('../../data/night-actions')

const toneFor = role => role.camp === 'wolf' ? 'wolf' : role.camp === 'third' ? 'third' : role.group === '平民' ? 'villager' : 'god'
function parseBoardDocument(document) {
  if (!document) return []
  return document.markdown.split(/^### /m).filter(Boolean).map(part => {
    const lineEnd = part.indexOf('\n')
    return { title: part.slice(0, lineEnd).trim(), paragraphs: part.slice(lineEnd + 1).trim().split(/\n\s*\n/).map(text => text.replace(/\*\*/g, '').trim()).filter(Boolean) }
  }).filter(section => section.title !== '板子配置')
}

Page({
  data: { board: null, roleCards: [], nightSequenceLabels: [], detailSections: [] },
  onLoad(query) {
    const board = getBoard(query.boardId)
    if (!board) return wx.navigateBack()
    const roleCards = Object.keys(board.roleCounts).map(id => ({ id, name: roles[id].name, count: board.roleCounts[id], tone: toneFor(roles[id]), hasDocument: Boolean(roleDocuments[id]) }))
    this.setData({ board, roleCards, nightSequenceLabels: board.nightSequence.map(id => nightActionDefinitions[id] ? nightActionDefinitions[id].name : id), detailSections: parseBoardDocument(boardDocuments[board.id]) })
    wx.setNavigationBarTitle({ title: board.name })
  },
  openRole(event) { wx.navigateTo({ url: `/pages/role-detail/role-detail?roleId=${event.currentTarget.dataset.id}` }) }
})
