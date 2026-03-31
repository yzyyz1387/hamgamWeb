# 汉堡图集 Hamburger

> 业余无线电图片分享社区 | HAM圈表情包 | BD8CWG

这是对 `hamgamWeb-main` 的 Vue 重构升级版，专注于业余无线电、HAM圈的图片分享社区。

**网站地址**: <https://g.seeku.site>

<br />

## 许可证

MIT License

## 插件测试 / 回归机制

项目已内置一套插件回归机制骨架：

- `docs/plugins/REGRESSION_CHECKLIST.md`
- `docs/plugins/TESTING.md`
- `tests/plugins/`

常用命令：

```bash
npm run test:plugins
npm run regression:plugins
```


插件版本兼容 / 迁移策略说明见：`docs/plugins/VERSIONING_AND_MIGRATIONS.md`。
