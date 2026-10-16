const { roles } = require('../../data/roles')
const toneFor = role => role.camp === 'wolf' ? 'wolf-tag' : role.camp === 'third' ? 'third-tag' : role.group === '平民' ? 'villager-tag' : 'god-tag'
const roleList = Object.values(roles).map(role => ({ ...role, tagClass: toneFor(role) }))

Page({
  data: {
    keyword: '',
    roleList
  },
  searchRoles(event) {
    const keyword = event.detail.value
    const query = keyword.trim()
    this.setData({ keyword, roleList: roleList.filter(role => role.name.includes(query) || role.group.includes(query)) })
  },
  clearSearch() { this.setData({ keyword: '', roleList }) },
  openRole(event) { wx.navigateTo({ url: `/pages/role-detail/role-detail?roleId=${event.currentTarget.dataset.id}` }) }
})
