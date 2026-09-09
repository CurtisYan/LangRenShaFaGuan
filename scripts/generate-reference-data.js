const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const boardIds = {
  '12人标准场': 'standard12', '12人白狼王守卫场': 'whiteWolfKingGuard12', '12人狼王魔术师场': 'wolfKingMagician12',
  '12人恶灵骑士守卫场': 'evilKnightGuard12', '12人预女猎守场': 'seerWitchHunterGuard12', '12人狼美人骑士场': 'wolfBeautyKnight12',
  '12人石像鬼守墓人场': 'gargoyleGravedigger12', '12人血夜猎魔人场': 'bloodDemonHunter12', '12人兄狐乌鸦场': 'brotherFoxCrow12',
  '12人噩梦之影场': 'nightmareDreamer12', '12人孤独少女场': 'lonelyGirl12', '12人奇迹商人场': 'miracleMerchant12',
  '12人永序之轮': 'eternalOrder12', '12人纯白夜影': 'pureWhiteNight12', '12人迷雾鸦影': 'fogCrow12',
  '12人猎日逐光': 'sunChaser12', '12人觉醒狼王': 'awakenedWolfKing12', '12人镜隐迷踪': 'mirrorMystery12'
}

const roleIds = {
  '狼人': 'wolf', '平民': 'villager', '预言家': 'seer', '女巫': 'witch', '猎人': 'hunter', '白狼王': 'whiteWolfKing',
  '守卫': 'guard', '魔术师': 'magician', '恶灵骑士': 'evilKnight', '狼美人': 'wolfBeauty', '骑士': 'knight', '乌鸦': 'crow',
  '咒狐': 'cursedFox', '噩梦之影': 'nightmare', '摄梦人': 'dreamer', '石像鬼': 'gargoyle', '守墓人': 'gravedigger',
  '血夜使徒': 'bloodApostle', '猎魔人': 'demonHunter', '愚者': 'fool', '孤独少女': 'lonelyGirl', '奇迹商人': 'miracleMerchant',
  '蚀时狼妃': 'timeWolfConsort', '定序王子': 'orderPrince', '狼巫': 'wolfWitch', '纯白之女': 'pureWhiteGirl',
  '狼鸦之爪': 'wolfCrowClaw', '炼金魔女': 'alchemistWitch', '蚀日侍女': 'eclipseMaid', '流光伯爵': 'radiantCount',
  '觉醒狼王': 'awakenedWolfKing', '觉醒隐狼': 'awakenedHiddenWolf', '魔镜少女': 'mirrorGirl'
}

function sections(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
  const matches = [...text.matchAll(/^## ([^\n]+)\n/gm)]
  return matches.map((match, index) => ({ title: match[1].trim(), markdown: text.slice(match.index + match[0].length, matches[index + 1] ? matches[index + 1].index : text.length).trim() }))
}

function writeModule(file, exportName, records) {
  const body = Object.fromEntries(records.map(record => [record.id, record]))
  fs.writeFileSync(path.join(root, file), `const ${exportName} = ${JSON.stringify(body, null, 2)}\n\nmodule.exports = { ${exportName} }\n`, 'utf8')
}

const boards = sections('docs/狼人杀板子规则大全.md').map(section => {
  const title = section.title.replace(/^[一二三四五六七八九十]+、/, '')
  return boardIds[title] ? { id: boardIds[title], title, markdown: section.markdown } : null
}).filter(Boolean)
const roles = sections('docs/角色描述与QA.md').map(section => roleIds[section.title] ? { id: roleIds[section.title], title: section.title, markdown: section.markdown } : null).filter(Boolean)

if (boards.length !== Object.keys(boardIds).length) throw new Error(`板子文档映射不完整：${boards.length}/${Object.keys(boardIds).length}`)
if (roles.length !== Object.keys(roleIds).length) throw new Error(`角色文档映射不完整：${roles.length}/${Object.keys(roleIds).length}`)
writeModule('data/board-documents.js', 'boardDocuments', boards)
writeModule('data/role-documents.js', 'roleDocuments', roles)
console.log(`generated ${boards.length} boards and ${roles.length} roles`)
