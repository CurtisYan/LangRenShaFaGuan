const { roles } = require('./roles')

const commonDay = (roleCounts, exposure = 'double') => ({
  sheriff: true,
  sheriffVoteWeight: 1.5,
  exposure,
  selfExposeRoleIds: Object.keys(roleCounts).filter(roleId => roles[roleId] && roles[roleId].canSelfExpose)
})
const common = (id, name, summary, roleCounts, nightActions, specialRules = [], exposure = 'double') => ({ id, name, summary, playerCount: 12, roleCounts, nightActions, dayRules: commonDay(roleCounts, exposure), rules: ['暗牌，有警长', `${exposure === 'double' ? '双曝' : '单曝'}吞警徽`, '女巫全程不能自救', ...specialRules] })

const boards = [
  common('standard12', '12人标准场', '4狼 + 4民 + 预女猎愚', { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, fool: 1 }, ['wolves', 'seer', 'witch'], ['猎人吃毒不能开枪', '愚者被放逐翻牌不死']),
  common('whiteWolfKingGuard12', '12人白狼王守卫场', '3狼 + 白狼王 + 4民 + 预女猎守', { wolf: 3, whiteWolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 }, ['wolves', 'guard', 'seer', 'witch'], ['守卫不能连守；同守同救仍出局', '白狼王自曝可带人'], 'double'),
  common('wolfKingMagician12', '12人狼王魔术师场', '3狼 + 狼王 + 4民 + 预女猎魔术师', { wolf: 3, wolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, magician: 1 }, ['magician', 'wolves', 'seer', 'witch'], ['魔术师每局一次，交换两名号码牌且仅当夜生效']),
  common('evilKnightGuard12', '12人恶灵骑士守卫场', '3狼 + 恶灵骑士 + 4民 + 预女猎守', { wolf: 3, evilKnight: 1, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 }, ['wolves', 'guard', 'seer', 'witch'], ['恶灵骑士不能自曝、免疫夜伤与毒药、查验或毒药触发反伤']),
  common('seerWitchHunterGuard12', '12人预女猎守场', '4狼 + 4民 + 预女猎守', { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 }, ['wolves', 'guard', 'seer', 'witch'], ['守卫不能连守；同守同救仍出局']),
  common('wolfBeautyKnight12', '12人狼美人骑士场', '3狼 + 狼美人 + 4民 + 预女守骑士', { wolf: 3, wolfBeauty: 1, villager: 4, seer: 1, witch: 1, guard: 1, knight: 1 }, ['wolves', 'wolfBeauty', 'guard', 'seer', 'witch'], ['狼美人出局带走魅惑目标', '骑士在放逐发言阶段决斗']),
  common('gargoyleGravedigger12', '12人石像鬼守墓人场', '3狼 + 石像鬼 + 4民 + 预女猎守墓人', { wolf: 3, gargoyle: 1, villager: 4, seer: 1, witch: 1, hunter: 1, gravedigger: 1 }, ['wolves', 'gargoyle', 'seer', 'witch', 'gravedigger'], ['石像鬼不入狼队；其他狼人全灭后可刀人', '守墓人强制获知上次放逐阵营']),
  common('bloodDemonHunter12', '12人血夜猎魔人场', '3狼 + 血夜使徒 + 4民 + 预女愚猎魔人', { wolf: 3, bloodApostle: 1, villager: 4, seer: 1, witch: 1, fool: 1, demonHunter: 1 }, ['wolves', 'seer', 'witch', 'demonHunter'], ['血夜使徒自曝封印好人当夜技能', '猎魔人第二夜起狩猎']),
  common('brotherFoxCrow12', '12人兄狐乌鸦场', '2狼 + 狼王 + 4民 + 预女猎乌鸦咒狐', { wolf: 2, wolfKing: 1, villager: 4, seer: 1, witch: 1, hunter: 1, crow: 1, cursedFox: 1 }, ['wolves', 'seer', 'witch', 'crow'], ['咒狐为第三方，狼刀与毒药免疫、被预言家查验出局', '乌鸦次日放逐票+1'], 'single'),
  common('nightmareDreamer12', '12人噩梦之影场', '3狼 + 噩梦之影 + 4民 + 预女猎摄梦人', { wolf: 3, nightmare: 1, villager: 4, seer: 1, witch: 1, hunter: 1, dreamer: 1 }, ['nightmare', 'wolves', 'seer', 'witch', 'dreamer'], ['噩梦之影恐惧封印技能', '摄梦人梦游者免夜伤，连两夜出局']),
  common('lonelyGirl12', '12人孤独少女场', '4狼 + 3民 + 孤独少女 + 预女猎守', { wolf: 4, villager: 3, lonelyGirl: 1, seer: 1, witch: 1, hunter: 1, guard: 1 }, ['lonelyGirl', 'wolves', 'guard', 'seer', 'witch'], ['孤独少女首夜选择崇拜对象', '狼人获胜前必须让孤独少女出局'])
]

module.exports = { boards, getBoard: id => boards.find(board => board.id === id) || null }
