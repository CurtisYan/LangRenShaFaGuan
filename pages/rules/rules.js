const { boards } = require('../../data/boards')
const { roles } = require('../../data/roles')

Page({
  data: {
    boards,
    roleList: Object.keys(roles).map(id => ({ ...roles[id], description: roles[id].description || '具体技能与结算以本项目 docs 中的官方角色说明为准。', tagClass: roles[id].group === '狼人' ? 'wolf-tag' : roles[id].group === '平民' ? 'villager-tag' : roles[id].group === '第三方' ? 'third-tag' : 'god-tag' }))
  }
})
