const assert = require('assert')
const { boards: presets } = require('../data/boards')
let page
const storage = { pinnedBoardIds: [presets[7].id, presets[3].id, presets[10].id] }
let failSave = false
let toast = ''
let route = ''
global.Page = config => { page = config }
global.getApp = () => ({ globalData: { game: null } })
global.wx = {
  getStorageSync: key => storage[key],
  setStorageSync(key, value) {
    if (failSave) throw new Error('storage unavailable')
    storage[key] = Array.isArray(value) ? value.slice() : value
  },
  showToast: ({ title }) => { toast = title },
  navigateTo: ({ url }) => { route = url }
}
require('../pages/index/index')
page.setData = update => Object.assign(page.data, update)
const toggle = id => page.togglePinnedBoard({ currentTarget: { dataset: { id } } })
const oldPins = storage.pinnedBoardIds.slice()
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, ['custom', ...oldPins], '更新时自定义板子置顶第一，原置顶顺序后移')
assert.equal(storage.customBoardPinMigrationV1, true)
assert.equal(page.data.boards.length, presets.length + 1)
page.chooseBoard({ currentTarget: { dataset: { id: 'custom' } } })
assert.equal(route, '/pages/custom-board/custom-board')
page.openPinManager()
toggle(presets[0].id)
assert.equal(page.data.pinDraftIds.length, 5)
toggle(presets[1].id)
assert.equal(toast, '最多置顶5个板子')
assert.equal(page.data.pinDraftIds.length, 5)
assert.deepEqual(storage.pinnedBoardIds, ['custom', ...oldPins], '保存前不得改写置顶')
page.savePinnedBoards()
assert.equal(page.data.pinManagerClosing, true)
page.onPinSheetAnimationEnd()
assert.equal(page.data.pinManagerOpen, false)
assert.equal(page.data.boards.filter(board => board.pinned).length, 5)
assert.deepEqual(page.data.boards.slice(0, 5).map(board => board.id), storage.pinnedBoardIds, '人数排序不能打乱用户的置顶顺序')
assert.equal(new Set(page.data.boards.map(board => board.id)).size, presets.length + 1)
page.openPinManager()
toggle('custom')
page.savePinnedBoards()
page.onPinSheetAnimationEnd()
page.onShow()
assert.equal(page.data.pinnedBoardIds.includes('custom'), false, '手动取消自定义板子置顶后不得重新加回')
assert.equal(page.data.boards.some(board => board.id === 'custom'), true, '取消置顶仍能选择自定义板子')
page.openPinManager()
toggle(oldPins[0])
assert.equal(page.data.pinChoices.find(board => board.id === oldPins[1]).pinOrder, 1)
page.closePinManager()
page.onPinSheetAnimationEnd()
assert.equal(page.data.pinnedBoardIds.includes(oldPins[0]), true, '取消面板不应更改设置')
page.openPinManager()
toggle(oldPins[0])
failSave = true
page.savePinnedBoards()
assert.equal(page.data.pinManagerOpen, true)
assert.equal(page.data.pinnedBoardIds.includes(oldPins[0]), true)
failSave = false
page.data.pinDraftIds = []
page.savePinnedBoards()
page.onPinSheetAnimationEnd()
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, [], '清空置顶后不重新迁移')
const defaultPresetRows = page.data.boards.filter(board => !board.isCustom)
assert.equal(defaultPresetRows.every((board, index) => index === 0 || defaultPresetRows[index - 1].playerCount <= board.playerCount), true, '未置顶板子默认按人数从少到多排列')
assert.deepEqual(defaultPresetRows.filter(board => board.playerCount === 12).map(board => board.id), presets.filter(board => board.playerCount === 12).map(board => board.id), '人数相同时保持原有相对顺序')
storage.pinnedBoardIds = [oldPins[0], oldPins[0], 'obsolete', ...oldPins.slice(1), presets[0].id, presets[1].id, presets[2].id]
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, [...oldPins, presets[0].id, presets[1].id], '去重、忽略失效项并限制五个')
page.chooseBoard({ currentTarget: { dataset: { id: oldPins[0] } } })
assert.equal(route, `/pages/setup/setup?boardId=${oldPins[0]}`)
delete storage.customBoardPinMigrationV1
storage.pinnedBoardIds = []
page.onShow()
assert.deepEqual(page.data.pinnedBoardIds, ['custom'], '新用户默认只置顶自定义板子')
console.log('index page pin tests passed')

let cleared = false
global.getApp = () => ({ clearGame() { cleared = true } })
global.wx.showModal = ({ success }) => success({ confirm: true })
page.data.currentGame = { id: 'test' }
const pinsBeforeReset = storage.pinnedBoardIds.slice()
page.resetGame()
assert.equal(cleared, true)
assert.equal(page.data.currentGame, null)
assert.deepEqual(storage.pinnedBoardIds, pinsBeforeReset, '结束对局不应改变置顶设置')
