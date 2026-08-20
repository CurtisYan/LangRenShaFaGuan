const roles = {
  wolf: { id: 'wolf', name: '狼人', camp: 'wolf', group: '狼人', canSelfExpose: true },
  wolfKing: { id: 'wolfKing', name: '狼王', camp: 'wolf', group: '狼人', canSelfExpose: true, deathSkill: 'claw' },
  whiteWolfKing: { id: 'whiteWolfKing', name: '白狼王', camp: 'wolf', group: '狼人', canSelfExpose: true, selfExposeSkill: 'claw' },
  evilKnight: { id: 'evilKnight', name: '恶灵骑士', camp: 'wolf', group: '狼人', canSelfExpose: false },
  wolfBeauty: { id: 'wolfBeauty', name: '狼美人', camp: 'wolf', group: '狼人', canSelfExpose: false, deathSkill: 'charmFollow' },
  gargoyle: { id: 'gargoyle', name: '石像鬼', camp: 'wolf', group: '狼人', canSelfExpose: false },
  bloodApostle: { id: 'bloodApostle', name: '血夜使徒', camp: 'wolf', group: '狼人', canSelfExpose: true, selfExposeSkill: 'sealGoodSkills' },
  nightmare: { id: 'nightmare', name: '噩梦之影', camp: 'wolf', group: '狼人', canSelfExpose: true },
  villager: { id: 'villager', name: '平民', camp: 'good', group: '平民' },
  seer: { id: 'seer', name: '预言家', camp: 'good', group: '神职' },
  witch: { id: 'witch', name: '女巫', camp: 'good', group: '神职' },
  hunter: { id: 'hunter', name: '猎人', camp: 'good', group: '神职', deathSkill: 'shot' },
  guard: { id: 'guard', name: '守卫', camp: 'good', group: '神职' },
  fool: { id: 'fool', name: '愚者', camp: 'good', group: '神职' },
  magician: { id: 'magician', name: '魔术师', camp: 'good', group: '神职' },
  knight: { id: 'knight', name: '骑士', camp: 'good', group: '神职' },
  gravedigger: { id: 'gravedigger', name: '守墓人', camp: 'good', group: '神职' },
  demonHunter: { id: 'demonHunter', name: '猎魔人', camp: 'good', group: '神职' },
  crow: { id: 'crow', name: '乌鸦', camp: 'good', group: '神职' },
  dreamer: { id: 'dreamer', name: '摄梦人', camp: 'good', group: '神职' },
  cursedFox: { id: 'cursedFox', name: '咒狐', camp: 'third', group: '第三方' }
}

module.exports = { roles }
