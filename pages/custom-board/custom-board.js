const { roles } = require('../../data/roles')
const { defaultSettings, buildCustomBoard, customBoardWarnings, customRoleSelectionError, settingsForPlayerCount } = require('../../data/custom-board')
const playerCountOptions = [6, 9, 12]

Page({
  data: { counts: {}, playerCountOptions, targetPlayers: 12, arrowMotion: '', arrowPulse: false, selectedRoles: [], settings: { ...defaultSettings }, groups: [], total: 0, summary: '', winModes: [{ id: 'manual', name: '玩家自己裁决', note: '由法官记录最终胜方' }, { id: 'edge', name: '屠边', note: '所有平民或所有神民出局' }, { id: 'city', name: '屠城', note: '所有好人全部出局' }] },
  onLoad() {
    const draft = wx.getStorageSync('customBoardDraft') || {}
    const targetPlayers = Number.isInteger(draft.targetPlayers) && draft.targetPlayers >= 2 ? draft.targetPlayers : 12
    this.setData({ counts: draft.counts || {}, targetPlayers, settings: settingsForPlayerCount(draft.settings, targetPlayers) })
    this.rebuild()
    if (this.data.total > this.data.targetPlayers) {
      this.setData({ targetPlayers: this.data.total, settings: settingsForPlayerCount(this.data.settings, this.data.total) })
      this.showConfigError(`已选${this.data.total}人，配置人数已恢复为${this.data.total}人`)
      this.saveDraft()
    }
  },
  rebuild() {
    const counts = this.data.counts
    const groups = [{ camp: 'good', name: '好人阵营' }, { camp: 'wolf', name: '狼人阵营' }, { camp: 'third', name: '第三方阵营' }].map(group => ({ ...group, items: Object.values(roles).filter(role => role.camp === group.camp).map(role => ({ ...role, count: counts[role.id] || 0, counter: ['villager', 'wolf'].includes(role.id) })) }))
    const selected = Object.entries(counts).filter(([id, count]) => roles[id] && count > 0)
    this.setData({ groups, selectedRoles: selected.map(([id, count]) => ({ id, name: roles[id].name, count })), total: selected.reduce((sum, [, count]) => sum + count, 0), summary: selected.map(([id, count]) => `${roles[id].name} ${count}`).join(' · ') })
  },
  showConfigError(message) {
    if (wx.showToast) wx.showToast({ title: message, icon: 'none', duration: 2000 })
  },
  missingCamps(counts) {
    return ['wolf', 'good'].filter(camp => !Object.keys(counts).some(id => counts[id] > 0 && roles[id] && roles[id].camp === camp))
  },
  clearArrowMotion() { this.setData({ arrowMotion: '' }) },
  changePlayerCount(event) {
    const { value, direction } = event.currentTarget.dataset
    const next = value ? Number(value) : this.data.targetPlayers + Number(direction)
    if (direction) this.setData({ arrowMotion: Number(direction) < 0 ? 'left' : 'right', arrowPulse: !this.data.arrowPulse })
    if (!Number.isInteger(next) || next < 2) return
    if (this.data.total > next) return this.showConfigError(`已选${this.data.total}人，请先移除角色再减少人数`)
    if (next - this.data.total < this.missingCamps(this.data.counts).length) return this.showConfigError('请为狼人阵营和好人阵营各保留至少一个名额')
    const sheriffWasEnabled = this.data.settings.sheriff
    this.setData({ targetPlayers: next, settings: settingsForPlayerCount(this.data.settings, next) })
    if (sheriffWasEnabled && next < 9) this.showConfigError('少于9人不能竞选警长，已自动关闭')
    this.saveDraft()
  },
  openRoleDetail(event) {
    const { id } = event.currentTarget.dataset
    if (!roles[id]) return
    this.saveDraft()
    wx.navigateTo({ url: `/pages/role-detail/role-detail?roleId=${id}` })
  },
  changeRole(event) {
    const { id, delta } = event.currentTarget.dataset
    if (!roles[id]) return
    const current = this.data.counts[id] || 0
    const count = ['wolf', 'villager'].includes(id) ? Math.max(0, current + Number(delta)) : (current ? 0 : 1)
    if (count > current && this.data.total >= this.data.targetPlayers) return this.showConfigError(`已选满${this.data.targetPlayers}人，请先移除角色或增加配置人数`)
    const nextCounts = { ...this.data.counts, [id]: count }
    const specialWolfError = customRoleSelectionError(nextCounts)
    if (specialWolfError) return this.showConfigError(specialWolfError)
    const remaining = this.data.targetPlayers - (this.data.total + count - current)
    if (count > current && remaining < this.missingCamps(nextCounts).length) return this.showConfigError('至少需要一名狼人阵营和一名好人阵营角色，请保留名额')
    this.setData({ counts: { ...this.data.counts, [id]: count } })
    this.rebuild()
    this.saveDraft()
    if (count > current) {
      const warnings = customBoardWarnings(nextCounts)
      if (warnings.length) this.showConfigError(warnings[0])
    }
  },
  changeSetting(event) {
    const { key, value } = event.currentTarget.dataset
    if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) return
    if (key === 'sheriff' && value && this.data.targetPlayers < 9) return this.showConfigError('至少9人才能开启警长竞选')
    if (key === 'exposure' && value === 'double' && this.data.targetPlayers <= 10) return this.showConfigError('10人及以下只能单曝吞警徽，双曝需要至少11人')
    this.setData({ settings: { ...this.data.settings, [key]: value } })
    this.saveDraft()
  },
  saveDraft() { wx.setStorageSync('customBoardDraft', { counts: this.data.counts, settings: this.data.settings, targetPlayers: this.data.targetPlayers }) },
  continueSetup() {
    let board
    try { board = buildCustomBoard(this.data.counts, this.data.settings) } catch (error) { return this.showConfigError(error.message) }
    if (board.playerCount !== this.data.targetPlayers) return this.showConfigError(`已选${board.playerCount}/${this.data.targetPlayers}人，请${board.playerCount < this.data.targetPlayers ? '补齐' : '减少'}角色人数`)
    this.saveDraft()
    wx.setStorageSync('customBoardConfig', board)
    wx.navigateTo({ url: '/pages/setup/setup?boardId=custom' })
  }
})
