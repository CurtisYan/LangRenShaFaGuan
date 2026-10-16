const nightActionDefinitions = {
  mirrorGirlSignal: { id: 'mirrorGirlSignal', roleId: 'mirrorGirl', name: '魔镜少女闭眼示意', kind: 'information', closedEyeSignal: true },
  hiddenWolfStatus: { id: 'hiddenWolfStatus', roleId: 'awakenedHiddenWolf', name: '觉醒隐狼检查刀状态', kind: 'information' },
  hunterStatus: { id: 'hunterStatus', roleId: 'hunter', name: '猎人确认技能状态', kind: 'information' },
  magician: { id: 'magician', roleId: 'magician', name: '魔术师行动', kind: 'multiTarget', targetCount: 2, optional: true },
  nightmare: { id: 'nightmare', roleId: 'nightmare', name: '噩梦之影恐惧', kind: 'target', optional: true, excludeSelf: true },
  lonelyGirl: { id: 'lonelyGirl', roleId: 'lonelyGirl', name: '孤独少女崇拜', kind: 'target', firstNightOnly: true, required: true, excludeSelf: true },
  miracleMerchant: { id: 'miracleMerchant', roleId: 'miracleMerchant', name: '奇迹商人交易', kind: 'skillTarget', optional: true, excludeSelf: true, requiresAllIdentities: true, choices: ['inspect', 'poison', 'guard'], choiceLabels: ['查验', '毒药', '守护'] },
  luckySkill: { id: 'luckySkill', name: '幸运儿行动', kind: 'dynamicSkill', optional: true },
  timeWolfConsort: { id: 'timeWolfConsort', roleId: 'timeWolfConsort', name: '蚀时狼妃封锁', kind: 'target', optional: true },
  awakenedWolfKing: { id: 'awakenedWolfKing', roleId: 'awakenedWolfKing', name: '觉醒狼王亲传', kind: 'target', optional: true, wolfTargetOnly: true, excludeSelf: true },
  awakenedHiddenWolf: {
    id: 'awakenedHiddenWolf', roleId: 'awakenedHiddenWolf', name: '觉醒隐狼模仿', kind: 'target', optional: true, excludeSelf: true, requiresAllIdentities: true,
    copiedSkills: {
      wolf: { description: '其他狼人全部出局后接管普通狼刀，并在加入狼队的当夜获得一次性额外爪击。模仿不会使其立即加入狼队或与狼人交流。', timing: '额外爪击须在加入狼队时获得。' },
      mirrorGirl: { description: '每晚查验一名其他玩家的具体身份，不能重复查验。', timing: '下一夜起可使用。' },
      witch: { description: '获得一瓶毒药，可使一名玩家夜间出局；没有解药。', timing: '下一夜起可使用。' },
      guard: { description: '每晚守护一名玩家，防止其被爪击或被女巫毒出局。', timing: '下一夜起可使用。' },
      hunter: { description: '出局后可选择一名玩家，使其一并出局。', timing: '本夜结束后的天亮起，出局时可按规则发动。' },
      villager: { description: '没有可发动的角色技能。', timing: '' }
    }
  },
  alchemistWitch: { id: 'alchemistWitch', roleId: 'alchemistWitch', name: '炼金魔女末明之雾', kind: 'multiTarget', targetCount: 3, optional: true },
  eclipseMaid: { id: 'eclipseMaid', roleId: 'eclipseMaid', name: '蚀日侍女吞噬', kind: 'target', optional: true, excludeSelf: true, fromDay: 2, requiresAllIdentities: true },
  eclipseMaidAbility: { id: 'eclipseMaidAbility', roleId: 'eclipseMaid', name: '蚀日侍女继承技能', kind: 'dynamicSkill', optional: true, fromDay: 2 },
  radiantCount: { id: 'radiantCount', roleId: 'radiantCount', name: '流光伯爵庇护', kind: 'target', optional: true, excludeSelf: true, fromDay: 2 },
  pureWhiteGirl: { id: 'pureWhiteGirl', roleId: 'pureWhiteGirl', name: '纯白之女查验', kind: 'target', required: true, exactInspection: true, requiresAllIdentities: true },
  wolfWitch: { id: 'wolfWitch', roleId: 'wolfWitch', name: '狼巫查验', kind: 'target', required: true, nonWolfTargetOnly: true, exactInspection: true, requiresAllIdentities: true },
  wolfCrowClaw: { id: 'wolfCrowClaw', roleId: 'wolfCrowClaw', name: '狼鸦之爪觉醒爪击', kind: 'target', optional: true },
  mirrorGirl: { id: 'mirrorGirl', roleId: 'mirrorGirl', name: '魔镜少女查验', kind: 'target', required: true, exactInspection: true, excludeSelf: true, noRepeat: true, requiresAllIdentities: true },
  hiddenWolfAbility: { id: 'hiddenWolfAbility', roleId: 'awakenedHiddenWolf', name: '觉醒隐狼复制技能', kind: 'dynamicSkill', optional: true },
  wolves: { id: 'wolves', name: '狼人行动', kind: 'target', required: true },
  wolfBeauty: { id: 'wolfBeauty', roleId: 'wolfBeauty', name: '狼美人魅惑', kind: 'target', required: true, excludeSelf: true },
  guard: { id: 'guard', roleId: 'guard', name: '守卫守护', kind: 'target', optional: true, noConsecutive: true },
  seer: { id: 'seer', roleId: 'seer', name: '预言家查验', kind: 'target', optional: true, requiresAllIdentities: true },
  witch: { id: 'witch', roleId: 'witch', name: '女巫行动', kind: 'witch', optional: true },
  gargoyle: { id: 'gargoyle', roleId: 'gargoyle', name: '石像鬼查验', kind: 'target', optional: true, exactInspection: true, excludeSelf: true, noRepeat: true, requiresAllIdentities: true },
  gravedigger: { id: 'gravedigger', roleId: 'gravedigger', name: '守墓人查验', kind: 'information' },
  demonHunter: { id: 'demonHunter', roleId: 'demonHunter', name: '猎魔人狩猎', kind: 'target', optional: true, excludeSelf: true, fromDay: 2 },
  crow: { id: 'crow', roleId: 'crow', name: '乌鸦诅咒', kind: 'target', optional: true, excludeSelf: true },
  dreamer: { id: 'dreamer', roleId: 'dreamer', name: '摄梦人行动', kind: 'target', required: true, excludeSelf: true }
}

module.exports = { nightActionDefinitions }
