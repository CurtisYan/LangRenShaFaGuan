const { roles } = require('../../data/roles')
const { roleDocuments } = require('../../data/role-documents')

const fallbackRoles = {
  wolf: { name: '狼人', camp: '狼人', sections: [{ title: '资料说明', paragraphs: ['《角色描述与QA》未单列普通狼人专章。普通狼人的夜间行动、自曝与胜负条件，请以所选板子的规则详情为准。'] }] },
  wolfKing: { name: '狼王', camp: '狼人', sections: [{ title: '资料说明', paragraphs: ['《角色描述与QA》未单列狼王专章。狼王的出局技能、爪击条件与遗言处理，请以所选板子的规则详情为准。'] }] }
}

function parseRoleDocument(document) {
  const sections = []
  document.markdown.split(/^### /m).filter(Boolean).forEach(part => {
    const lineEnd = part.indexOf('\n')
    const title = part.slice(0, lineEnd).trim()
    const content = part.slice(lineEnd + 1).trim()
    if (title === 'Q&A') {
      const qas = []
      const matcher = /\*\*问：(.+?)\*\*\s*\n+答：([\s\S]*?)(?=\n\s*\n\*\*问：|$)/g
      let match
      while ((match = matcher.exec(content))) qas.push({ question: match[1], answer: match[2].trim() })
      sections.push({ title, isQa: true, qas })
      return
    }
    sections.push({ title, paragraphs: content.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean) })
  })
  return sections
}

Page({
  data: { role: null, sections: [], sourceNote: '' },
  onLoad(query) {
    const document = roleDocuments[query.roleId]
    const role = roles[query.roleId] || fallbackRoles[query.roleId] || { name: '孤独少女', camp: '神职' }
    const sections = document ? parseRoleDocument(document) : (fallbackRoles[query.roleId] || { sections: [{ title: '资料说明', paragraphs: ['当前资料库尚未收录该身份的独立角色专章。'] }] }).sections
    this.setData({ role: { id: query.roleId, name: document ? document.title : role.name, camp: role.group || role.camp }, sections, sourceNote: document ? '以下内容完整整理自《角色描述与QA》。' : '以下内容请结合对应板子规则使用。' })
    wx.setNavigationBarTitle({ title: document ? document.title : role.name })
  }
})
