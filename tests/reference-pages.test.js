const assert = require('assert')
const { boards } = require('../data/boards')
const { roleDocuments } = require('../data/role-documents')
const { boardDocuments } = require('../data/board-documents')

assert.equal(Object.keys(roleDocuments).length, 21, '角色资料应完整收录文档中的 21 个专章')
assert.equal(Object.keys(boardDocuments).length, 11, '板子资料应完整收录文档中的 11 个板子')
assert.equal(boards.length, 11, '所有已收录板子均应可开局')
assert.deepEqual(boards.map(board => board.id).sort(), Object.keys(boardDocuments).sort(), '可开局板子与资料库板子必须一一对应')
assert.equal(roleDocuments.cursedFox.markdown.includes('### Q&A'), true, '咒狐 Q&A 不应遗漏')
assert.equal(roleDocuments.wolf.markdown.includes('### Q&A'), true, '狼人角色说明与 Q&A 不应遗漏')
assert.equal(boardDocuments.standard12.markdown.includes('出局技能连锁'), true, '标准场完整板子规则不应遗漏')

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

console.log('reference page tests passed')
