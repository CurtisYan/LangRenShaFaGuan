const { roles } = require('./roles')
const { nightActionDefinitions } = require('./night-actions')

const defaultSettings = { firstNightSelfSave: true, guardSaveDies: true, sheriff: false, exposure: 'double', winMode: 'edge' }
// 顺序依据 docs/流程.md；仅加入所选角色的行动。
const actionOrder = ['nightmare', 'magician', 'lonelyGirl', 'miracleMerchant', 'luckySkill', 'timeWolfConsort', 'alchemistWitch', 'eclipseMaid', 'eclipseMaidAbility', 'wolves', 'wolfBeauty', 'gargoyle', 'wolfWitch', 'wolfCrowClaw', 'awakenedWolfKing', 'guard', 'hiddenWolfStatus', 'dreamer', 'radiantCount', 'crow', 'witch', 'demonHunter', 'gravedigger', 'seer', 'pureWhiteGirl', 'mirrorGirl', 'awakenedHiddenWolf', 'hiddenWolfAbility', 'hunterStatus']
const actionRoles = { wolves: null, luckySkill: 'miracleMerchant', eclipseMaidAbility: 'eclipseMaid', hiddenWolfStatus: 'awakenedHiddenWolf', hiddenWolfAbility: 'awakenedHiddenWolf', hunterStatus: 'hunter' }

function settingsForPlayerCount(options, playerCount) {
  const settings = { ...defaultSettings, ...options }
  settings.sheriff = playerCount >= 9 && Boolean(settings.sheriff)
  settings.exposure = playerCount <= 10 ? 'single' : (['single', 'double'].includes(settings.exposure) ? settings.exposure : 'double')
  return settings
}

function customRoleSelectionError(counts) {
  if (counts.eclipseMaid > 0 && counts.hunter > 0) return '蚀日侍女与猎人不能在自定义板子中同时选入，请更换其中一个角色'
  const specialWolves = Object.keys(counts).filter(id => counts[id] > 0 && roles[id] && roles[id].camp === 'wolf' && id !== 'wolf')
  return specialWolves.length > 1 ? '自定义板子最多选择一名大狼（特殊狼人），请先移除已选大狼' : ''
}

function customBoardWarnings(counts) {
  if (!counts.awakenedHiddenWolf) return []
  const supported = nightActionDefinitions.awakenedHiddenWolf.copiedSkills
  const unsupported = Object.keys(counts).filter(id => counts[id] > 0 && id !== 'awakenedHiddenWolf' && roles[id] && !Object.prototype.hasOwnProperty.call(supported, id))
  return unsupported.length ? [`觉醒隐狼不能模仿本局的${unsupported.map(id => roles[id].name).join('、')}，这些身份不会出现在模仿目标中`] : []
}

function buildCustomBoard(counts = {}, options = {}) {
  let settings = { ...defaultSettings, ...options }
  if (!['manual', 'edge', 'city'].includes(settings.winMode)) throw new Error('请选择有效的胜负判定')
  const roleCounts = {}
  Object.entries(counts).forEach(([id, count]) => {
    if (!roles[id] || !Number.isInteger(count) || count < 0 || (!['wolf', 'villager'].includes(id) && count > 1)) throw new Error('角色数量无效')
    if (count) roleCounts[id] = count
  })
  const specialWolfError = customRoleSelectionError(roleCounts)
  if (specialWolfError) throw new Error(specialWolfError)
  const playerCount = Object.values(roleCounts).reduce((sum, count) => sum + count, 0)
  settings = settingsForPlayerCount(settings, playerCount)
  const hasCamp = camp => Object.keys(roleCounts).some(id => roles[id].camp === camp)
  if (!hasCamp('wolf') || !hasCamp('good')) throw new Error('请至少选择一名狼人阵营和一名好人阵营角色')
  const nightSequence = actionOrder.filter(action => action === 'wolves' || roleCounts[actionRoles[action] || action])
  // 觉醒隐狼的刀状态必须在狼刀前告知；守卫也须先完成守护。
  if (roleCounts.awakenedHiddenWolf) {
    const beforeWolves = ['guard', 'hiddenWolfStatus'].filter(action => nightSequence.includes(action))
    beforeWolves.forEach(action => nightSequence.splice(nightSequence.indexOf(action), 1))
    nightSequence.splice(nightSequence.indexOf('wolves'), 0, ...beforeWolves)
  }
  const firstNightSequence = nightSequence.filter(action => !['hiddenWolfStatus', 'hiddenWolfAbility', 'hunterStatus'].includes(action))
  if (roleCounts.awakenedHiddenWolf && roleCounts.mirrorGirl) {
    firstNightSequence.splice(firstNightSequence.indexOf('awakenedHiddenWolf'), 1)
    firstNightSequence.splice(firstNightSequence.indexOf('mirrorGirl'), 0, 'awakenedHiddenWolf')
  }
  if (roleCounts.hunter) firstNightSequence.splice(firstNightSequence.indexOf('awakenedHiddenWolf') >= 0 ? firstNightSequence.indexOf('awakenedHiddenWolf') : firstNightSequence.length, 0, 'hunterStatus')
  if (roleCounts.mirrorGirl) firstNightSequence.unshift('mirrorGirlSignal')
  return {
    id: 'custom', name: '自定义板子', playerCount, roleCounts, settings,
    summary: Object.entries(roleCounts).map(([id, count]) => `${roles[id].name}×${count}`).join(' · '),
    nightSequence, firstNightSequence,
    warnings: customBoardWarnings(roleCounts),
    witchSelfSave: settings.firstNightSelfSave ? 'firstNight' : 'never',
    guardSaveDies: settings.guardSaveDies,
    winMode: settings.winMode,
    dayRules: { sheriff: settings.sheriff, sheriffVoteWeight: settings.sheriff ? 1.5 : 1, exposure: settings.sheriff ? settings.exposure : 'none', selfExposeRoleIds: Object.keys(roleCounts).filter(id => roles[id].canSelfExpose) },
    rules: [settings.sheriff ? `暗牌，有警长，${settings.exposure === 'double' ? '双曝' : '单曝'}吞警徽` : '暗牌，无警长', settings.firstNightSelfSave ? '女巫仅首夜可以自救' : '女巫全程不能自救', settings.guardSaveDies ? '同守同救（奶穿）出局' : '同守同救不因奶穿出局', { manual: '玩家自己裁决胜负，由法官记录', edge: '屠边：所有平民或所有神民出局', city: '屠城：所有好人出局' }[settings.winMode]]
  }
}

module.exports = { defaultSettings, buildCustomBoard, customBoardWarnings, customRoleSelectionError, settingsForPlayerCount }
