const { roles } = require('../../data/roles')
const toneFor = role => role.camp === 'wolf' ? 'wolf-tag' : role.camp === 'third' ? 'third-tag' : role.group === '平民' ? 'villager-tag' : 'god-tag'

Page({
  data: {
    roleList: Object.values(roles).map(role => ({ ...role, tagClass: toneFor(role) }))
  },
  openRole(event) { wx.navigateTo({ url: `/pages/role-detail/role-detail?roleId=${event.currentTarget.dataset.id}` }) }
})
