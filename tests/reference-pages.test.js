const assert = require('assert')
const { boards } = require('../data/boards')
const { roleDocuments } = require('../data/role-documents')
const { boardDocuments } = require('../data/board-documents')
const { roles } = require('../data/roles')
const { nightActionDefinitions } = require('../data/night-actions')

assert.equal(Object.keys(roleDocuments).length, 33, '角色资料应完整收录文档中的 33 个专章')
assert.equal(Object.keys(boardDocuments).length, 23, '板子资料应完整收录文档中的 22 个预设板子和自定义板子')
assert.equal(boards.length, 22, '所有已收录板子均应可开局')
assert.deepEqual(boards.map(board => board.id).sort(), Object.keys(boardDocuments).filter(id => id !== 'custom').sort(), '可开局板子与资料库板子必须一一对应')
boards.forEach(board => {
  assert.equal(Object.entries(board.roleCounts).reduce((sum, [, count]) => sum + count, 0), board.playerCount, `${board.name}身份数量应等于玩家人数`)
  Object.keys(board.roleCounts).forEach(roleId => assert.ok(roles[roleId], `${board.name}引用的${roleId}必须存在于角色库`))
  board.nightSequence.forEach(actionId => assert.ok(nightActionDefinitions[actionId], `${board.name}夜间行动${actionId}必须有统一定义`))
})
Object.keys(roles).filter(roleId => roleId !== 'wolfKing').forEach(roleId => assert.ok(roleDocuments[roleId], `${roleId}应有角色资料`))
assert.equal(roleDocuments.cursedFox.markdown.includes('### Q&A'), true, '咒狐 Q&A 不应遗漏')
assert.equal(roleDocuments.wolf.markdown.includes('### Q&A'), true, '狼人角色说明与 Q&A 不应遗漏')
assert.equal(boardDocuments.standard12.markdown.includes('出局技能连锁'), true, '标准场完整板子规则不应遗漏')
assert.equal(boardDocuments.hidden9.markdown.includes('女巫仅首夜可以自救'), true, '9 人暗牌场应收录首夜自救规则')
assert.equal(boardDocuments.wolfBeautyKnight10.markdown.includes('狼美人因骑士决斗出局'), true, '10人狼美人骑士应收录骑士决斗限制')
assert.equal(boardDocuments.mirrorMystery10.markdown.includes('两名普通狼人'), true, '10人镜隐迷踪应收录两名普通狼人的首夜顺序')
assert.equal(boardDocuments.miracleMerchant10.markdown.includes('奇迹商人交易 → 幸运儿行动'), true, '10人奇迹商人应收录交易优先的夜间顺序')
assert.equal(boardDocuments.miracleMerchant12.markdown.includes('神职技能称号'), false, '资料页不应收录与游戏无关的神职技能称号说明')

let boardPage
let rolePage
global.wx = { navigateBack() {}, setNavigationBarTitle() {} }
global.Page = config => { boardPage = config }
require('../pages/board-detail/board-detail')
boardPage.setData = update => Object.assign(boardPage.data, update)
boardPage.onLoad.call(boardPage, { boardId: 'standard12' })
assert.equal(boardPage.data.roleCards.length, 6, '标准场详情应展示所有身份')
assert.equal(boardPage.data.detailSections.some(section => section.title === '胜负条件'), true, '板子详情应展示文档规则')

global.Page = config => { rolePage = config }
require('../pages/role-detail/role-detail')
rolePage.setData = update => Object.assign(rolePage.data, update)
rolePage.onLoad.call(rolePage, { roleId: 'cursedFox' })
const qa = rolePage.data.sections.find(section => section.isQa)
assert.equal(qa.qas.length, 5, '咒狐完整 Q&A 应可展示')

Object.keys(roleDocuments).forEach(roleId => {
  rolePage.onLoad.call(rolePage, { roleId })
  assert.equal(rolePage.data.sourceNote, '', `${roleId}不应展示来源提示语`)
  rolePage.data.sections.forEach(section => {
    const texts = section.isQa ? section.qas.map(item => item.answer) : section.paragraphs
    texts.forEach(text => assert.equal(/^[ \t]*-{3,}[ \t]*$/m.test(text), false, `${roleId}正文不应混入章节分隔线`))
  })
})
rolePage.onLoad.call(rolePage, { roleId: 'villager' })
assert.equal(rolePage.data.sections.find(section => section.isQa).qas[0].answer, '认真听别人发言进行分析，自己踊跃发言不要过麦，表明自己的身份，勇于为自己心目中的预言家投票，很快就能上手啦。', '平民答案应保留完整正文并去除末尾分隔线')

console.log('reference page tests passed')
