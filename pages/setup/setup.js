const { getBoard } = require('../../data/boards')
const { roles } = require('../../data/roles')
const { makeGame } = require('../../utils/game-engine')

Page({
  data: { board: null, seats: [], mode: 'role', selectedRoleId: '', selectedSeatNumber: 1, roleGroups: [], numberCards: [], summaryItems: [], assignedCount: 0, error: '' },

  onLoad(query) {
    const board = getBoard(query.boardId || 'standard12')
    const saved = wx.getStorageSync(`setupDraft_${board.id}`)
    const savedRoles = saved && Array.isArray(saved.seatRoles) && saved.seatRoles.length === board.playerCount ? saved.seatRoles : null
    const seats = Array.from({ length: board.playerCount }, (_, index) => {
      const roleId = savedRoles ? savedRoles[index] : ''
      return { number: index + 1, roleId, roleName: roleId ? roles[roleId].name : '未分配' }
    })
    this.setData({ board, seats, mode: saved && saved.mode === 'seat' ? 'seat' : 'role', selectedRoleId: Object.keys(board.roleCounts)[0] })
    this.rebuildView()
  },

  setMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode, error: '' })
    this.saveDraft()
    this.rebuildView()
  },

  selectRole(event) {
    this.setData({ selectedRoleId: event.currentTarget.dataset.roleId, error: '' })
    this.rebuildView()
  },

  selectSeat(event) {
    const number = Number(event.currentTarget.dataset.number)
    if (this.data.mode === 'seat') {
      this.setData({ selectedSeatNumber: number, error: '' })
      this.rebuildView()
      return
    }
    const seat = this.data.seats.find(item => item.number === number)
    this.assignRole(number, seat.roleId === this.data.selectedRoleId ? '' : this.data.selectedRoleId)
  },

  assignSelectedRole(event) {
    const roleId = event.currentTarget.dataset.roleId
    const selectedSeat = this.data.seats.find(item => item.number === this.data.selectedSeatNumber)
    this.assignRole(this.data.selectedSeatNumber, selectedSeat && selectedSeat.roleId === roleId ? '' : roleId)
  },

  assignRole(number, roleId) {
    const seatIndex = this.data.seats.findIndex(item => item.number === number)
    if (seatIndex < 0) return
    if (roleId) {
      const used = this.data.seats.filter(item => item.roleId === roleId && item.number !== number).length
      const limit = this.data.board.roleCounts[roleId]
      if (used >= limit) return this.toast(`${roles[roleId].name}已达到${limit}人上限`)
    }
    const seats = this.data.seats.slice()
    seats[seatIndex] = { ...seats[seatIndex], roleId, roleName: roleId ? roles[roleId].name : '未分配' }
    this.setData({ seats, error: '' })
    this.saveDraft()
    this.rebuildView()
  },

  resetDraft() {
    wx.showModal({ title: '清空身份配置？', content: '所有座位将恢复为未分配状态。', success: result => {
      if (!result.confirm) return
      const seats = this.data.seats.map(item => ({ ...item, roleId: '', roleName: '未分配' }))
      this.setData({ seats, error: '' })
      this.saveDraft()
      this.rebuildView()
    } })
  },

  rebuildView() {
    const { board, seats, selectedRoleId, selectedSeatNumber } = this.data
    const roleIds = Object.keys(board.roleCounts)
    const selectedSeat = seats.find(item => item.number === selectedSeatNumber)
    const makeRole = roleId => {
      const numbers = seats.filter(item => item.roleId === roleId).map(item => item.number)
      return { id: roleId, name: roles[roleId].name, capacity: board.roleCounts[roleId], count: numbers.length, assignedText: numbers.length ? numbers.map(number => `${number}号`).join('、') : '未选号码', selected: roleId === selectedRoleId, selectedForSeat: selectedSeat && selectedSeat.roleId === roleId }
    }
    const roleGroups = [
      { name: '狼人阵营', tone: 'wolf', items: roleIds.filter(id => roles[id].camp === 'wolf').map(makeRole) },
      { name: '好人阵营', tone: 'good', items: roleIds.filter(id => roles[id].camp === 'good').map(makeRole) }
    ]
    const numberCards = seats.map(item => ({ ...item, selected: item.number === selectedSeatNumber, roleLabel: item.roleId ? item.roleName : '未分配' }))
    this.setData({ roleGroups, summaryItems: roleIds.map(makeRole).filter(item => item.count > 0), assignedCount: seats.filter(item => item.roleId).length, numberCards })
  },

  saveDraft() {
    const { board, mode, seats } = this.data
    if (board) wx.setStorageSync(`setupDraft_${board.id}`, { mode, seatRoles: seats.map(item => item.roleId) })
  },

  startGame() {
    const actual = {}
    this.data.seats.forEach(seat => { if (seat.roleId) actual[seat.roleId] = (actual[seat.roleId] || 0) + 1 })
    const invalid = Object.keys(this.data.board.roleCounts).filter(id => actual[id] !== this.data.board.roleCounts[id])
    if (invalid.length) return this.setData({ error: `配置尚未完成：${invalid.map(id => `${roles[id].name}${actual[id] || 0}/${this.data.board.roleCounts[id]}`).join('，')}` })
    this.saveDraft()
    getApp().saveGame(makeGame(this.data.board, this.data.seats.map(seat => seat.roleId)))
    wx.redirectTo({ url: '/pages/game/game' })
  },

  toast(title) { wx.showToast({ title, icon: 'none' }) }
})
