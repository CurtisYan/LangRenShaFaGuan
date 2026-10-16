const assert = require('assert')
const { boards } = require('../data/boards')
let page
let savedPins = []
let failSave = false
let toast = ''
let route = ''
global.Page = config => { page = config }
global.getApp = () => ({ globalData: { game: null } })
global.wx = {
  getStorageSync: key => { assert.equal(key, 'pinnedBoardIds'); return savedPins },
  setStorageSync(key, value) {
    assert.equal(key, 'pinnedBoardIds')
    if (failSave) throw new Error('storage unavailable')
    savedPins = value.slice()
  },
  showToast: ({ title }) => { toast = title },
  navigateTo: ({ url }) => { route = url }
}
require('../pages/index/index')
page.setData = update => Object.assign(page.data, update)
const toggle = id => page.togglePinnedBoard({ currentTarget: { dataset: { id } } })
const chosen = [boards[7].id, boards[3].id, boards[10].id]
page.onShow()
assert.deepEqual(page.data.boards, boards)
page.openPinManager()
chosen.forEach(toggle)
assert.deepEqual(chosen.map(id => page.data.pinChoices.find(item => item.id === id).pinOrder), [1, 2, 3], '编号应跟随点击收藏顺序')
toggle(chosen[1])
assert.equal(page.data.pinChoices.find(item => item.id === chosen[2]).pinOrder, 2, '取消中间项后编号前移')
assert.equal(page.data.pinChoices.find(item => item.id === chosen[1]).pinOrder, 0, '取消项不显示序号')
toggle(chosen[1])
assert.equal(page.data.pinChoices.find(item => item.id === chosen[1]).pinOrder, 3, '重新收藏追加到末尾')
toggle(chosen[1])
toggle(chosen[2])
toggle(chosen[1])
toggle(chosen[2])
toggle(boards[0].id)
assert.equal(toast, '最多置顶3个板子')
assert.deepEqual(page.data.pinDraftIds, chosen)
assert.deepEqual(savedPins, [], '保存前不应写入偏好')
page.savePinnedBoards()
assert.equal(page.data.pinManagerOpen, true, '退出动画结束前保留面板')
assert.equal(page.data.pinManagerClosing, true)
page.onPinSheetAnimationEnd()
assert.equal(page.data.pinManagerOpen, false)
assert.deepEqual(savedPins, chosen)
assert.deepEqual(page.data.boards.slice(0, 3).map(item => item.id), chosen)
assert.equal(page.data.boards.filter(item => item.pinned).length, 3, '首页仅置顶的三个板子显示图钉标记')
assert.equal(new Set(page.data.boards.map(item => item.id)).size, boards.length, '置顶不得产生重复板子')
assert.deepEqual(page.data.boards.slice(3), boards.filter(item => !chosen.includes(item.id)), '未置顶板子保持原顺序')
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, chosen, '重新进入首页应恢复设置')
page.openPinManager()
assert.deepEqual(chosen.map(id => page.data.pinChoices.find(item => item.id === id).pinOrder), [1, 2, 3], '重新打开管理页应恢复已保存的顺序标签')
toggle(chosen[0])
page.closePinManager()
page.onPinSheetAnimationEnd()
assert.deepEqual(page.data.pinnedBoardIds, chosen, '取消管理不得修改已有置顶')
page.openPinManager()
toggle(chosen[0])
failSave = true
page.savePinnedBoards()
assert.equal(page.data.pinManagerOpen, true, '保存失败时应保留编辑状态')
assert.deepEqual(page.data.pinnedBoardIds, chosen)
failSave = false
page.data.pinDraftIds = []
page.savePinnedBoards()
page.onPinSheetAnimationEnd()
assert.deepEqual(savedPins, [])
assert.deepEqual(page.data.boards, boards, '清空置顶应恢复默认顺序')
savedPins = [chosen[0], chosen[0], 'obsolete-board', ...chosen.slice(1), boards[0].id]
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, chosen, '缓存应去重、忽略失效板子并限制为三个')
page.chooseBoard({ currentTarget: { dataset: { id: page.data.boards[0].id } } })
assert.equal(route, `/pages/setup/setup?boardId=${chosen[0]}`, '置顶后仍应按正确板子开局')
console.log('index page pin tests passed')
