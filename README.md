# 面杀法官助手

仅供线下狼人杀法官使用的微信小程序。无需注册、登录或让玩家扫码，数据仅保存在本机微信缓存中。

## 功能

- 内置 19 个板子、34 种角色资料
- 按座位录入身份并校验数量
- 引导夜间行动、警长竞选、投票、放逐、自曝与特殊技能结算
- 自动判断胜负，支持步骤回退、对局日志和中断续局
- 内置板子规则、角色说明与 Q&A

## 打开方式

在微信开发者工具中导入本文件夹，编译后即可预览。项目已配置 AppID；无权限时可改用测试号。

## 开发

规则以 `docs/流程.md`、`docs/狼人杀板子规则大全.md` 和 `docs/角色描述与QA.md` 为准。

```bash
node tests/game-engine.test.js
node tests/game-page.test.js
node tests/reference-pages.test.js
node tests/setup-page.test.js
```
