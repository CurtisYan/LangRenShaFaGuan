const { getBoard } = require('../../data/boards')
const { roles } = require('../../data/roles')
const engine = require('../../utils/game-engine')

Page({
  data: {
    game: null, board: null, aliveSeats: [], aliveLabels: [], selectedTargetIndex: 0, selectedTarget: null,
    wolfTargetIndex: 0, guardTargetIndex: 0, seerTargetIndex: 0, witchTargetIndex: 0, lonelyGirlTargetIndex: 0, lonelyGirlTargets: [], lonelyGirlTargetLabels: [],
    witchActions: ['不用药', '使用解药', '使用毒药'], witchActionIndex: 0,
    inspection: '', wolfMembers: '', seerNumber: '', witchNumber: '', guardNumber: '', lonelyGirlNumber: '', wolfAlive: false, guardAlive: false, seerAlive: false, witchAlive: false, lonelyGirlAlive: false, hasGuard: false, hasLonelyGirl: false,
    dayState: null, sheriffCandidates: [], sheriffSignupSeats: [], dayVoters: [], voteTargets: [], voteTargetLabels: [], selectedVoterIndex: 0, selectedVoterIndices: [], selectedVoteTargetIndex: 0,
    voteRecords: [], voteTally: [], sheriffWeight: 1.5, sheriffSeat: null, selfExposeCandidates: [], pendingWolfKingClaw: false, pendingSkill: null, pendingLastWord: null, pendingSkillCanTarget: false, choosingSkillTarget: false, skillTargetLabels: [], selectedSkillTargetIndex: 0, simpleVoteCount: '', dayMessage: '', seatCards: [], voteHistory: [], selectedVoteHistoryIndex: 0, selectedVoteRound: null, selectedVoteRows: [], seatInfo: null, canGoBack: false, confirmationPulse: '', rippleX: 0, rippleY: 0
  },

  onShow() { this.refresh() },

  refresh() {
    const game = getApp().globalData.game
    if (!game) return wx.redirectTo({ url: '/pages/index/index' })
    const board = getBoard(game.boardId)
    if (game.phase === 'day' && !game.dayState) { game.dayState = engine.createDayState(game); getApp().saveGame(game) }
    const aliveSeats = game.seats.filter(seat => seat.alive)
    const roleSeat = roleId => game.seats.find(seat => seat.roleId === roleId)
    const seer = roleSeat('seer'); const witch = roleSeat('witch'); const guard = roleSeat('guard'); const lonelyGirl = roleSeat('lonelyGirl')
    const indexFor = number => Math.max(0, aliveSeats.findIndex(seat => seat.number === number))
    const lonelyGirlTargets = lonelyGirl && game.day === 1 ? aliveSeats.filter(seat => seat.number !== lonelyGirl.number) : []
    const lonelyGirlTarget = game.special && game.special.lonelyGirlTarget
    const lonelyGirlTargetIndex = Math.max(0, lonelyGirlTargets.findIndex(seat => seat.number === lonelyGirlTarget))
    const dayView = game.phase === 'day' ? this.makeDayView(game, board, aliveSeats) : {}
    const inspectionTarget = game.night.seerTarget && game.seats.find(seat => seat.number === game.night.seerTarget)
    const deathPrompt = game.dayState && game.dayState.stage === 'deathSkills' && game.pendingDeathSkills && game.pendingDeathSkills[0]
    const lastWordPrompt = game.dayState && game.dayState.stage === 'lastWords' && game.pendingLastWords && game.pendingLastWords[0]
    const seatCards = game.seats.map(seat => ({ ...seat, marks: seat.marks || { goldWater: false, silverWater: false } }))
    const voteHistory = game.voteHistory || []
    const stepHistory = Array.isArray(game.stepHistory) ? game.stepHistory : []
    const latestStep = stepHistory[stepHistory.length - 1]
    const voteIndex = Math.min(this.data.selectedVoteHistoryIndex, Math.max(0, voteHistory.length - 1))
    const selectedVoteRound = voteHistory[voteIndex] || null
    const selectedVoteRows = selectedVoteRound ? this.groupVoteRecords(selectedVoteRound.eligibleVoters || Object.keys(selectedVoteRound.votes || {}), selectedVoteRound.votes || {}, selectedVoteRound.sheriffSeat) : []
    this.setData({
      game, board, aliveSeats, aliveLabels: aliveSeats.map(seat => `${seat.number}号`), selectedTargetIndex: 0, selectedTarget: aliveSeats[0] ? aliveSeats[0].number : null,
      wolfTargetIndex: indexFor(game.night.wolfTarget), guardTargetIndex: indexFor(game.night.guardTarget), seerTargetIndex: indexFor(game.night.seerTarget), witchTargetIndex: indexFor(game.night.witchTarget), lonelyGirlTargetIndex, lonelyGirlTargets, lonelyGirlTargetLabels: lonelyGirlTargets.map(seat => `${seat.number}号`), witchActionIndex: ['none', 'save', 'poison'].indexOf(game.night.witchAction),
      inspection: inspectionTarget ? (roles[inspectionTarget.roleId].camp === 'wolf' ? '狼人' : '好人') : '',
      wolfMembers: game.seats.filter(seat => roles[seat.roleId].camp === 'wolf').map(seat => `${seat.number}号`).join('、'),
      seerNumber: seer ? seer.number : '', witchNumber: witch ? witch.number : '', guardNumber: guard ? guard.number : '', lonelyGirlNumber: lonelyGirl ? lonelyGirl.number : '',
      wolfAlive: game.seats.some(seat => seat.alive && roles[seat.roleId].camp === 'wolf'), guardAlive: engine.roleAlive(game, 'guard'), seerAlive: engine.roleAlive(game, 'seer'), witchAlive: engine.roleAlive(game, 'witch'), lonelyGirlAlive: engine.roleAlive(game, 'lonelyGirl'), hasGuard: Boolean(guard), hasLonelyGirl: Boolean(lonelyGirl),
      pendingSkill: deathPrompt ? { number: deathPrompt.seatNumber, canUse: engine.canUseDeathSkill(game, deathPrompt) } : null,
      pendingLastWord: lastWordPrompt ? { number: lastWordPrompt.seatNumber } : null,
      pendingSkillCanTarget: deathPrompt ? engine.canUseDeathSkill(game, deathPrompt) : false,
      choosingSkillTarget: deathPrompt && this.data.choosingSkillTarget && this.data.pendingSkill && this.data.pendingSkill.number === deathPrompt.seatNumber,
      skillTargetLabels: aliveSeats.map(seat => `${seat.number}号`), selectedSkillTargetIndex: 0,
      seatCards, voteHistory, selectedVoteHistoryIndex: voteIndex, selectedVoteRound, selectedVoteRows, canGoBack: Boolean(latestStep),
      ...dayView
    })
  },

  makeDayView(game, board, aliveSeats) {
    const state = game.dayState
    const dayStageLabels = {
      sheriffSignup: '上警', sheriffSpeech: '警上发言', sheriffResumeWithdraw: '退水', sheriffVote: '警长投票', sheriffTie: '警长 PK', sheriffOrder: '确定发言顺序', announceNight: '公布昨夜信息', selfExposeNight: '自曝结算', discussion: '白天发言', exileVote: '放逐投票', exileTie: '放逐 PK', exileDone: '放逐结算'
    }
    const isSheriffVote = state.stage === 'sheriffVote'
    const isExileVote = state.stage === 'exileVote'
    const voters = isSheriffVote ? aliveSeats.filter(seat => state.sheriffPk ? !state.sheriffCandidates.includes(seat.number) : !state.sheriffInitialCandidates.includes(seat.number) && !state.sheriffWithdrawn.includes(seat.number)) : isExileVote && state.exileMode === 'individual' ? aliveSeats.filter(seat => !state.exilePk || !state.exileTieCandidates.includes(seat.number)) : []
    const targets = isSheriffVote ? state.sheriffCandidates : isExileVote && state.exilePk ? state.exileTieCandidates : aliveSeats.map(seat => seat.number)
    const targetLabels = targets.map(number => `${number}号`).concat(isSheriffVote || isExileVote ? ['弃票'] : [])
    const voteMap = isSheriffVote ? state.sheriffVotes : state.exileVotes
    const tally = this.tallyVotes(voteMap, game.sheriffSeat)
    const voteRecords = this.groupVoteRecords(voters, voteMap, game.sheriffSeat)
    const selfExposeCandidates = aliveSeats.filter(seat => roles[seat.roleId].canSelfExpose && (board.dayRules.selfExposeRoleIds || []).includes(seat.roleId)).map(seat => ({ number: seat.number, name: seat.roleName }))
    const sheriffSignupSeats = aliveSeats.map(seat => ({ number: seat.number, selected: state.sheriffCandidates.includes(seat.number) }))
    const sheriffWithdrawalSeats = state.sheriffCandidates.map(number => ({ number, armed: this.data.confirmationPulse === `withdraw-${number}` }))
    return { dayState: state, dayStageLabel: dayStageLabels[state.stage] || '白天流程', sheriffCandidates: state.sheriffCandidates.map(number => `${number}号`), sheriffCandidateText: state.sheriffCandidates.map(number => `${number}号`).join('、'), sheriffSignupSeats, sheriffWithdrawalSeats, dayVoters: voters.map(seat => ({ ...seat, selected: false })), voteTargets: targets.concat([null]), voteTargetLabels: targetLabels, voteRecords, voteTally: this.tallyRows(tally), sheriffWeight: board.dayRules.sheriffVoteWeight, sheriffSeat: game.sheriffSeat, selfExposeCandidates, pendingWolfKingClaw: game.pendingWolfKingClaw, selectedVoterIndex: 0, selectedVoterIndices: [], selectedVoteTargetIndex: 0, dayMessage: state.message || '', nightDeathText: this.nightDeathText(game) }
  },

  tallyVotes(votes, sheriffSeat) {
    return Object.keys(votes).reduce((result, voter) => {
      const target = votes[voter]
      if (target) result[target] = (result[target] || 0) + (Number(voter) === sheriffSeat ? 1.5 : 1)
      return result
    }, {})
  },
  tallyRows(tally) { return Object.keys(tally).sort((a, b) => Number(a) - Number(b)).map(number => ({ number, value: tally[number] })) },
  groupVoteRecords(voters, votes, sheriffSeat) {
    const groups = {}
    voters.forEach(voter => {
      const number = Number(voter.number || voter)
      const hasVote = Object.prototype.hasOwnProperty.call(votes, number)
      const target = hasVote && votes[number] ? `${votes[number]}号` : '弃票'
      if (!groups[target]) groups[target] = []
      groups[target].push(`${number === sheriffSeat ? '⬡' : ''}${number}号`)
    })
    return Object.keys(groups).sort((left, right) => {
      if (left === '弃票') return 1
      if (right === '弃票') return -1
      return Number(left.replace('号', '')) - Number(right.replace('号', ''))
    }).map(target => ({ target, voters: groups[target].join(' ') }))
  },
  nightDeathText(game) { const deaths = (game.latestNightDeathNumbers || []).map(number => `${number}号`); return deaths.length ? `昨夜${deaths.join('、')}出局。` : '昨夜是平安夜。' },
  saveAndRefresh(game) { getApp().saveGame(game); this.refresh() },
  checkpoint(game, label) { engine.checkpointStep(game, label) },
  startHold(event) {
    const key = event.currentTarget.dataset.holdKey
    if (key === 'back' && !this.data.canGoBack) return
    this._holdKey = key
    this._holdReady = false
    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
    const beginPulse = point => this.setData({ confirmationPulse: '', rippleX: point.x, rippleY: point.y }, () => {
      this.setData({ confirmationPulse: key })
    })
    const selector = event.currentTarget.dataset.holdId
    if (!touch || !selector || !wx.createSelectorQuery) return beginPulse({ x: 32, y: 32 })
    wx.createSelectorQuery().select(`#${selector}`).boundingClientRect(rect => {
      if (!rect || this._holdKey !== key) return
      beginPulse({ x: Math.max(0, Math.min(rect.width, touch.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, touch.clientY - rect.top)) })
    }).exec()
  },
  completeHold(event) {
    const key = event.currentTarget.dataset.holdKey
    if (this._holdKey === key) this._holdReady = true
  },
  endHold(event) {
    const key = event.currentTarget.dataset.holdKey
    const ready = this._holdKey === key && this._holdReady
    if (ready) {
      this.clearHold()
      if (key === 'back') return this.goBackStep()
      return this.withdrawSheriffCandidate(Number(event.currentTarget.dataset.number))
    }
    this.clearHold()
  },
  cancelHold() { this.clearHold() },
  clearHold() {
    this._holdKey = null
    this._holdReady = false
    this.setData({ confirmationPulse: '' })
  },
  goBackStep() {
    const restored = engine.restoreStep(this.data.game)
    if (!restored) return
    this.clearHold()
    this.setData({ choosingSkillTarget: false, simpleVoteCount: '', seatInfo: null })
    getApp().saveGame(restored.game)
    this.refresh()
  },
  openBoardDetail() { wx.navigateTo({ url: `/pages/board-detail/board-detail?boardId=${this.data.game.boardId}` }) },
  electSheriff(game, number, reason) {
    game.sheriffSeat = number
    game.sheriffElectionDone = true
    game.sheriffElectionInterrupted = false
    game.dayState.stage = 'sheriffOrder'
    game.dayState.message = ''
    engine.addLog(game, `第${game.day}天：${number}号当选警长（${reason}）`)
    this.saveAndRefresh(game)
  },

  selectTarget(event) { const index = Number(event.detail.value); this.setData({ selectedTargetIndex: index, selectedTarget: this.data.aliveSeats[index].number }) },
  selectLonelyGirlTarget(event) {
    const target = this.data.lonelyGirlTargets[Number(event.detail.value)]
    if (!target) return this.toast('请选择孤独少女的崇拜对象')
    const game = this.data.game
    this.checkpoint(game, '记录孤独少女的崇拜对象')
    try { engine.setLonelyGirlTarget(game, target.number) } catch (error) { return this.toast(error.message) }
    this.saveAndRefresh(game)
  },
  updateNightTarget(event) {
    const field = event.currentTarget.dataset.field; const target = this.data.aliveSeats[Number(event.detail.value)]; if (!target) return
    const game = this.data.game
    if (field === 'guardTarget' && game.resources.lastGuardTarget === target.number) return this.toast('守卫不能连续两晚守护同一名玩家')
    game.night[field] = target.number
    if (field === 'seerTarget') { const result = roles[target.roleId].camp === 'wolf' ? 'wolf' : 'good'; target.marks.goldWater = result === 'good' }
    this.saveAndRefresh(game)
  },
  selectWitchAction(event) {
    const action = ['none', 'save', 'poison'][Number(event.detail.value)]; const game = this.data.game
    if (action === 'save') { if (!game.resources.antidote) return this.toast('解药已经使用'); if (!game.night.wolfTarget) return this.toast('请先记录狼人刀口'); const witch = game.seats.find(item => item.roleId === 'witch'); if (witch && witch.number === game.night.wolfTarget) return this.toast('本板女巫全程不能自救') }
    if (action === 'poison' && !game.resources.poison) return this.toast('毒药已经使用')
    game.night.witchAction = action; if (action !== 'poison') game.night.witchTarget = null; this.saveAndRefresh(game)
  },
  finishNight() { const game = this.data.game; this.checkpoint(game, `第${game.day}夜行动结束`); if (game.night.witchAction === 'save') game.resources.antidote = false; if (game.night.witchAction === 'poison') game.resources.poison = false; engine.settleNight(game); this.saveAndRefresh(game) },

  declineDeathSkill() { const game = this.data.game; this.checkpoint(game, `${this.data.pendingSkill.number}号出局技能结算`); engine.resolveDeathSkill(game, this.data.pendingSkill.number, false); this.afterDeathSkill(game) },
  requestDeathSkill() {
    if (this.data.pendingSkillCanTarget) return this.setData({ choosingSkillTarget: true })
    const game = this.data.game; this.checkpoint(game, `${this.data.pendingSkill.number}号发动出局技能`); engine.resolveDeathSkill(game, this.data.pendingSkill.number, true); this.afterDeathSkill(game)
  },
  selectSkillTarget(event) { this.setData({ selectedSkillTargetIndex: Number(event.detail.value) }) },
  confirmDeathSkillTarget() { const game = this.data.game; const target = this.data.aliveSeats[this.data.selectedSkillTargetIndex]; if (!target) return this.toast('没有可选择的目标'); this.checkpoint(game, `${this.data.pendingSkill.number}号发动出局技能`); engine.resolveDeathSkill(game, this.data.pendingSkill.number, true, target.number); this.afterDeathSkill(game) },
  afterDeathSkill(game) { this.setData({ choosingSkillTarget: false }); if (!game.pendingDeathSkills.length && game.dayState && game.dayState.stage === 'deathSkills') game.dayState.stage = game.pendingLastWords && game.pendingLastWords.length ? 'lastWords' : (game.dayState.endAfterDeathSkills ? 'selfExposeNight' : 'discussion'); this.saveAndRefresh(game) },
  nextLastWord() { const game = this.data.game; this.checkpoint(game, '完成遗言'); game.pendingLastWords.shift(); if (!game.pendingLastWords.length) game.dayState.stage = game.dayState.endAfterDeathSkills ? 'selfExposeNight' : 'discussion'; this.saveAndRefresh(game) },

  toggleSheriffCandidate(event) {
    const game = this.data.game; const number = Number(event.currentTarget.dataset.number); const list = game.dayState.sheriffCandidates
    const index = list.indexOf(number); if (index >= 0) list.splice(index, 1); else list.push(number)
    game.dayState.sheriffInitialCandidates = list.slice(); game.dayState.sheriffWithdrawn = []
    this.saveAndRefresh(game)
  },
  beginSheriffSpeech() { const game = this.data.game; if (!game.dayState.sheriffCandidates.length) return this.toast('请先记录上警玩家'); this.checkpoint(game, '确认上警名单'); game.dayState.stage = 'sheriffSpeech'; engine.addLog(game, `第${game.day}天：上警玩家为${game.dayState.sheriffCandidates.map(n => `${n}号`).join('、')}`); this.saveAndRefresh(game) },
  withdrawSheriffCandidate(numberOrEvent) {
    const game = this.data.game; const number = Number(typeof numberOrEvent === 'number' ? numberOrEvent : numberOrEvent.currentTarget.dataset.number); const state = game.dayState
    if (!state.sheriffCandidates.includes(number)) return
    this.clearHold()
    this.checkpoint(game, `${number}号退水`)
    state.sheriffCandidates = state.sheriffCandidates.filter(item => item !== number)
    if (!state.sheriffWithdrawn.includes(number)) state.sheriffWithdrawn.push(number)
    if (state.sheriffPk && state.sheriffCandidates.length === 1) return this.electSheriff(game, state.sheriffCandidates[0], 'PK阶段仅剩一名候选人')
    this.saveAndRefresh(game)
  },
  beginSheriffVote() {
    const game = this.data.game; const state = game.dayState
    if (!state.sheriffCandidates.length) return this.toast('请至少保留一名警长候选人')
    this.checkpoint(game, state.sheriffPk ? '结束警长PK发言' : '结束警上发言')
    if (state.sheriffCandidates.length === 1) return this.electSheriff(game, state.sheriffCandidates[0], '仅剩一名候选人')
    state.stage = 'sheriffVote'
    this.saveAndRefresh(game)
  },
  selectDayVoter(event) {
    const index = Number(event.currentTarget.dataset.index)
    const state = this.data.dayState
    const supportsMultiSelect = state.stage === 'sheriffVote' || (state.stage === 'exileVote' && state.exileMode === 'individual')
    if (!supportsMultiSelect) return this.setData({ selectedVoterIndex: index })
    const selected = this.data.selectedVoterIndices.slice(); const found = selected.indexOf(index)
    if (found >= 0) selected.splice(found, 1); else selected.push(index)
    const voters = this.data.dayVoters.slice(); voters[index] = { ...voters[index], selected: !voters[index].selected }
    this.setData({ selectedVoterIndices: selected, dayVoters: voters })
  },
  selectVoteTarget(event) { this.setData({ selectedVoteTargetIndex: Number(event.detail.value) }) },
  recordVote() {
    const state = this.data.game.dayState
    const target = this.data.voteTargets[this.data.selectedVoteTargetIndex] || null
    const supportsMultiSelect = state.stage === 'sheriffVote' || (state.stage === 'exileVote' && state.exileMode === 'individual')
    const voters = supportsMultiSelect ? this.data.selectedVoterIndices.map(index => this.data.dayVoters[index]) : [this.data.dayVoters[this.data.selectedVoterIndex]]
    if (!voters.length || voters.some(item => !item)) return this.toast('请选择投票玩家')
    this.checkpoint(this.data.game, state.stage === 'sheriffVote' ? '记录警长投票' : '记录放逐投票')
    const map = state.stage === 'sheriffVote' ? state.sheriffVotes : state.exileVotes
    voters.forEach(voter => { map[voter.number] = target })
    this.saveAndRefresh(this.data.game)
  },
  resolveSheriffVote() {
    const game = this.data.game; const state = game.dayState; const tally = this.tallyVotes(state.sheriffVotes, null); const rows = this.tallyRows(tally)
    if (!rows.length) return this.toast('请至少记录一票')
    const eligibleVoters = game.seats.filter(seat => seat.alive && (state.sheriffPk ? !state.sheriffCandidates.includes(seat.number) : !state.sheriffInitialCandidates.includes(seat.number) && !state.sheriffWithdrawn.includes(seat.number))).map(seat => seat.number)
    this.checkpoint(game, state.sheriffPk ? '统计警长PK票' : '统计警长票')
    const max = Math.max(...rows.map(row => row.value)); const winners = rows.filter(row => row.value === max).map(row => Number(row.number))
    engine.addVoteHistory(game, { label: state.sheriffPk ? '警长PK投票' : '警长投票', votes: state.sheriffVotes, eligibleVoters, tally: this.tallyRows(tally), sheriffSeat: null })
    if (winners.length > 1) { state.stage = 'sheriffTie'; state.sheriffCandidates = winners; state.sheriffPk = true; state.message = `警长投票平票：${winners.map(n => `${n}号`).join('、')}`; return this.saveAndRefresh(game) }
    this.electSheriff(game, winners[0], '警长投票胜出')
  },
  restartSheriffVote() { const game = this.data.game; this.checkpoint(game, '开始警长PK发言'); game.dayState.sheriffVotes = {}; game.dayState.stage = 'sheriffSpeech'; game.dayState.message = ''; this.saveAndRefresh(game) },
  noSheriff() { const game = this.data.game; this.checkpoint(game, '警徽流失'); game.sheriffElectionDone = true; game.dayState.stage = 'announceNight'; engine.addLog(game, `第${game.day}天：警长竞选平票，警徽流失`); this.saveAndRefresh(game) },
  setSpeakingOrder(event) { const game = this.data.game; const direction = event.currentTarget.dataset.direction; this.checkpoint(game, '警长决定发言顺序'); game.dayState.stage = 'announceNight'; game.dayState.speakingOrder = direction; engine.addLog(game, `第${game.day}天：警长决定${direction === 'clockwise' ? '顺序' : '逆序'}发言`); this.saveAndRefresh(game) },
  announceNightDeaths() { const game = this.data.game; this.checkpoint(game, '公布昨夜信息'); engine.addLog(game, `第${game.day}天：${this.nightDeathText(game)}`); game.dayState.stage = game.pendingDeathSkills.length ? 'deathSkills' : game.pendingLastWords && game.pendingLastWords.length ? 'lastWords' : (game.dayState.endAfterDeathSkills ? 'selfExposeNight' : 'discussion'); this.saveAndRefresh(game) },
  beginExileVote() { const game = this.data.game; this.checkpoint(game, game.dayState.stage === 'exileTie' ? '开始放逐PK发言' : '开始放逐投票'); if (game.dayState.stage === 'exileTie') { game.dayState.exileVotes = {}; game.dayState.simpleVoteCounts = {} } game.dayState.stage = 'exileVote'; this.saveAndRefresh(game) },
  setExileMode(event) { const game = this.data.game; game.dayState.exileMode = event.currentTarget.dataset.mode; this.saveAndRefresh(game) },
  inputSimpleVoteCount(event) { this.setData({ simpleVoteCount: event.detail.value }) },
  recordSimpleVote() { const number = this.data.voteTargets[this.data.selectedVoteTargetIndex]; const count = Number(this.data.simpleVoteCount); if (!number || !Number.isFinite(count) || count < 0) return this.toast('请输入有效票数'); this.checkpoint(this.data.game, '记录放逐票数'); this.data.game.dayState.simpleVoteCounts[number] = count; this.setData({ simpleVoteCount: '' }); this.saveAndRefresh(this.data.game) },
  resolveExileVote() {
    const game = this.data.game; const state = game.dayState; const tally = state.exileMode === 'individual' ? this.tallyVotes(state.exileVotes, game.sheriffSeat) : state.simpleVoteCounts; const rows = this.tallyRows(tally)
    if (!rows.length) return this.toast('请先记录票数')
    this.checkpoint(game, state.exilePk ? '统计放逐PK票' : '统计放逐票')
    const max = Math.max(...rows.map(row => row.value)); const winners = rows.filter(row => row.value === max).map(row => Number(row.number))
    const eligibleVoters = state.exileMode === 'individual' ? game.seats.filter(seat => seat.alive && (!state.exilePk || !state.exileTieCandidates.includes(seat.number))).map(seat => seat.number) : []
    engine.addVoteHistory(game, { label: state.exilePk ? '放逐PK投票' : '放逐投票', votes: state.exileMode === 'individual' ? state.exileVotes : {}, eligibleVoters, tally: this.tallyRows(tally), sheriffSeat: game.sheriffSeat })
    if (winners.length > 1) { state.stage = 'exileTie'; state.exileTieCandidates = winners; state.exilePk = true; state.message = `放逐投票平票：${winners.map(n => `${n}号`).join('、')}`; return this.saveAndRefresh(game) }
    engine.applyDayEvent(game, 'exile', winners[0]); state.stage = 'exileDone'; this.saveAndRefresh(game)
  },
  recordNoExile() { const game = this.data.game; this.checkpoint(game, '记录无人出局'); engine.applyDayEvent(game, 'none'); game.dayState.stage = 'exileDone'; this.saveAndRefresh(game) },
  triggerSelfExpose() {
    const candidates = this.data.selfExposeCandidates; if (!candidates.length) return this.toast('本板当前没有可自曝的狼人牌')
    wx.showActionSheet({ itemList: candidates.map(item => `${item.number}号 ${item.name}`), success: result => {
      const game = this.data.game; const seat = candidates[result.tapIndex]; const state = game.dayState; const duringElection = !game.sheriffElectionDone && ['sheriffSignup', 'sheriffSpeech', 'sheriffVote', 'sheriffTie', 'sheriffResumeWithdraw'].includes(state.stage)
      this.checkpoint(game, `${seat.number}号狼人自曝`)
      engine.applyDayEvent(game, 'selfExpose', seat.number); game.selfExposeCount += 1
      if (duringElection) {
        game.sheriffElectionInterrupted = game.selfExposeCount < 2
        game.sheriffElectionSnapshot = { sheriffCandidates: state.sheriffCandidates, sheriffInitialCandidates: state.sheriffInitialCandidates, sheriffWithdrawn: state.sheriffWithdrawn }
        state.stage = 'announceNight'; state.endAfterDeathSkills = game.selfExposeCount < 2; state.message = game.selfExposeCount >= 2 ? '双爆吞警徽：本局没有警长。请宣布警徽流失，公布昨夜信息后直接进入夜晚。' : '警上狼人自曝：请先公布昨夜信息；本日不再继续白天流程。'
        if (game.selfExposeCount >= 2) game.sheriffElectionDone = true
      } else { state.stage = 'deathSkills'; state.endAfterDeathSkills = true }
      this.saveAndRefresh(game)
    } })
  },
  enterSelfExposeNight() { const game = this.data.game; this.checkpoint(game, '自曝后进入黑夜'); engine.nextNight(game); this.saveAndRefresh(game) },
  triggerWolfKingClaw() {
    const targets = this.data.aliveSeats
    wx.showActionSheet({ itemList: targets.map(item => `${item.number}号`), success: result => { const game = this.data.game; this.checkpoint(game, '狼王爪击'); engine.applyDayEvent(game, 'wolfKingClaw', targets[result.tapIndex].number); this.saveAndRefresh(game) } })
  },
  selectVoteHistory(event) { this.setData({ selectedVoteHistoryIndex: Number(event.currentTarget.dataset.index) }, () => this.refresh()) },
  openSeatInfo(event) { const seat = this.data.game.seats.find(item => item.number === Number(event.currentTarget.dataset.number)); if (seat) this.setData({ seatInfo: { ...seat, marks: seat.marks || {} } }) },
  closeSeatInfo() { this.setData({ seatInfo: null }) },
  enterNight() { const game = this.data.game; this.checkpoint(game, '白天结束，进入黑夜'); engine.nextNight(game); this.saveAndRefresh(game) },
  toast(title) { wx.showToast({ title, icon: 'none', duration: 2200 }) }
})
